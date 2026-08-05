# Tension Board to Strava Sync - Design

Date: 2026-08-04
Status: Approved

## Purpose

Sync climbing sessions logged in the Tension Board app to Strava as `RockClimbing` activities.
Each activity carries an effort-based title derived from grades climbed, volume, and rest pattern.
Runs locally on Will's Mac first; the core is designed to be reused later in a hosted multi-user service.

## Data access

The Tension Board app is an iOS wrapper (`com.auroraclimbing.Tension-Board-2`) built on Aurora Climbing's platform.
Aurora's sync API is stable and well reverse-engineered (see the BoardLib project).
We implement a small Go client against it - no UI automation, no dependency on the Mac app.

Fallback (not built now): the app's local `db.sqlite3` has an identical schema and could be read directly if the API ever breaks.

## Architecture

Single Go binary. Package layout:

- `aurora/` - API client (login, sync)
- `session/` - session builder (pure)
- `effort/` - effort scoring (pure)
- `strava/` - OAuth + activity publisher
- `store/` - local state (SQLite)
- `cmd/` - CLI wiring

`session/` and `effort/` hold all the logic, take plain data in and out, and are fully unit-testable.
The future hosted service reuses everything except `cmd/`.

## Aurora client

Two endpoints:

- `POST /sessions` with username/password returns a long-lived token and user ID.
  Token stored in macOS Keychain (via `security` CLI); re-login only on expiry.
- `POST /sync` with the token returns the user's `ascents` and `bids` (climb UUID, angle, `climbed_at`, difficulty, tries, quality).

We pull full history every run rather than incremental sync - the dataset is small, and full pulls are self-healing.
Idempotency is handled downstream by the state store.

Grade mapping (`difficulty_grades`: Aurora numeric difficulty to V-grade) is vendored as a static table generated from the app bundle's `db.sqlite3`.

Timestamps are wall-clock local time of logging; we treat them as machine-local time.
Time zone becomes a per-user setting in the hosted version.

## Session builder

Input: ascents + bids merged and sorted by timestamp.
A gap greater than 90 minutes (config) closes a session.

Per session:

- `start` = first climb minus 10-minute warm-up buffer (config)
- `end` = last climb plus 5-minute buffer
- Climb list with grade, sent/attempted, tries

Edge cases:

- A session whose last climb is less than 2 hours old is skipped (still in progress).
- Sessions already in the state store are skipped.

## Effort engine

Three signals combine into an RPE-style 1-10 score:

1. **Grade-weighted volume.** `points = 2^(grade/2)` per climb (V0=1, V2=2, V4=4, V6=8, V8=16).
   Sends count full points; failed attempts (bids) count 40%.
   Flashes count the same as sends.
2. **Intensity relative to the climber.** Session points normalized against the user's own last ~8 weeks: rolling max grade and median session points.
   Normalized load = session points / median session points.
3. **Density.** Climbs per active hour from timestamp gaps.
   Tight spacing raises effort; long internal rests discount the density term but never the volume term.

Scoring:

- Base = normalized load mapped through a curve where the user's median session lands at ~6.
- Density nudges up to +1 (high) or -1 (casual pace).
- Attempting at or above rolling max grade nudges up (projecting sessions feel maximal even at low volume).

Title mapping: 1-3 "Easy board spin", 4-5 "Casual board session", 6-7 "Solid board session", 8-9 "Hard board session", 10 "Max effort board session", suffixed with facts: "Hard board session · 18 climbs, top V7".

All thresholds (point curve, bid weight, gap threshold, density bands, buffers) live in one config struct with defaults.

## Strava publisher

Auth: user creates a Strava API application once; client ID + secret in config.
`connect strava` runs the authorization-code flow via a localhost listener (scope `activity:write`), stores access + refresh tokens, auto-refreshes on expiry.
The hosted version uses the same flow with a real callback domain.

Publishing: `POST /api/v3/activities` per session with:

- `sport_type: "RockClimbing"`, `trainer: false`
- `name`: effort title
- `start_date_local`, `elapsed_time` from the session builder
- `description`: "RPE 8/10 · 14 sends, 9 attempts · V4-V7 · synced from Tension Board"

Rate limits (200 requests per 15 minutes) are only relevant for backfill; the publisher spaces requests and resumes after a cap.

## State store

SQLite at `~/.tension-strava-sync/state.db`.
`sessions` table keyed by deterministic fingerprint (user ID + session start time) mapping to Strava activity ID, posted-at, and effort score.
A fingerprint is inserted only after Strava confirms creation, so a crash mid-run re-posts safely and never duplicates.

## CLI

- `connect tension` / `connect strava` - one-time auth
- `preview [--all|--since DATE]` - dry-run: sessions, scores, titles; posts nothing
- `sync [--since DATE]` - post new sessions; default is only-new-from-today
- `sync --all` - backfill the entire ascent history; shows a preview count and confirm prompt first
- `install-schedule` - writes a launchd agent running `sync` every 4 hours

## Testing

- Unit tests on session grouping and effort scoring against fixture ascent data.
- Aurora and Strava clients tested against recorded HTTP fixtures.
- E2E: `preview --all` against the live Tension account before the first real post.

## Future (hosted service)

Out of scope now, but shaping decisions above: pure core packages, per-user config, OAuth flow that works with a real domain, credentials stored encrypted per user instead of Keychain.
