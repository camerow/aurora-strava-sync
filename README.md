# sendtally

A climbing log with effort tracking. Record each session (climbs, grades, sends and attempts) in the app; every session is scored for effort on an RPE-style 1-10 scale and can optionally be posted to Strava as a `RockClimbing` activity with an effort-based title and per-climb log.

Sessions are entered by the user through the log-session form. sendtally does not import data from board apps or any other third party. The original Aurora Climbing board integration was discontinued in September 2026 at Aurora's request; see [AGENTS.md](AGENTS.md).

sendtally is a monorepo:

| Path                    | What                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `apps/web`              | Web app (React Router 7 on Cloudflare Workers): marketing, Strava connect, dashboard |
| `apps/mobile`           | Expo app (iOS + Android)                                                             |
| `packages/core`         | Pure domain logic: session grouping, grade mapping, effort scoring                   |
| `packages/sync-service` | Hono Worker: API, Strava posting, D1                                                 |
| `packages/api-client`   | Typed API client shared by web and mobile                                            |
| `packages/design`       | Design tokens + shared Tailwind config                                               |
| `packages/ui-native`    | NativeWind component kit for mobile                                                  |
| `tools/cli-go`          | The original single-user macOS CLI ([its README](tools/cli-go/README.md))            |

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
