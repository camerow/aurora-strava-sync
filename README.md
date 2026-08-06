# sendtally

Sync your climbing sessions from any Aurora Climbing board app (Tension, Kilter, Aurora, Decoy, Grasshopper, So iLL, Touchstone) to Strava as `RockClimbing` activities.
Every logged ascent and attempt is pulled from the board's API, grouped into sessions, scored for effort on an RPE-style 1-10 scale, and posted to Strava with an effort-based title and per-climb log.

sendtally is a monorepo:

| Path                    | What                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `apps/web`              | Web app (React Router 7 on Cloudflare Workers): marketing, connect flows, dashboard |
| `apps/mobile`           | Expo app (iOS + Android)                                                            |
| `packages/core`         | Pure domain logic: session grouping, grade mapping, effort scoring                  |
| `packages/sync-service` | Hono Worker: API, cron + queue sync pipeline, D1                                    |
| `packages/api-client`   | Typed API client shared by web and mobile                                           |
| `packages/design`       | Design tokens + shared Tailwind config                                              |
| `packages/ui-native`    | NativeWind component kit for mobile                                                 |
| `tools/cli-go`          | The original single-user macOS CLI ([its README](tools/cli-go/README.md))           |

See [AGENTS.md](AGENTS.md) for architecture and conventions.

## Development

Toolchain versions are pinned in `.prototools` ([proto](https://moonrepo.dev/proto)); the package manager is pnpm.

```bash
proto use          # install pinned toolchain
pnpm install
pnpm dev           # run everything
pnpm test          # run all tests
```

## License

[MIT](LICENSE)
