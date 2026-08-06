# sendtally - Agent Guidelines

## Project Overview

sendtally is a multi-user service that syncs climbing sessions from Aurora Climbing board apps (Tension, Kilter, Aurora, Decoy, Grasshopper, So iLL, Touchstone) to Strava as `RockClimbing` activities.
Every logged ascent and attempt is pulled from the board's API, grouped into sessions by time gaps, scored for effort on an RPE-style 1-10 scale, and posted to Strava with an effort-based title and per-climb log.

The product is free for users; the monetization path is ad revenue (SEO content pages on the web app first, mobile ads later).
The core user value beyond sync is the effort/RPE trend history - "Strava for board climbing effort".

v1 scope: sign up, connect board account, connect Strava, automatic background sync, session list in the mobile app.
Trends/dashboards come after v1.

## Two implementations live in this repo

1. **The hosted service** (target architecture below): TypeScript monorepo, Cloudflare-hosted, Expo mobile apps. This is the product.
2. **The Go CLI** (`tools/cli-go/`): the original single-user macOS tool. It stays as Will's personal utility and as the reference implementation for the domain logic. Do not delete it; do not grow it beyond personal-utility scope. Its packages (`session`, `effort`, `grades`, `aurora`, `strava`, `store`) are the acceptance spec for the TypeScript port - same fixtures, same expected RPEs.

---

## Architecture decisions (settled - do not relitigate without Will)

| Decision          | Choice                                                                                                                                                                     | Why                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product shape     | Multi-user SaaS                                                                                                                                                            | Domain, auth, and mobile apps only make sense multi-user                                                                                               |
| Serving language  | TypeScript port of the Go engine                                                                                                                                           | Workers-native; the pure logic is ~800 lines and becomes shareable across service, web, and mobile                                                     |
| Hosting           | Cloudflare for everything possible                                                                                                                                         | Workers, D1, Queues, Cron Triggers, custom domains, DNS                                                                                                |
| Sync trigger      | Cron Trigger + Cloudflare Queue fan-out (hourly), plus a manual sync-now endpoint                                                                                          | Aurora has no webhooks; polling is the only option. Queues give per-user isolation and retries. No Durable Objects until a proven need                 |
| Board credentials | Never store passwords. Pass-through login at connect time; persist only the long-lived board API token, AES-GCM encrypted at rest (key in Worker secret, ciphertext in D1) | Same policy for Strava refresh tokens. "We never store your board password" must stay true                                                             |
| Database          | Single shared D1 database, `user_id` keys everywhere. No per-user databases                                                                                                | Tiny per-user data; cross-user queries needed; one migration stream                                                                                    |
| Climb cache       | Per-board shared cache (one per Aurora board), refreshed by its own cron using the cursor sync API                                                                         | Board data is per-board, not per-user. Polls Aurora once per board instead of once per user - protects us from being blocked on their private API      |
| Derived data      | Computed sessions and effort results are persisted in D1 per user                                                                                                          | App reads (session list, future trends) never re-hit Aurora or recompute. Avoid external API calls wherever derived data suffices                      |
| Auth              | Clerk, headless mode (their hooks, our components), magic links                                                                                                            | First-class Expo SDK; Workers-side JWT verification via `@clerk/backend`. The Clerk user ID (`sub`) is the user key in D1 - no parallel identity table |
| Web framework     | React Router 7 (framework mode) on Cloudflare Workers, one app for marketing + dashboard                                                                                   | The path Cloudflare paves; SSR for SEO. Next-on-OpenNext adapter tax rejected; Expo web rejected for SEO                                               |
| Mobile            | Expo (iOS + Android only, no Expo web), EAS builds                                                                                                                         |                                                                                                                                                        |
| API layer         | Hono on Workers with `hono/client` RPC, Zod validation at the edges                                                                                                        | End-to-end types into Expo and web with no codegen. fetch + scheduled + queue handlers in one Worker: the whole backend is one deployable              |
| Design system     | Shared tokens, platform-native components. No universal component library (no Tamagui/gluestack)                                                                           | See Design system section                                                                                                                              |
| Theming           | Single theme. No light/dark mode                                                                                                                                           | Ignore dark-mode machinery entirely                                                                                                                    |
| Notifications     | Expo push only for v1. Reconnect prompts always on; sync-result pushes off by default                                                                                      | Every user has the app; Clerk owns the only email we send (magic links)                                                                                |
| Strava deauth     | Subscribe to Strava's deauthorization webhook from day one                                                                                                                 | Mark connections dead immediately instead of via failed posts                                                                                          |
| Pricing           | Free. Ad revenue path (web content pages first)                                                                                                                            | Keep infra on free tiers; SEO web content is the ad surface                                                                                            |

