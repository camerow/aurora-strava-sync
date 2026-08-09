# In-Progress Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a just-finished climbing session appear in sendtally immediately, while keeping the existing 120-minute delay before it posts to Strava.

**Architecture:** `buildSessions` stops discarding sessions inside the in-progress window and instead flags them with `inProgress`. The sync pipeline persists every session but skips in-progress ones when posting to Strava. The API derives `inProgress` at read time from the stored `end_at`, so there is no new column and no migration. The app shows an `IN PROGRESS` badge.

**Tech Stack:** TypeScript, Vitest, Hono on Cloudflare Workers, D1 via Drizzle, React Router 7 (web), Expo/React Native (mobile).

**Spec:** `docs/superpowers/specs/2026-08-08-in-progress-sessions-design.md`

## Global Constraints

- Package manager is `pnpm`. Never `npm` or `yarn`.
- `strict: true` TypeScript. No `any`; use `unknown` and narrow.
- Explicit return types on all exported functions and React components.
- Prefer `type` over `interface`.
- Avoid comments in code. Prefer short, composable, obviously named code.
- Never use the em dash. Use a hyphen instead.
- Run `pnpm format` before committing. Prettier owns formatting.
- Conventional Commits: `feat|fix|refactor|test|chore|docs(scope): description`.
- No AI co-author trailers in commit messages.
- Branch is `feat/in-progress-sessions`, already created off the latest `origin/staging`.
- Session identity is `fingerprint(boardUserId, firstClimb.time)` and must never change. It is anchored on the first climb, so a growing session keeps its identity.
- Do not change grouping, `start`, or `end` for any completed session. Go CLI fixtures are the acceptance spec.

---

### Task 1: Core - flag in-progress sessions instead of dropping them

**Files:**

- Modify: `packages/core/src/session.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/session.test.ts`
- Modify (type fix): `packages/core/src/effort.test.ts`

**Interfaces:**

- Produces: `Session` gains a required `inProgress: boolean` field.
- Produces: `isInProgress(end: Date, cfg: SessionConfig, now: Date): boolean`, exported from `@sendtally/core`. Takes a session `end` (last climb plus the cooldown buffer) and reports whether the session is still inside the in-progress window. Used by both `buildSessions` and the API read layer so the window rule has one definition.

- [ ] **Step 1: Write the failing tests**

In `packages/core/src/session.test.ts`, replace the existing test named `"skips sessions still inside the in-progress window"` with the two tests below. Keep every other test in the file exactly as it is.

```typescript
it("flags sessions still inside the in-progress window", () => {
  const climbs: Climb[] = [{ time: at(10, 0), vGrade: 4, name: "", kind: "send", tries: 1 }];

  const fresh = buildSessions(climbs, defaultSessionConfig(), at(11, 0));
  expect(fresh).toHaveLength(1);
  expect(fresh[0]?.inProgress).toBe(true);

  const settled = buildSessions(climbs, defaultSessionConfig(), at(12, 30));
  expect(settled).toHaveLength(1);
  expect(settled[0]?.inProgress).toBe(false);
});

it("keeps boundaries unchanged for an in-progress session", () => {
  const climbs: Climb[] = [{ time: at(10, 0), vGrade: 4, name: "", kind: "send", tries: 1 }];
  const got = buildSessions(climbs, defaultSessionConfig(), at(11, 0));
  expect(got[0]?.start).toEqual(at(9, 50));
  expect(got[0]?.end).toEqual(at(10, 5));
});
```

Then add this test to the same file, inside the `describe("buildSessions", ...)` block:

```typescript
it("flags only the trailing session when an older one is complete", () => {
  const climbs: Climb[] = [
    { time: at(10, 0), vGrade: 4, name: "", kind: "send", tries: 1 },
    { time: at(15, 0), vGrade: 5, name: "", kind: "send", tries: 1 },
  ];
  const got = buildSessions(climbs, defaultSessionConfig(), at(16, 0));
  expect(got).toHaveLength(2);
  expect(got[0]?.inProgress).toBe(false);
  expect(got[1]?.inProgress).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sendtally/core test`

Expected: FAIL. The `flags sessions still inside the in-progress window` case fails on `expect(fresh).toHaveLength(1)` receiving `0`, because `buildSessions` currently drops in-progress sessions.

- [ ] **Step 3: Add the `inProgress` field and the `isInProgress` helper**

In `packages/core/src/session.ts`, add `inProgress` to the `Session` type:

