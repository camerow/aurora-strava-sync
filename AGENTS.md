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

| Decision          | Choice                                                                                                                                                                                        | Why                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product shape     | Multi-user SaaS                                                                                                                                                                               | Domain, auth, and mobile apps only make sense multi-user                                                                                               |
| Serving language  | TypeScript port of the Go engine                                                                                                                                                              | Workers-native; the pure logic is ~800 lines and becomes shareable across service, web, and mobile                                                     |
| Hosting           | Cloudflare for everything possible                                                                                                                                                            | Workers, D1, Queues, Cron Triggers, custom domains, DNS                                                                                                |
| Sync trigger      | Cron Trigger + Cloudflare Queue fan-out (hourly), plus a manual sync-now endpoint                                                                                                             | Aurora has no webhooks; polling is the only option. Queues give per-user isolation and retries. No Durable Objects until a proven need                 |
| Board credentials | Never store passwords. Pass-through login at connect time; persist only the long-lived board API token, AES-GCM encrypted at rest (key in Worker secret, ciphertext in D1)                    | Same policy for Strava refresh tokens. "We never store your board password" must stay true                                                             |
| Database          | Single shared D1 database, `user_id` keys everywhere. No per-user databases                                                                                                                   | Tiny per-user data; cross-user queries needed; one migration stream                                                                                    |
| Climb cache       | Per-board shared cache (one per Aurora board), refreshed lazily via the cursor sync API when a user's sync references missing climbs                                                          | Board data is per-board, not per-user. Polls Aurora once per board instead of once per user - protects us from being blocked on their private API      |
| Derived data      | Computed sessions and effort results are persisted in D1 per user                                                                                                                             | App reads (session list, future trends) never re-hit Aurora or recompute. Avoid external API calls wherever derived data suffices                      |
| Auth              | Clerk, headless mode (their hooks, our components), email one-time codes (magic links dropped: Clerk production defaults to codes, and links break when opened in a different browser client) | First-class Expo SDK; Workers-side JWT verification via `@clerk/backend`. The Clerk user ID (`sub`) is the user key in D1 - no parallel identity table |
| Web framework     | React Router 7 (framework mode) on Cloudflare Workers, one app for marketing + dashboard                                                                                                      | The path Cloudflare paves; SSR for SEO. Next-on-OpenNext adapter tax rejected; Expo web rejected for SEO                                               |
| Mobile            | Expo (iOS + Android only, no Expo web), EAS builds                                                                                                                                            |                                                                                                                                                        |
| API layer         | Hono on Workers with `hono/client` RPC, Zod validation at the edges                                                                                                                           | End-to-end types into Expo and web with no codegen. fetch + scheduled + queue handlers in one Worker: the whole backend is one deployable              |
| Design system     | Shared tokens, platform-native components. No universal component library (no Tamagui/gluestack)                                                                                              | See Design system section                                                                                                                              |
| Theming           | Single theme. No light/dark mode                                                                                                                                                              | Ignore dark-mode machinery entirely                                                                                                                    |
| Notifications     | Expo push only for v1. Reconnect prompts always on; sync-result pushes off by default                                                                                                         | Every user has the app; Clerk owns the only email we send (magic links)                                                                                |
| Strava deauth     | Subscribe to Strava's deauthorization webhook from day one                                                                                                                                    | Mark connections dead immediately instead of via failed posts                                                                                          |
| Pricing           | Free. Ad revenue path (web content pages first)                                                                                                                                               | Keep infra on free tiers; SEO web content is the ad surface                                                                                            |

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
│   ├── design/          design tokens (CSS variables) + React component library
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
- **The Cloudflare account is pinned as `account_id` in both `wrangler.jsonc` files** (`7b398a51...`, the account that owns the `sendtally.com` zone). The login has access to a second, unrelated account, and without the pin wrangler can resolve to it - deploys and `secret bulk` then silently land on a shadow Worker in an account with no zone and no D1, while `tail` watches nothing and the live site never changes. Never remove the pin.
- `staging` is the integration branch, `main` is production. All work branches off `staging` and PRs target `staging`. `main` is updated only via the `staging -> main` promotion PR, which triggers the production deploy and D1 migrations.
- D1 migrations: `wrangler d1 migrations apply`, additive and forward-only. Never delete or rewrite prior migrations.
- Schema source of truth is Drizzle (`packages/sync-service/src/db/schema.ts`).
  Change the schema there, then run `pnpm --filter @sendtally/sync-service db:generate` to emit the next migration into `migrations/` (drizzle-kit diffs against `migrations/meta/`; `0005_drizzle_baseline.sql` anchors the pre-Drizzle history).
  Wrangler remains the applier - CI applies migrations on every deploy, and PR CI validates them against a fresh local D1.
  Never hand-write migration SQL for schema changes; never edit `migrations/meta/` by hand.
