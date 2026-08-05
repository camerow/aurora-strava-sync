# aurora-strava-sync

Sync your climbing sessions from any Aurora Climbing board app to Strava as `RockClimbing` activities.

Every logged ascent and attempt is pulled from the board's API, grouped into sessions by time gaps, and scored for effort on an RPE-style 1-10 scale.
Each session posts to Strava with an effort-based title, a per-climb log in the description, and the score wired into Strava's native perceived exertion field so effort trends chart over time.

```
Solid climbing session · 9 climbs, top V8

RPE 7/10 · 7 sends, 2 attempts · V4-V8 · avg V5.8
✓ V4 Jug Life
✓ V8 Crimp Reaper
✗ V8 Mind Meld (3 tries)
...
synced by aurora-strava-sync
```

## Supported boards

Works with every board on the Aurora Climbing platform:

| Board | Config name |
|---|---|
| Tension Board | `tension` (default) |
| Kilter Board | `kilter` |
| Aurora Board | `aurora` |
| Decoy Board | `decoy` |
| Grasshopper Board | `grasshopper` |
| So iLL Board | `soill` |
| Touchstone Board | `touchstone` |

All Aurora boards speak the same API on their own domains; this tool talks to the API directly, so the mobile app does not need to be installed.

## How effort scoring works

Each climb earns points that grow exponentially with V-grade (`2^(grade/2)`), with failed attempts earning 40% of a send.
Session points are normalized against your own recent history (rolling 8-week median), so the same session scores differently for a V4 climber and a V8 climber, and your median session lands around RPE 6.
Climb density (climbs per hour) nudges the score up or down, and climbing above your recent max grade adds a bump.

Titles reflect the session's character: limit-style sessions range from "Easy climbing session" to "Max effort climbing session", while high-scoring sessions whose top grade sits well below your max are labeled "High volume" or "Max volume" instead.

## Requirements

- Go 1.22 or newer to build
- macOS (board credentials go in the Keychain; scheduling uses launchd)
- A free [Strava API application](https://www.strava.com/settings/api)

## Build

```bash
git clone https://github.com/camerow/aurora-strava-sync.git
cd aurora-strava-sync
go install ./cmd/aurora-strava-sync
```

The binary lands in `$(go env GOPATH)/bin` (usually `~/go/bin`); make sure that is on your `PATH`.

## Configure

Create a Strava API application at [strava.com/settings/api](https://www.strava.com/settings/api).
Set the Authorization Callback Domain to exactly `localhost` (no scheme, port, or path), and use any URL you like for Website.

Then create the config file:

```bash
mkdir -p ~/.aurora-strava-sync
chmod 700 ~/.aurora-strava-sync
$EDITOR ~/.aurora-strava-sync/config.toml
```

```toml
[aurora]
board = "tension"        # see Supported boards table
username = "your-board-username"

[strava]
client_id = "12345"
client_secret = "your-strava-client-secret"
```

Restrict it to your user: `chmod 600 ~/.aurora-strava-sync/config.toml`.

## Run

```bash
aurora-strava-sync connect board    # log in to your board account (token stored in Keychain)
aurora-strava-sync connect strava   # browser OAuth flow (scope: activity:write + activity:read_all)
aurora-strava-sync preview --all    # dry run: shows every session, score, and title; posts nothing
aurora-strava-sync sync --all       # backfill your full history to Strava (asks for confirmation)
aurora-strava-sync install-schedule # launchd job runs sync every 4 hours
```

Day to day you do nothing: the scheduled sync picks up new sessions about 2 hours after you finish climbing (sessions still in progress are never posted early).

Other useful invocations:

- `aurora-strava-sync sync` posts only new sessions (on a fresh install, only from today onwards)
- `aurora-strava-sync sync --since 2026-07-01` posts sessions from a date onwards
- `aurora-strava-sync preview` dry-runs whatever `sync` would post

Every posted session is fingerprinted in a local SQLite database, so re-running sync never creates duplicate activities, and an interrupted backfill resumes where it left off (Strava rate limits pause the run cleanly).

## State and logs

| Path | Contents |
|---|---|
| `~/.aurora-strava-sync/config.toml` | your configuration |
| `~/.aurora-strava-sync/state.db` | posted-session fingerprints and climb data cache |
| `~/.aurora-strava-sync/strava-tokens.json` | Strava OAuth tokens (0600) |
| `~/.aurora-strava-sync/sync.log` | output of scheduled runs |
| macOS Keychain (`aurora-strava-sync`) | board API token |

## Caveats

- This uses the Aurora boards' private API (the same one the mobile apps use), reverse-engineered by the [BoardLib](https://github.com/lemeryfertitta/BoardLib) community; it is unofficial and could break if Aurora changes the API.
- New Strava API applications are limited to one connected athlete until Strava grants a quota increase, which is fine for personal use.
- Board timestamps are wall-clock local time; the tool assumes you climb in the time zone your machine is set to.

## License

[MIT](LICENSE)