```typescript
export type Session = {
  start: Date;
  end: Date;
  climbs: Climb[];
  inProgress: boolean;
};
```

Add this exported function immediately after `defaultSessionConfig`:

```typescript
export function isInProgress(end: Date, cfg: SessionConfig, now: Date): boolean {
  return now.getTime() - (end.getTime() - cfg.cooldownBufferMs) < cfg.inProgressWindowMs;
}
```

The stored `end` is the last climb plus the cooldown buffer, so subtracting the buffer recovers the last climb time exactly.

- [ ] **Step 4: Make `buildSessions` push every session**

In `packages/core/src/session.ts`, replace the `flush` function with:

```typescript
const flush = (): void => {
  const last = group[group.length - 1]!;
  const end = new Date(last.time.getTime() + cfg.cooldownBufferMs);
  sessions.push({
    start: new Date(group[0]!.time.getTime() - cfg.warmupBufferMs),
    end,
    climbs: group,
    inProgress: isInProgress(end, cfg, now),
  });
};
```

The early `return` is gone. Everything else in `buildSessions` stays exactly as it is.

- [ ] **Step 5: Export the helper**

In `packages/core/src/index.ts`, change the session export block to:

```typescript
export {
  buildSessions,
  defaultSessionConfig,
  isInProgress,
  type Climb,
  type ClimbKind,
  type Session,
  type SessionConfig,
} from "./session";
```

- [ ] **Step 6: Fix the Session literals in the effort tests**

`inProgress` is now required, so the four `Session` values built in `packages/core/src/effort.test.ts` no longer type-check. These sessions are all historical fixtures, so each gets `inProgress: false`.

In `mkSession`, change the returned object to:

```typescript
return {
  start: new Date(first.time.getTime() - 10 * 60_000),
  end: new Date(last.time.getTime() + 5 * 60_000),
  climbs,
  inProgress: false,
};
```

In the test `"weights attempts at the bid weight"`:

```typescript
const s: Session = {
  start: at(1, 18, 0),
  end: at(1, 19, 0),
  climbs: [
    { time: at(1, 18, 0), vGrade: 4, name: "", kind: "send", tries: 1 },
    { time: at(1, 18, 10), vGrade: 4, name: "", kind: "attempt", tries: 1 },
  ],
  inProgress: false,
};
```

In the test `"renders the summary stats line and climb log"`:

```typescript
const s: Session = {
  start: at(1, 17, 50),
  end: at(1, 18, 25),
  climbs: [
    { time: at(1, 18, 0), vGrade: 4, name: "Jug Life", kind: "send", tries: 1 },
    { time: at(1, 18, 10), vGrade: 7, name: "Crimp Reaper", kind: "send", tries: 1 },
    { time: at(1, 18, 20), vGrade: 7, name: "Crimp Reaper", kind: "attempt", tries: 3 },
  ],
  inProgress: false,
};
```

In the test `"omits grade stats when no grades are known"`:

```typescript
const s: Session = {
  start: at(1, 17, 50),
  end: at(1, 18, 5),
  climbs: [{ time: at(1, 18, 0), vGrade: -1, name: "", kind: "attempt", tries: 1 }],
  inProgress: false,
};
```

If `tsc` reports any further `Session` literal missing `inProgress`, add `inProgress: false` to it. Historical fixtures are never in progress.

- [ ] **Step 7: Run tests and type-check to verify they pass**

Run: `pnpm --filter @sendtally/core test && pnpm --filter @sendtally/core check-types`

Expected: PASS. All `buildSessions` and `effort` tests green, no type errors. The unchanged effort tests passing is the proof that scoring for completed sessions did not move.

- [ ] **Step 8: Commit**

```bash
pnpm format
git add packages/core/src/session.ts packages/core/src/index.ts packages/core/src/session.test.ts packages/core/src/effort.test.ts
git commit -m "feat(core): flag in-progress sessions instead of dropping them"
```

---

### Task 2: Pipeline - persist in-progress sessions, hold the Strava post

**Files:**

- Modify: `packages/sync-service/src/pipeline.ts`
- Test: `packages/sync-service/test/pipeline.test.ts`

**Interfaces:**

- Consumes: `Session.inProgress` from Task 1.
- Produces: no signature changes. `syncOneUser(env, userId, fetchImpl?, board?)` keeps returning `{ status, posted }`. A sync whose only session is in progress returns `{ status: "synced", posted: 0 }` and writes the session row with `strava_activity_id` null.