## Monorepo structure (target)

```
sendtally/
├── apps/
│   ├── mobile/          Expo (iOS + Android), EAS builds
│   └── web/             React Router 7 on Workers: marketing, SEO content, connect flows, dashboard
├── packages/
│   ├── core/            ported session/effort/grades logic - pure, no I/O, no platform deps
│   ├── sync-service/    Hono Worker: API + cron + queue consumer + D1 schema/migrations
│   ├── api-client/      typed hono/client wrapper consumed by mobile and web
│   ├── design/          design tokens + shared Tailwind config
│   └── ui-native/       NativeWind component kit for mobile
└── tools/
    └── cli-go/          the original Go CLI (go.mod lives here)
```

- **Package manager:** `pnpm`. Never `npm` or `yarn`.
- **Build system:** Turborepo. Tasks run from the repo root: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm check-types`, `pnpm test`, `pnpm format`.
- **Toolchain versions:** pinned in `.prototools` (proto manages Node and Go here; this repo does not use asdf).
- **Package scope:** every workspace package is `@sendtally/*` (e.g. `@sendtally/core`, `@sendtally/sync-service`). Never introduce another scope.

### Domain and routing

Domain: `sendtally.com`, purchased and DNS-hosted on Cloudflare.
The product was briefly named boardsync; that name was dropped because `boardsync.com` is held by an unrelated party and `boardsync.app` is registry-premium and not sellable via Cloudflare Registrar.
`sendtally.app` is worth registering too as a redirect if it is standard-priced.

- `sendtally.com`: `apps/web` (Workers custom domain)
- `api.sendtally.com`: `packages/sync-service` Worker

### Environments and deploys

- Wrangler environments `staging` and `production` for `sync-service` and `web`: separate D1 databases, separate Clerk instances, secrets via `wrangler secret`.
- `staging` is the integration branch, `main` is production. All work branches off `staging` and PRs target `staging`. `main` is updated only via the `staging -> main` promotion PR, which triggers the production deploy and D1 migrations.
- D1 migrations: `wrangler d1 migrations apply`, additive and forward-only. Never delete or rewrite prior migrations.

## The sync pipeline (hosted)

The domain flow ports directly from the Go CLI:

1. Cron (hourly) enqueues one queue message per user due for sync.
2. The queue consumer pulls the user's ascents/bids from their board via the cursor sync API.
3. Climb names/grades resolve from the shared per-board cache (its own cron keeps it fresh).
4. `@sendtally/core` groups climbs into sessions (90-minute gap, warmup/cooldown buffers) and excludes sessions inside the in-progress window (~2h) so an ongoing session is never posted early.
5. `@sendtally/core` scores each session against the user's rolling 8-week history and produces RPE, title, and description.
6. Unposted sessions post to Strava; perceived exertion is patched in a second call (the create endpoint ignores the field).

Invariants that must survive the port:

- Session identity is `fingerprint(userID, firstClimb.rawTime)`: tuning gap/buffer config must never change identity or cause duplicate posts.
- Dedup lives in the database (`is_posted` checked before, `mark_posted` after). Retries, overlapping runs, and resumed backfills are always safe.
- Strava rate limiting is a clean pause, not an error; the queue retry picks the user back up.
- Unknown grades are `-1` and score conservatively as V1.
- Keep the "synced by sendtally" attribution line in activity descriptions (Strava attribution expectations).

## Strava operational constraints

- New Strava API apps are capped at one connected athlete until Strava approves a quota increase. Build order: the service runs single-athlete (Will) first; multi-user launch is gated on Strava approval, which requires a working branded app.
- Handle `ErrRateLimited` per the invariant above; Strava limits are per-app, so backoff is global, not per-user.
- The deauthorization webhook endpoint lives on the sync-service Worker.

## Design system

Three layers; the tokens file is the contract between platforms.

1. `@sendtally/design`: colors, spacing scale, type scale, radii as plain TS/CSS variables, consumed by one shared Tailwind config. Single theme, no light/dark.
2. Web: Tailwind v4 + shadcn/ui components copied in and restyled from the tokens. The components are ours to edit. Clerk headless hooks get skinned with these.
3. Native: NativeWind 4 + a small hand-rolled kit in `@sendtally/ui-native` (button, card, list row, stat tile, sheet, input, ...). No pre-built RN component library.

`bg-primary` must mean the same color on both platforms.
Design work (Claude-generated or otherwise) targets the token vocabulary; each platform implements idiomatically.

## Migration order

1. ~~Restructure commit: move the Go CLI to `tools/cli-go/`, scaffold pnpm + Turborepo at the root.~~ Done.
2. `@sendtally/core`: port `grades`, `session`, `effort` with table-driven Vitest tests mirroring the Go tests.
3. `@sendtally/sync-service`: Aurora + Strava clients, D1 schema, connect flows, cron + queue pipeline. Run single-athlete end to end.
4. `apps/web`: marketing page, Clerk sign-in, connect flows, minimal dashboard.
5. `apps/mobile`: Expo app - onboarding, connect flows, session list, push notifications.
6. Apply for the Strava quota increase; open sign-ups on approval.

---

## Coding conventions

### TypeScript

- `strict: true` at the root tsconfig. Do not relax it.
- No `any`. Use `unknown` and narrow.
- Explicit return types on all exported functions and React components.
- Prefer `type` over `interface` unless declaration merging is needed.
- Zod at every I/O boundary (API input, external API responses, queue messages).

### React components

- One file per component, named after the file.
- Component directories once a component needs helpers (hooks, transforms, constants alongside).
- Tests co-located as `<Component>.test.tsx`.
- `components/ui/*` (shadcn primitives) follow upstream kebab-case layout; leave that convention alone.

### Formatting

Prettier owns formatting; config at `.prettierrc` in the repo root.
Run `pnpm format` before committing.
Avoid comments in code; make code short, composable, and obviously named.

### Go CLI (`tools/cli-go/`)

- Standard `gofmt` / `go vet`. Pure stdlib style.
- `go test ./...` from `tools/cli-go/`; single test: `go test ./effort -run TestName`.
- Changes here are maintenance-only; new product work happens in TypeScript.

---

## Git

- Conventional Commits: `feat|fix|refactor|style|test|chore|docs|perf(scope): description`.
- Branch naming: `feat|chore|bug|refactor/<feature-name>` off `staging`. No agent names or AI metadata in branch names.
- No AI co-author trailers in commit messages.
- PR descriptions: short clear paragraphs, bullet lists for completed tasks, `Closes #123` where an issue exists.

### Worktrees

Use **workmux** for all worktree creation and lifecycle (`workmux add` / `merge` / `remove`).
Configuration lives in `.workmux.yaml` at the repo root.
Never hand-roll `git worktree add`.

---

## Security notes

- Board passwords transit the Worker only during connect; they are never logged or persisted.
- Tokens (board + Strava refresh) are AES-GCM encrypted in D1; the key lives in a Worker secret.
- Account deletion must revoke the Strava token, delete all D1 rows for the user, and delete the Clerk user.
