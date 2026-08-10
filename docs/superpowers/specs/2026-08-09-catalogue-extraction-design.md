# Board catalogue extraction - Design

Date: 2026-08-09
Status: Approved

## Problem

The shared board catalogue is refreshed on the user sync path, not on its own schedule.

`ensureBoardCache` is called inside `syncOneBoard` (`packages/sync-service/src/pipeline.ts`), using the syncing user's board token.
The only cron is the hourly `"0 * * * *"`, and its `scheduled` handler does one thing: fan out user syncs.
There is no catalogue cron.

`CLAUDE.md` describes the intended design as a per-board shared cache with "its own cron" that keeps it fresh, refreshed lazily "when a user's sync references missing climbs".
Neither of those exists in the code.

This produces two concrete problems.

The initial catalogue download is paid by whichever user happens to sync a board first, and it blocks that user's sync across many queue messages while it completes.

More importantly, once the catalogue is complete every subsequent user sync still calls `ensureBoardCache`, which falls through to an incremental `syncShared` of `CACHE_REFRESH_PAGES` pages.
Refresh traffic against Aurora therefore scales with the number of users rather than the number of boards.
With N users on one board syncing hourly, that is N times the polling of the same shared data.
`CLAUDE.md` gives the reason this matters: polling once per board rather than once per user is what "protects us from being blocked on their private API".
The current code fails at exactly the goal the cache was built to serve.

It is harmless today only because Strava caps the app at one connected athlete, so there is effectively one user.
It stops being harmless the moment that cap lifts.

## Established by probe: the catalogue needs a token

The Aurora client has an untested affordance for an empty token that omits the `Cookie` header (`packages/sync-service/src/lib/aurora.ts`).
Nothing calls it, and the Go reference implementation always sends a token.

A single unauthenticated request was made against the real endpoint to settle whether a credential-free cron was possible: `POST https://tensionboardapp2.com/sync` with the same form body, `Content-Type`, `Accept`, and `User-Agent` the client sends, and no `Cookie` header.
The path was confirmed identical to the Go reference before the request was made.

It returned HTTP 404 with an empty body.
Aurora appears to hide the endpoint from unauthenticated callers rather than returning 401.

The catalogue cron therefore cannot run credential-free and must borrow a token from an active board connection.

### Related observation, deliberately out of scope

The client raises `BoardTokenRejectedError` only on 401 and 403.
If Aurora signals an expired session with 404 the way it apparently signals an absent one, an expired board token would not mark the connection dead.
It would throw a generic error, the queue would retry, and the user would never be prompted to reconnect while `/v1/status` continued to report the board as active.

This is unconfirmed: the probe proves only that a request with no cookie returns 404, not that an expired cookie does.
Confirming it needs a genuinely dead token.
No change is made here; it is recorded so the next board-token expiry is read as evidence rather than noise.

## Approach

Move routine catalogue refresh onto its own daily schedule, keep a narrow lazy path for climbs that are missing at sync time, and stop the user sync path from ever performing a full catalogue download.

## Job kind on the existing queue

The queue message becomes a discriminated union:

- `{ kind: "user", userId, board? }`
- `{ kind: "catalogue", board }`

A message with no `kind` is treated as a user job.
This matters at deploy time: messages enqueued by the old code will still be in flight when the new consumer starts.

A separate queue was rejected as speculative at current scale.
If catalogue fills ever starve user syncs, a dedicated queue is the escape hatch.

## Authentication and token rotation

A new repo query returns the active connections for a board, most recently connected first.

The catalogue consumer decrypts the first connection's token and uses it.
On `BoardTokenRejectedError` it marks that connection dead and falls through to the next.
A board with no active connections is skipped entirely, since no user is being served by that catalogue.

This is what finally delivers one poll per board rather than one per user.

## Scheduling

A second cron expression, `"0 4 * * *"`, is added alongside the existing hourly one.

`scheduled` currently ignores its `ScheduledController`.
It starts switching on `controller.cron` so the two fan-outs stay separate and self-documenting: hourly enqueues due user syncs, daily enqueues one catalogue job per board with active connections.

Page budgets, all per queue message:

- Initial fill keeps today's `CACHE_FILL_PAGES` (12) and re-enqueues until complete, so a large first download spans messages rather than exhausting one invocation's subrequest budget.
- The daily refresh gets its own larger budget than today's per-sync `CACHE_REFRESH_PAGES` (4), since it now runs once a day for the whole board rather than on every user sync. It also re-enqueues if it does not complete.
- Refresh on miss keeps the small `CACHE_REFRESH_PAGES` budget, because it runs inline on a user sync and must stay quick.

## What leaves the user sync path

`ensureBoardCache` and the initial `fillTable` logic are removed from `syncOneBoard`.
The user sync path can no longer trigger a full catalogue download.

`CacheFillInProgressError` and the `cache_filling` status leave the user path with them.

## What replaces it: `catalogue_pending`

If a user syncs a board whose catalogue has never completed, scoring anyway would post a first session full of unresolved climbs and a conservative RPE.
Because posted Strava activities are never updated, that wrong data would be permanent.

So the sync defers instead: it re-enqueues itself and returns `catalogue_pending` without scoring or posting.

This is the old `cache_filling` renamed and inverted in meaning, from "I am filling the catalogue" to "I am waiting for it".
It remains a genuine user-facing state and a better one to display than the old name.

## Refresh on miss

Before scoring, the pipeline collects the climb UUIDs a sync references and checks them against the cache.
If any are absent, it runs one incremental `syncShared` capped at `CACHE_REFRESH_PAGES` using the syncing user's token, re-queries, and proceeds.

At most once per sync, so it cannot loop.
If a climb is still unresolved afterwards it keeps today's behaviour: no name, grade `-1`, scored conservatively as V1.
The daily cron is what eventually resolves it.

This is the lazy refresh `CLAUDE.md` always described, and it is what makes a daily background cadence safe.
Board problems are set continuously; without it, a problem climbed the day it was set would resolve to no name and grade `-1`, score as V1, and post to Strava permanently wrong.

## Connect

Connecting a board enqueues a catalogue job for that board immediately.

The job carries only the board, not a token.
The connection row is written before the job is enqueued, so the consumer's token lookup finds the connection that was just created.

The existing user sync enqueue at connect time is unchanged.
If the catalogue has not completed by the time that sync runs, it defers via `catalogue_pending` and retries.

## Testing

- The catalogue job fills a board and resumes across queue messages.
- Token rotation: the first connection is rejected, it is marked dead, and the next connection's token is used.
- A board with no active connections is skipped.
- The daily cron enqueues one catalogue job per eligible board; the hourly cron continues to enqueue only user syncs.
- Connecting a board enqueues a catalogue job.
- A user sync against an incomplete catalogue returns `catalogue_pending`, persists nothing, and posts nothing.
- Refresh on miss resolves a climb absent from the cache, and runs at most once per sync.
- A queue message with no `kind` is handled as a user job.

## Out of scope

Adding 404 to the token-rejected branch, pending confirmation that Aurora uses it for expired sessions.

The Go CLI in `tools/cli-go/` keeps its inline fill.
It is a single-user personal tool where the shared-cache polling concern does not apply.

Live sync status in the app, which is the next piece of work and depends on the status vocabulary this change settles.