- [ ] **Step 1: Write the failing tests**

Add this helper to `packages/sync-service/test/pipeline.test.ts`, directly below the existing `auroraRoutes` function:

```typescript
function auroraTime(d: Date): string {
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}.000000`;
}

function auroraRoutesAt(minutesAgo: number): FakeRoute[] {
  const climbedAt = auroraTime(new Date(Date.now() - minutesAgo * 60_000));
  const [ascentsRoute, sharedRoute] = auroraRoutes() as [FakeRoute, FakeRoute];
  return [
    {
      match: ascentsRoute.match,
      respond: () =>
        jsonResponse(200, {
          ascents: [
            {
              uuid: "a1",
              climb_uuid: "c1",
              angle: 40,
              user_id: 42,
              bid_count: 1,
              difficulty: 18,
              climbed_at: climbedAt,
            },
          ],
          bids: [],
          user_syncs: [],
          _complete: true,
        }),
    },
    sharedRoute,
  ];
}
```

Then add these two tests inside the `describe("syncOneUser", ...)` block:

```typescript
it("persists a session still inside the in-progress window without posting it", async () => {
  await seedUser(userId, 51, 21);
  const { fetchImpl, calls } = makeFakeFetch([
    ...auroraRoutesAt(10),
    stravaCreateRoute(201, 3001),
    stravaPatchRoute,
  ]);

  const outcome = await syncOneUser(env, userId, fetchImpl);
  expect(outcome).toEqual({ status: "synced", posted: 0 });

  const rows = await env.DB.prepare(
    `SELECT climb_count, strava_activity_id FROM sessions WHERE user_id = ?`
  )
    .bind(userId)
    .all<{ climb_count: number; strava_activity_id: number | null }>();
  expect(rows.results).toHaveLength(1);
  expect(rows.results[0]!.climb_count).toBe(1);
  expect(rows.results[0]!.strava_activity_id).toBeNull();
  expect(stravaCreateCalls(calls)).toHaveLength(0);
});

it("posts a session once it falls outside the in-progress window", async () => {
  await seedUser(userId, 52, 22);
  const { fetchImpl, calls } = makeFakeFetch([
    ...auroraRoutesAt(180),
    stravaCreateRoute(201, 3002),
    stravaPatchRoute,
  ]);

  const outcome = await syncOneUser(env, userId, fetchImpl);
  expect(outcome).toEqual({ status: "synced", posted: 1 });
  expect(stravaCreateCalls(calls)).toHaveLength(1);

  const row = await env.DB.prepare(`SELECT strava_activity_id FROM sessions WHERE user_id = ?`)
    .bind(userId)
    .first<{ strava_activity_id: number | null }>();
  expect(row?.strava_activity_id).toBe(3002);
});
```

- [ ] **Step 2: Run tests to verify the first one fails**

Run: `pnpm --filter @sendtally/sync-service test`

Expected: FAIL on `"persists a session still inside the in-progress window without posting it"`. Before Task 1's change reaches the pipeline the session is dropped, so `rows.results` has length 0. After Task 1 the session is built but the pipeline still posts it, so `stravaCreateCalls(calls)` has length 1 and `strava_activity_id` is 3001.

- [ ] **Step 3: Exclude in-progress sessions from scoring history**

In `packages/sync-service/src/pipeline.ts`, replace the `scored` block:

```typescript
const effortCfg = defaultEffortConfig();
const completed = sessions.filter((s) => !s.inProgress);
const scored = sessions.map((sess) => ({
  sess,
  result: score(
    sess,
    completed.filter((h) => h !== sess),
    effortCfg
  ),
  fp: fingerprint(boardConn.board_user_id, sess.climbs[0]!.time),
}));
```

For a completed session this is the same history it had before: every other completed session. For an in-progress session the history is every completed session, which is what we want. Previously computed RPEs cannot shift.

- [ ] **Step 4: Hold the Strava post for in-progress sessions**

In the same file, replace the `toPost` filter:

```typescript
const toPost = scored.filter(
  (s) =>
    !s.sess.inProgress &&
    !posted.has(s.fp) &&
    (postCutoff === null || s.sess.start.getTime() >= postCutoff.getTime())
);
```

The persistence loop above it is unchanged, so every session including in-progress ones is still written to D1.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sendtally/sync-service test && pnpm --filter @sendtally/sync-service check-types`

