# Settings reorganized by board

## Goal

Restructure the sync/accounts settings surface so it is organized around the boards a user has connected, instead of around the operations they can perform.

Today the page is split by verb: SCHEDULE, MANUAL SYNC, STRAVA POSTING, CONNECTED ACCOUNTS.
A user with two boards connected sees each board mentioned three separate times, once per section.
After this change each board is one card that holds everything about that board, Strava is its own account section, and scheduled sync is a top-level setting that lists what it covers.

## Scope

Presentation only.
No D1 schema changes, no new API endpoints, no cron or queue changes.
Everything renders from the existing `GET /v1/status` payload and the existing `POST /v1/sync-now`, `POST /v1/strava/posting`, and `POST /v1/sync-schedule` endpoints.

Both platforms change together: `apps/web` `/app/settings` and the `apps/mobile` Sync tab.

## Page structure

Three sections, in this order on both platforms.

### 1. Scheduled sync

Top-level section, first on the page.

The global daily-sync toggle, unchanged in behavior: it calls `POST /v1/sync-schedule` with `mode: "off" | "daily"` and reflects the per-user `users.auto_sync` flag.

Below the toggle, a per-board status list naming each connected board and its connection status, so it is visible at a glance which boards the schedule covers.

The global `LAST SYNC <date>` / `FIRST IMPORT PENDING` line stays in this section.
It comes from `sync_state`, which is per user rather than per board, so it belongs with the global schedule and not on the individual board cards.

The schedule stays a single global toggle.
Per-board schedules were considered and deferred: `users.auto_sync` and `sync_state` are both per-user today, so per-board scheduling would require schema, cron, and API work that this change does not need.

### 2. Connected boards

Renamed from CONNECTED ACCOUNTS.
One card per connected board, ordered as `listBoardConnections` returns them (by `connected_at`).

Each card contains everything about that board:

- Board name (from `BOARD_LABELS`) and connection status, rendered as today's mono status line, with the Re-link action linking to `/app/setup?add=board`.
- A manual **Sync now** button calling `POST /v1/sync-now` with that board. While any board is syncing, every board's button is disabled, matching today's `syncingBoard` behavior. The result message renders inside the card that triggered it.
- Strava posting controls for that board: the `POSTING ON` / `POSTING OFF` status, and the actions that call `POST /v1/strava/posting` with `mode: "new" | "all" | "off"`. When posting is off the card offers "Post new sessions" and "Post full history"; when on it offers "Turn off".
- When Strava is not connected at all, the card shows a hint pointing at the Strava section instead of the posting controls, since `POST /v1/strava/posting` returns 409 without a Strava connection.

A trailing row links to `/app/setup?add=board` to connect another board, keeping today's copy.

### 3. Strava

A separate section for the Strava account only.

It shows connection status, the athlete ID, and the Connect or Re-link action linking to `/app/setup`.
Posting controls do not appear here; they live on the board cards, so that a board's card is the single place to configure that board.

There is exactly one Strava account per user (`strava_connections` is keyed by `user_id`), so this section is a single row rather than a list.

## Sections that go away

MANUAL SYNC and STRAVA POSTING are removed as standalone sections on both platforms.
Their contents move into the per-board cards.
No functionality is dropped: every button that exists today still exists, just relocated.

## Empty state

With zero boards connected:

- Scheduled sync keeps its existing prose and the toggle.
- Connected boards renders only the "Link a board" row, with today's `NOT LINKED` / `TENSION, KILTER, AND MORE` copy.
- Strava renders normally, since Strava can be connected before any board is.

## Mobile differences

The mobile Sync tab uses the same three sections in the same order, built from the same `useSyncSettings` hook.

Differences from web:

- Board cards omit the Re-link action, and the Strava section omits Connect/Re-link. Mobile keeps its existing copy that board and Strava connections are managed on the web at sendtally.com.
- The existing ACCOUNT section (Clerk email, sign out) stays at the bottom of the page, after Strava.
- The header badge logic (`STRAVA + BOARD` / `BOARD ONLY` / `NOT CONNECTED`) is unchanged on both platforms.

## Shared logic

`packages/features/src/sync-settings/useSyncSettings.ts` needs no API surface changes.

Both screens need the same derived shape: for each connected board, its label, connection status, posting state, and whether its sync button should be disabled.
That derivation is added to the hook so web and mobile render from one shape instead of each recomputing it, keeping the two platforms from drifting.

## Testing

- Unit-test the derived per-board shape in the hook: zero boards, one board, two boards, Strava connected and not connected, posting on and off.
- Verify by running the web app: with a board connected, confirm the board card's sync button, posting toggle, and the schedule toggle each still hit their endpoint and reflect the response.
- Confirm the mobile Sync tab renders the three sections with a connected board and in the empty state.