- Database access goes through the typed Drizzle queries in `packages/sync-service/src/lib/repo.ts` - no raw SQL strings in Worker code.
- CI: `.github/workflows/deploy.yml` runs checks (types, tests, format, Go) then deploys both Workers - push to `staging` deploys the staging env, push to `main` deploys production. Needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets. Each deploy is gated on a secret preflight and followed by a smoke check against the live custom domain, so a green run means the deployed code actually answers.

### Secrets

- Source of truth is the **Doppler project `sendtally`** (configs `stg` and `prd`): `TOKEN_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN`.
- Push to Workers with `doppler secrets download --no-file --format json --project sendtally --config <stg|prd> | ... | wrangler secret bulk --env <staging|production>`. Never paste secret values into files, commits, or chat.
- **Both Workers need secrets, so run that push twice.** From `packages/sync-service`: `TOKEN_KEY`, `CLERK_SECRET_KEY`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN`. From `apps/web`: `CLERK_SECRET_KEY` - `apps/web` renders every route through `clerkMiddleware()`, so without it the Worker throws on every request and the whole site 500s while the deploy still reports success.
- Secrets live on the Worker, not in the config, so **a Worker deleted and recreated in the dashboard comes back with none of them**. `deploy.yml` runs `.github/scripts/require-secrets.sh` before each deploy to fail loudly instead of shipping a Worker that 500s.
- The Strava credentials originate from the maker's Strava API app; Clerk keys from the Clerk dashboard (kept in 1Password, vault "Send Tally").

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

1. `@sendtally/design`: CSS-variable tokens (`styles.css` + `tokens/`) and a typed React component library (Logo, Button, Input, Badge, Label, Card, SpecRow, StatStrip, GradeBars, ActivityCard, RpeMeter, ClimbLog), both synced from the "Sendtally Design System" project on claude.ai/design via the DesignSync tool. That project is the design source of truth - read its `readme.md` (voice, contrast rules, iconography, layout) before designing anything new. Note: its internal copy still says "boardsync"; the code here is renamed to sendtally.
2. Web: consumes `@sendtally/design` components directly (inline styles driven by the tokens - no Tailwind, no shadcn; the design system ships its own components). Clerk headless hooks get skinned with these.
3. Native: NativeWind 4 + a small hand-rolled kit in `@sendtally/ui-native` (button, card, list row, stat tile, sheet, input, ...). No pre-built RN component library.

`bg-primary` must mean the same color on both platforms.
Design work (Claude-generated or otherwise) targets the token vocabulary; each platform implements idiomatically.

## Migration order

1. ~~Restructure commit: move the Go CLI to `tools/cli-go/`, scaffold pnpm + Turborepo at the root.~~ Done.
2. `@sendtally/core`: port `grades`, `session`, `effort` with table-driven Vitest tests mirroring the Go tests.
3. `@sendtally/sync-service`: Aurora + Strava clients, D1 schema, connect flows, cron + queue pipeline. Code complete with local D1 tests; the single-athlete end-to-end run awaits Cloudflare account setup (D1 databases, queues, secrets, Clerk keys).
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

### Code organization

- Features live in colocated directories: everything a feature needs (components, hooks, transforms, tests) sits together in one directory named for the feature.
- Types exported for reuse go in a `types.ts` next to the file that uses them - not in a distant shared types module, and not inline in a component file when other files import them.
- One component per file, named after the file.
- Components generic to a feature (used by several of its screens/sections but nowhere else) live in a `components/` directory inside that feature.
- When a component is used across many features, move it up to the highest relevant directory - the app-level `components/`, or `@sendtally/design` if it belongs to the design system.
- Tests co-located as `<Component>.test.tsx` / `<module>.test.ts`.

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