Expected: PASS. Both new tests green, and the existing tests (`syncs, scores, posts, and is idempotent on re-run`, the rate-limit test, the board-dead test, the cache-fill test) still pass, proving completed-session behavior is unchanged.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add packages/sync-service/src/pipeline.ts packages/sync-service/test/pipeline.test.ts
git commit -m "feat(sync-service): persist in-progress sessions but hold the Strava post"
```

---

### Task 3: API - derive `inProgress` at read time

**Files:**

- Modify: `packages/sync-service/src/app.ts:184-203`
- Modify: `packages/api-client/src/types.ts`
- Test: `packages/sync-service/test/app.test.ts`

**Interfaces:**

- Consumes: `isInProgress` and `defaultSessionConfig` from `@sendtally/core` (Task 1).
- Produces: `GET /v1/sessions` and `GET /v1/sessions/:fingerprint` include `inProgress: boolean` on every session object.
- Produces: `SessionRow` in `@sendtally/api-client` gains `inProgress: boolean`, consumed by Task 4.

The "now" used for this comparison must be `wallClockNow(user.timezone)`, not a raw `new Date()`. Stored timestamps come from `parseAuroraTime`, which produces wall-clock instants labelled as UTC, and the pipeline already compares against `wallClockNow`. Mixing a true UTC now into the comparison would skew the window by the user's offset.

- [ ] **Step 1: Write the failing test**

Add this test to `packages/sync-service/test/app.test.ts`, inside the `describe("app", ...)` block:

```typescript
it("marks recent sessions in progress and settled ones not", async () => {
  const userId = "user_in_progress";
  await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', ?)`)
    .bind(userId, new Date().toISOString())
    .run();

  const recentEnd = new Date(Date.now() - 5 * 60_000).toISOString();
  const oldEnd = new Date(Date.now() - 5 * 60 * 60_000).toISOString();
  const insert = `INSERT INTO sessions (user_id, fingerprint, board, start_at, end_at, climb_count, top_grade, rpe, title, summary, climbs_json)
       VALUES (?, ?, 'tension', ?, ?, 1, 4, 5, 'T', 'S', '[]')`;
  await env.DB.prepare(insert)
    .bind(userId, "fp_recent", new Date(Date.now() - 65 * 60_000).toISOString(), recentEnd)
    .run();
  await env.DB.prepare(insert)
    .bind(userId, "fp_old", new Date(Date.now() - 6 * 60 * 60_000).toISOString(), oldEnd)
    .run();

  const res = await testApp().request("/v1/sessions", { headers: { "x-test-user": userId } }, env);
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    sessions: Array<{ fingerprint: string; inProgress: boolean }>;
  };
  const byFingerprint = new Map(body.sessions.map((s) => [s.fingerprint, s.inProgress]));
  expect(byFingerprint.get("fp_recent")).toBe(true);
  expect(byFingerprint.get("fp_old")).toBe(false);

  const detail = await testApp().request(
    "/v1/sessions/fp_recent",
    { headers: { "x-test-user": userId } },
    env
  );
  const detailBody = (await detail.json()) as { session: { inProgress: boolean } };
  expect(detailBody.session.inProgress).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sendtally/sync-service test`

Expected: FAIL with `expected undefined to be true`, because the routes do not return `inProgress` yet.

- [ ] **Step 3: Add the core import to the app**

In `packages/sync-service/src/app.ts`, add this import directly below the `hono/cors` import:

```typescript
import { defaultSessionConfig, isInProgress } from "@sendtally/core";
```

- [ ] **Step 4: Return `inProgress` from both session routes**

Replace the two session routes in `packages/sync-service/src/app.ts` with:

```typescript
app.get("/v1/sessions", async (c) => {
  const userId = c.get("userId");
  const includeClimbs = c.req.query("include") === "climbs";
  const user = await repo.getUser(c.env.DB, userId);
  const now = wallClockNow(user?.timezone ?? "UTC");
  const cfg = defaultSessionConfig();
  const rows = await repo.listSessions(c.env.DB, userId, 200, includeClimbs);
  const sessions = rows.map(({ climbs_json, ...rest }) => ({
    ...rest,
    inProgress: isInProgress(new Date(rest.end_at), cfg, now),
    ...(includeClimbs ? { climbs: climbs_json == null ? [] : JSON.parse(climbs_json) } : {}),
  }));
  return c.json({ sessions });
});

app.get("/v1/sessions/:fingerprint", async (c) => {
  const userId = c.get("userId");
  const row = await repo.getSession(c.env.DB, userId, c.req.param("fingerprint"));
  if (row === null) return c.json({ error: "not found" }, 404);
  const user = await repo.getUser(c.env.DB, userId);
  const { climbs_json, ...rest } = row;
  return c.json({
    session: {
      ...rest,
      inProgress: isInProgress(
        new Date(rest.end_at),
        defaultSessionConfig(),
        wallClockNow(user?.timezone ?? "UTC")
      ),
      climbs: climbs_json == null ? [] : JSON.parse(climbs_json),
    },
  });
});
```

- [ ] **Step 5: Add `inProgress` to the shared API type**

In `packages/api-client/src/types.ts`, add the field to `SessionRow`:

```typescript
export type SessionRow = {
  fingerprint: string;
  board: string | null;
  start_at: string;
  end_at: string;
  climb_count: number;
  top_grade: number;
  rpe: number;
  title: string;
  strava_activity_id: number | null;
  posted_at: string | null;
  inProgress: boolean;
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @sendtally/sync-service test && pnpm --filter @sendtally/sync-service check-types && pnpm --filter @sendtally/api-client check-types`

Expected: PASS on tests and both type-checks.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add packages/sync-service/src/app.ts packages/sync-service/test/app.test.ts packages/api-client/src/types.ts
git commit -m "feat(sync-service): expose inProgress on the session read routes"
```

---

### Task 4: Apps - show an IN PROGRESS badge

**Files:**

- Modify: `packages/features/src/sessions/badges.ts`
- Create: `packages/features/src/sessions/badges.test.ts`
- Modify: `apps/web/app/sessions/components/SessionRowItem.tsx:13-26`
- Modify: `apps/mobile/features/sessions/SessionCard.tsx:14-18`

**Interfaces:**

- Consumes: `SessionRow.inProgress` from Task 3.
- Produces: `SessionBadge` gains the `"in_progress"` variant, which takes priority over every other badge. `BADGE_STYLES` (web) and `BADGES` (mobile) are `Record<SessionBadge, ...>`, so both fail to type-check until they gain the new entry. That is the intended safety net.

- [ ] **Step 1: Write the failing test**

Create `packages/features/src/sessions/badges.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { ConnectionStatus, SessionRow } from "@sendtally/api-client";
import { sessionBadge } from "./badges";

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    fingerprint: "fp",
    board: "tension",
    start_at: "2026-08-08T18:00:00.000Z",
    end_at: "2026-08-08T19:00:00.000Z",
    climb_count: 3,
    top_grade: 6,
    rpe: 7,
    title: "T",
    strava_activity_id: null,
    posted_at: null,
    inProgress: false,
    ...overrides,
  };
}

function status(): ConnectionStatus {
  return {
    boards: [{ board: "tension", status: "active", postingEnabled: true, postSince: null }],
    strava: { athleteId: 1, status: "active" },
    sync: null,
    autoSync: true,
  };
}

describe("sessionBadge", () => {
  it("marks an in-progress session even when posting is enabled", () => {
    expect(sessionBadge(session({ inProgress: true }), status())).toBe("in_progress");
  });

  it("prefers in_progress over on_strava", () => {
    expect(sessionBadge(session({ inProgress: true, strava_activity_id: 9 }), status())).toBe(
      "in_progress"
    );
  });

  it("still reports will_post for a settled session", () => {
    expect(sessionBadge(session(), status())).toBe("will_post");
  });

  it("still reports on_strava for a posted session", () => {
    expect(sessionBadge(session({ strava_activity_id: 9 }), status())).toBe("on_strava");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sendtally/features test`

Expected: FAIL. The first two tests receive `"will_post"` and `"on_strava"` instead of `"in_progress"`.

- [ ] **Step 3: Add the badge variant**

In `packages/features/src/sessions/badges.ts`, change the type, labels, and the first branch of the function:

```typescript
export type SessionBadge = "in_progress" | "on_strava" | "will_post" | "not_posted";

export const SESSION_BADGE_LABELS: Record<SessionBadge, string> = {
  in_progress: "IN PROGRESS",
  on_strava: "ON STRAVA",
  will_post: "WILL POST",
  not_posted: "NOT POSTED",
};

export function sessionBadge(session: SessionRow, status: ConnectionStatus | null): SessionBadge {
  if (session.inProgress) return "in_progress";
  if (session.strava_activity_id !== null) return "on_strava";
```

The rest of the function body is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sendtally/features test`

Expected: PASS, all four cases.

- [ ] **Step 5: Add the web badge style**

In `apps/web/app/sessions/components/SessionRowItem.tsx`, add the `in_progress` entry as the first key of `BADGE_STYLES`:

```typescript
const BADGE_STYLES: Record<SessionBadge, { border: string; color: string }> = {
  in_progress: {
    border: "1px solid rgba(196,48,61,0.4)",
    color: "var(--bs-watermelon-ink)",
  },
  on_strava: {
```

`--bs-watermelon-ink` is the AA-safe watermelon already used as `--text-label-accent`, so it reads as live without failing contrast on the white card.

- [ ] **Step 6: Add the mobile badge style**

In `apps/mobile/features/sessions/SessionCard.tsx`, add the matching entry as the first key of `BADGES`:

```typescript
const BADGES: Record<SessionBadge, { color: string; border: string }> = {
  in_progress: { color: colors.watermelonInk, border: "rgba(196,48,61,0.4)" },
  on_strava: { color: colors.azureInk, border: "rgba(27,98,206,0.4)" },
  will_post: { color: "rgba(64,63,76,0.6)", border: "rgba(64,63,76,0.25)" },
  not_posted: { color: colors.textFaint, border: "rgba(64,63,76,0.18)" },
};
```

- [ ] **Step 7: Run the full check suite**

Run: `pnpm check-types && pnpm test && pnpm lint`

Expected: PASS across every package. If `check-types` reports a `Record<SessionBadge, ...>` missing the `in_progress` key anywhere else, add an entry there using the same two colors.

- [ ] **Step 8: Commit**

```bash
pnpm format
git add packages/features/src/sessions/badges.ts packages/features/src/sessions/badges.test.ts apps/web/app/sessions/components/SessionRowItem.tsx apps/mobile/features/sessions/SessionCard.tsx
git commit -m "feat(app): badge in-progress sessions in the session list"
```

---

### Task 5: Verify end to end and open the PR

**Files:** none modified.

- [ ] **Step 1: Run every check from the repo root**

Run: `pnpm format && pnpm check-types && pnpm test && pnpm lint`

Expected: all green. If `pnpm format` rewrites anything, commit it as `style: formatting`.

- [ ] **Step 2: Confirm the Go CLI is untouched**

Run: `git diff --stat origin/staging -- tools/cli-go`

Expected: empty output. The Go reference implementation must not change.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feat/in-progress-sessions
```

- [ ] **Step 4: Open the PR against staging**

```bash
gh pr create --base staging --title "feat: show in-progress sessions immediately" --body "$(cat <<'EOF'
A session that just finished was invisible in sendtally until roughly two hours later, so pressing sync right after climbing reported success and showed nothing. The 120-minute in-progress window was dropping the session before it was ever persisted.

The window now applies only to the Strava post, which is the thing it was protecting against. Sessions are always grouped, scored, persisted, and shown in the app, and they carry an `inProgress` flag. Strava posting skips flagged sessions until they settle, so a partial activity is still never posted early.

`inProgress` is derived at read time from the stored `end_at`, so there is no schema change and no migration. Scoring history excludes in-progress sessions, which keeps every previously computed RPE identical and preserves parity with the Go CLI fixtures.

- Core flags in-progress sessions instead of discarding them
- Pipeline persists every session and holds the Strava post
- Session read routes return `inProgress`
- Web and mobile show an `IN PROGRESS` badge

Design: `docs/superpowers/specs/2026-08-08-in-progress-sessions-design.md`
EOF
)"
```

- [ ] **Step 5: Confirm CI passes**

Run: `gh pr checks --watch`

Expected: all checks green. CI validates D1 migrations against a fresh local D1; this branch adds no migration, so that step should pass unchanged.

---

## Notes for the implementer

**Why no migration.** `inProgress` is a function of `end_at` and the current time, so storing it would immediately go stale and require a background job to correct. Deriving it at read time keeps D1 as the record of what happened and leaves "is it still happening" to the reader.

**Why the history exclusion matters.** `score` picks reference sessions from the 8-week window and falls back to the full history when fewer than `minHistory` sessions qualify. Letting a half-finished session into that reference set would shift the median session points and therefore the RPE of other sessions, including ones already posted to Strava. Excluding in-progress sessions from history is what makes this change invisible to everything that already worked.

**A posted session can never grow.** Posting requires the last climb to be at least 120 minutes old, and any climb more than 90 minutes after the last one starts a new session under the gap rule. So there is no case where an already-posted activity needs updating, which is why no Strava update path is in scope.
