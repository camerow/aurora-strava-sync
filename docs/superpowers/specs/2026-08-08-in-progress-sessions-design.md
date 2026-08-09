# In-progress sessions - Design

Date: 2026-08-08
Status: Approved

## Problem

A session that just finished is invisible in sendtally until roughly two hours later.

`buildSessions` drops any group whose last climb is inside the 120-minute in-progress window (`packages/core/src/session.ts`).
That drop happens before the sync pipeline persists anything, so the session is never written to D1 and never appears in the app.
Pressing "sync now" right after climbing reports success and produces nothing visible, which reads as a broken sync.

The window exists for a good reason: it stops an ongoing session from being posted to Strava early, as a partial activity that will never be corrected.
That reason applies to the Strava post, not to the app's own session list.

## Approach

Separate the two concerns the window currently conflates.

Persistence and display become unconditional: every session the builder groups is scored, written to D1, and visible in the app immediately.
Strava posting keeps the existing 120-minute gate.

This needs no force flag, no API body change, and no queue message change.
The sync button already enqueues a job; the job simply stops discarding the newest session.
Cron benefits identically, so the in-progress session's climb count and score stay fresh as the session grows.

## Core changes

`Session` gains `inProgress: boolean`.

`buildSessions` stops returning early in `flush()`.
It pushes every group and sets `inProgress` to `now.getTime() - last.time.getTime() < cfg.inProgressWindowMs`.

Grouping, `start`, and `end` are untouched.
For any session where `inProgress` is false, output is byte-identical to today, which preserves parity with the Go CLI fixtures by construction.

## Scoring parity

Today an in-progress session cannot appear in another session's rolling history, because it did not exist.
If it silently joined the history now, previously computed RPEs would shift, breaking the Go reference fixtures and changing scores for already-posted activities.

The pipeline therefore excludes in-progress sessions from the history passed to `score()` when scoring other sessions.
The in-progress session itself is scored against the full completed history.

Its RPE, title, and summary recompute on every sync as it grows.
That is safe: `upsertScoredSession` updates the row in place, and session identity is `fingerprint(boardUserId, firstClimb.time)`, which is anchored on the first climb and does not move when later climbs are added.

## Pipeline changes

`syncOneBoard` in `packages/sync-service/src/pipeline.ts`:

- Persist every scored session, including in-progress ones. `upsertScoredSession` is unchanged.
- Add one condition to the posting filter: skip sessions where `inProgress` is true.

Existing dedup still guarantees correctness.
`postedSessionFingerprints` is checked before posting and `markSessionPosted` after, so the later sync that finally posts the session cannot double-post it.

## API read layer

`/v1/sessions` and `/v1/sessions/:fingerprint` return a derived `inProgress` boolean.

It is computed at read time rather than stored, so there is no new column and no migration.
The stored `end_at` is the last climb plus the 5-minute cooldown buffer, so the last climb is `end_at` minus the cooldown buffer, and the session is in progress when that value is within the 120-minute window of now.

The comparison must use `wallClockNow(user.timezone)` as its "now", not a raw `new Date()`.
Stored timestamps originate from `parseAuroraTime`, which yields wall-clock instants labelled as UTC, and the pipeline already compares against `wallClockNow`.
Mixing a real UTC now into that comparison would skew the window by the user's offset.
The user row is already loaded on these routes, so the timezone is available.

The app badges in-progress sessions so a partial session is not mistaken for a final one.

## Testing

Core:

- Table-driven cases for the flag: session that just ended, session exactly at the window boundary, old session.
- Existing session fixtures stay unchanged, proving completed-session output did not move.

Pipeline:

- An in-progress session is persisted but not posted to Strava.
- The same session posts on a later sync once it falls outside the window, exactly once.
- Completed-session RPEs are unaffected by the presence of a concurrent in-progress session.

## Out of scope

Updating a Strava activity after it is posted.
A session that is posted and then grows further would leave the Strava activity stale, but that only happens after a two-hour gap, which is a new session under the 90-minute rule.
