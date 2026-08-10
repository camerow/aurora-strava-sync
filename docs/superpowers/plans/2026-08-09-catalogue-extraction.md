# Board Catalogue Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the shared board catalogue refresh off the user sync path and onto its own daily cron, so Aurora is polled once per board instead of once per user.

**Architecture:** Catalogue fill and refresh move out of `pipeline.ts` into a new `catalogue.ts` module that borrows a token from an active board connection and rotates to the next one when a token is rejected. The queue message becomes a discriminated union so one queue carries both user syncs and catalogue jobs. A user sync whose board catalogue has never completed defers instead of scoring, and a sync that references climbs missing from the cache does one bounded incremental refresh before scoring.

**Tech Stack:** TypeScript, Vitest with `@cloudflare/vitest-pool-workers`, Hono on Cloudflare Workers, D1 via Drizzle, Cloudflare Queues and Cron Triggers.

**Spec:** `docs/superpowers/specs/2026-08-09-catalogue-extraction-design.md`

## Global Constraints

- Package manager is `pnpm`. Never `npm` or `yarn`.
- `strict: true` TypeScript. No `any`; use `unknown` and narrow.
- Explicit return types on all exported functions.
- Prefer `type` over `interface`.
- Avoid comments in code. Prefer short, composable, obviously named code.
- Never use the em dash. Use a hyphen instead.
- Zod at every I/O boundary (API input, external API responses, queue messages).
- Run `pnpm format` before committing. Prettier owns formatting.
- Conventional Commits: `feat|fix|refactor|test|chore|docs(scope): description`.
- No AI co-author trailers in commit messages.
- Branch is `feat/catalogue-cron`, already created off the latest `origin/staging`.
- Database access goes through the typed Drizzle queries in `packages/sync-service/src/lib/repo.ts`. No raw SQL in Worker code; test files may use SQL for setup and assertions.
- Board passwords are never logged or persisted. Tokens are AES-GCM encrypted in D1 and decrypted only in memory.
- Run tests with `pnpm --filter @sendtally/sync-service test` and types with `pnpm --filter @sendtally/sync-service check-types`. These call vitest and tsc directly. Do NOT use the root `pnpm test` without `--force`; it goes through Turborepo and replays cached results from another directory.
- Page budgets, all per queue message: initial fill `CACHE_FILL_PAGES` (12), daily refresh `CACHE_DAILY_PAGES` (24), refresh-on-miss `CACHE_REFRESH_PAGES` (4).

---

### Task 1: Repo queries for catalogue token selection

**Files:**

- Modify: `packages/sync-service/src/lib/repo.ts`
- Test: `packages/sync-service/test/repo.test.ts` (create)

**Interfaces:**

- Produces: `activeBoardConnectionsForBoard(db: D1Database, board: string): Promise<BoardConnectionRow[]>` - every connection for a board whose `status` is `"active"`, most recently connected first. Used by the catalogue job to pick a token and to rotate when one is rejected.
- Produces: `boardsWithActiveConnections(db: D1Database): Promise<string[]>` - distinct board names having at least one active connection. Used by the daily cron to decide which boards to enqueue.

- [ ] **Step 1: Write the failing tests**

Create `packages/sync-service/test/repo.test.ts`:

```typescript
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { activeBoardConnectionsForBoard, boardsWithActiveConnections } from "../src/lib/repo";

let seq = 0;

async function seedConnection(board: string, status: string, connectedAt: string): Promise<string> {
  const userId = `repo_user_${++seq}_${Date.now()}`;
  await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', ?)`)
    .bind(userId, new Date().toISOString())
    .run();
  await env.DB.prepare(
    `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at, posting_enabled, post_since)
     VALUES (?, ?, 1, 'ct', ?, NULL, ?, 0, NULL)`
  )
    .bind(userId, board, status, connectedAt)
    .run();
  return userId;
}

describe("activeBoardConnectionsForBoard", () => {
  it("returns only active connections, most recently connected first", async () => {
    const board = `b_${++seq}`;
    const older = await seedConnection(board, "active", "2026-01-01T00:00:00.000Z");
    const newer = await seedConnection(board, "active", "2026-06-01T00:00:00.000Z");
    await seedConnection(board, "dead", "2026-07-01T00:00:00.000Z");

    const rows = await activeBoardConnectionsForBoard(env.DB, board);
    expect(rows.map((r) => r.user_id)).toEqual([newer, older]);
  });

  it("returns an empty list for a board with no active connections", async () => {
    const board = `b_${++seq}`;
    await seedConnection(board, "dead", "2026-01-01T00:00:00.000Z");
    expect(await activeBoardConnectionsForBoard(env.DB, board)).toHaveLength(0);
  });
});

describe("boardsWithActiveConnections", () => {
  it("lists each board once and excludes boards with only dead connections", async () => {
    const live = `b_${++seq}`;
    const deadOnly = `b_${++seq}`;
    await seedConnection(live, "active", "2026-01-01T00:00:00.000Z");
    await seedConnection(live, "active", "2026-02-01T00:00:00.000Z");
    await seedConnection(deadOnly, "dead", "2026-01-01T00:00:00.000Z");

    const boards = await boardsWithActiveConnections(env.DB);
    expect(boards.filter((b) => b === live)).toHaveLength(1);
    expect(boards).not.toContain(deadOnly);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sendtally/sync-service test`

Expected: FAIL to import - `activeBoardConnectionsForBoard` and `boardsWithActiveConnections` are not exported from `../src/lib/repo`.

- [ ] **Step 3: Implement both queries**

In `packages/sync-service/src/lib/repo.ts`, add after `markBoardConnectionDead`:

```typescript
export async function activeBoardConnectionsForBoard(
  db: D1Database,
  board: string
): Promise<BoardConnectionRow[]> {
  return drizzle(db)
    .select()
    .from(boardConnections)
    .where(and(eq(boardConnections.board, board), eq(boardConnections.status, "active")))
    .orderBy(desc(boardConnections.connected_at))
    .all();
}

export async function boardsWithActiveConnections(db: D1Database): Promise<string[]> {
  const rows = await drizzle(db)
    .selectDistinct({ board: boardConnections.board })
    .from(boardConnections)
    .where(eq(boardConnections.status, "active"))
    .all();
  return rows.map((r) => r.board);
}
```

`desc` is already imported in this file; confirm it is in the `drizzle-orm` import list and add it if not.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sendtally/sync-service test && pnpm --filter @sendtally/sync-service check-types`

Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add packages/sync-service/src/lib/repo.ts packages/sync-service/test/repo.test.ts
git commit -m "feat(sync-service): add repo queries for catalogue token selection"
```

---

### Task 2: Catalogue module with token rotation

**Files:**

- Create: `packages/sync-service/src/catalogue.ts`
- Modify: `packages/sync-service/src/pipeline.ts` (remove `fillTable`, `ensureBoardCache`, `CacheFillInProgressError`, `CACHE_FILL_PAGES`, `CACHE_REFRESH_PAGES`)
- Test: `packages/sync-service/test/catalogue.test.ts` (create)

**Interfaces:**

- Consumes: `activeBoardConnectionsForBoard` from Task 1.
- Produces: `syncBoardCatalogue(env: Env, board: string, fetchImpl?: typeof fetch): Promise<CatalogueOutcome>`
- Produces: `type CatalogueOutcome = { status: "complete" | "continuing" | "no_credentials" | "unknown_board" }`
- Produces: `refreshSharedCache(env: Env, aurora: AuroraClient, board: string, token: string, maxPages: number): Promise<void>` - one bounded incremental `syncShared` that advances the stored cursors. Task 7 uses it for refresh-on-miss.
- Produces: `CACHE_REFRESH_PAGES` (4), exported for Task 7.

`"continuing"` means the fill did not finish within this message's page budget and the caller should enqueue another catalogue job for the same board. `"no_credentials"` means the board has no active connection whose token was accepted.

This task MOVES the existing fill logic rather than rewriting it. `pipeline.ts` loses its catalogue functions in the same commit, and `syncOneBoard` temporarily stops calling them - Task 3 restores correct user-sync behaviour. Between this task and Task 3 the user sync path does no catalogue work at all, which existing pipeline tests may reflect; if a pre-existing test fails only because the catalogue is no longer filled inline, note it in your report rather than weakening the test.

- [ ] **Step 1: Write the failing tests**

Create `packages/sync-service/test/catalogue.test.ts`:

```typescript
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { syncBoardCatalogue } from "../src/catalogue";
import { encryptSecret } from "../src/lib/crypto";
import { jsonResponse, makeFakeFetch, type FakeRoute } from "./fakes";

let seq = 0;

async function seedConnection(board: string, token: string, connectedAt: string): Promise<string> {
  const userId = `cat_user_${++seq}_${Date.now()}`;
  await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', ?)`)
    .bind(userId, new Date().toISOString())
    .run();
  await env.DB.prepare(
    `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at, posting_enabled, post_since)
     VALUES (?, ?, 1, ?, 'active', NULL, ?, 0, NULL)`
  )
    .bind(userId, board, await encryptSecret(token, env.TOKEN_KEY), connectedAt)
    .run();
  return userId;
}

function cataloguePage(complete: boolean, syncedAt: string): FakeRoute {
  return {
    match: (url) => url.endsWith("/sync"),
    respond: () =>
      jsonResponse(200, {
        climbs: [{ uuid: "c1", name: "Jug Life" }],
        climb_stats: [{ climb_uuid: "c1", angle: 40, difficulty_average: 20.0 }],
        shared_syncs: [
          { table_name: "climb_stats", last_synchronized_at: syncedAt },
          { table_name: "climbs", last_synchronized_at: syncedAt },
        ],
        _complete: complete,
      }),
  };
}

describe("syncBoardCatalogue", () => {
  it("fills a board catalogue and reports complete", async () => {
    const board = "tension";
    await seedConnection(board, "tok-live", "2026-06-01T00:00:00.000Z");
    const { fetchImpl } = makeFakeFetch([cataloguePage(true, "2026-08-01 00:00:00.000000")]);

    const outcome = await syncBoardCatalogue(env, board, fetchImpl);
    expect(outcome).toEqual({ status: "complete" });

    const row = await env.DB.prepare(
      `SELECT name FROM board_climb_names WHERE board = ? AND climb_uuid = 'c1'`
    )
      .bind(board)
      .first<{ name: string }>();
    expect(row?.name).toBe("Jug Life");
  });

  it("reports continuing when the page budget is exhausted", async () => {
    const board = "kilter";
    await seedConnection(board, "tok-live", "2026-06-01T00:00:00.000Z");
    let n = 0;
    const { fetchImpl } = makeFakeFetch([
      {
        match: (url) => url.endsWith("/sync"),
        respond: () => {
          n++;
          return jsonResponse(200, {
            climbs: [{ uuid: `c${n}`, name: `Climb ${n}` }],
            climb_stats: [],
            shared_syncs: [
              {
                table_name: "climb_stats",
                last_synchronized_at: `2026-08-${String(n).padStart(2, "0")} 00:00:00.000000`,
              },
              {
                table_name: "climbs",
                last_synchronized_at: `2026-08-${String(n).padStart(2, "0")} 00:00:00.000000`,
              },
            ],
            _complete: false,
          });
        },
      },
    ]);

    const outcome = await syncBoardCatalogue(env, board, fetchImpl);
    expect(outcome).toEqual({ status: "continuing" });
  });

  it("rotates to the next connection when the first token is rejected, and marks it dead", async () => {
    const board = "decoy";
    const deadUser = await seedConnection(board, "tok-dead", "2026-07-01T00:00:00.000Z");
    await seedConnection(board, "tok-live", "2026-01-01T00:00:00.000Z");

    const { fetchImpl } = makeFakeFetch([
      {
        match: (url, _m, _b, headers) =>
          url.endsWith("/sync") && (headers["cookie"] ?? "").includes("tok-dead"),
        respond: () => jsonResponse(401, {}),
      },
      cataloguePage(true, "2026-08-01 00:00:00.000000"),
    ]);

    const outcome = await syncBoardCatalogue(env, board, fetchImpl);
    expect(outcome).toEqual({ status: "complete" });

    const conn = await env.DB.prepare(
      `SELECT status FROM board_connections WHERE user_id = ? AND board = ?`
    )
      .bind(deadUser, board)
      .first<{ status: string }>();
    expect(conn?.status).toBe("dead");
  });

  it("reports no_credentials when a board has no active connection", async () => {
    const { fetchImpl } = makeFakeFetch([cataloguePage(true, "2026-08-01 00:00:00.000000")]);
    expect(await syncBoardCatalogue(env, "soill", fetchImpl)).toEqual({
      status: "no_credentials",
    });
  });
});
```

- [ ] **Step 2: Extend the fake fetch to expose request headers**

The token-rotation test matches on the `Cookie` header, which `packages/sync-service/test/fakes.ts` does not currently expose. Replace its first three declarations with:

```typescript
export type RecordedCall = {
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
};

export type FakeRoute = {
  match: (url: string, method: string, body: string, headers: Record<string, string>) => boolean;
  respond: (url: string, method: string, body: string, headers: Record<string, string>) => Response;
};

export function makeFakeFetch(routes: FakeRoute[]): {
  fetchImpl: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const body = await req.clone().text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const call = { url: req.url, method: req.method, body, headers };
    calls.push(call);
    for (const r of routes) {
      if (r.match(req.url, req.method, body, headers)) {
        return r.respond(req.url, req.method, body, headers);
      }
    }
    throw new Error(`fake fetch: unmatched ${req.method} ${req.url}`);
  }) as typeof fetch;
  return { fetchImpl, calls };
}
```

Header names arrive lowercased from the Fetch API, which is why the test matches on `headers["cookie"]` rather than `"Cookie"`. Adding a fourth positional argument leaves every existing `match: (url, _m, body) => ...` call site compiling unchanged.

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @sendtally/sync-service test`

Expected: FAIL - `../src/catalogue` does not exist.

- [ ] **Step 4: Create the catalogue module**

Create `packages/sync-service/src/catalogue.ts`. Move `fillTable` and the body of `ensureBoardCache` here from `pipeline.ts` unchanged in behaviour, and wrap them in token selection:

```typescript
import type { Env } from "./bindings";
import { AuroraClient, baseUrlFor, BoardTokenRejectedError } from "./lib/aurora";
import { decryptSecret } from "./lib/crypto";
import * as repo from "./lib/repo";

export const CACHE_FILL_PAGES = 12;
export const CACHE_DAILY_PAGES = 24;
export const CACHE_REFRESH_PAGES = 4;

export type CatalogueOutcome = {
  status: "complete" | "continuing" | "no_credentials" | "unknown_board";
};

class FillIncompleteError extends Error {}

async function fillTable(
  env: Env,
  aurora: AuroraClient,
  board: string,
  token: string,
  table: "climbs" | "climb_stats"
): Promise<void> {
  const doneKey = `${table}_complete`;
  if ((await repo.getBoardCursor(env.DB, board, doneKey)) === "1") return;
  const since = await repo.getBoardCursor(env.DB, board, table);
  const result = await aurora.syncTable(
    token,
    table,
    since,
    CACHE_FILL_PAGES,
    async (stats, climbs) => {
      await repo.putClimbData(env.DB, board, stats, climbs);
    }
  );
  await repo.setBoardCursor(env.DB, board, table, result.cursor);
  if (!result.complete) {
    if (result.cursor === since) {
      throw new Error(`board cache fill for ${board}/${table} made no progress`);
    }
    throw new FillIncompleteError(`board cache fill for ${board}/${table} continuing`);
  }
  await repo.setBoardCursor(env.DB, board, doneKey, "1");
}

export async function refreshSharedCache(
  env: Env,
  aurora: AuroraClient,
  board: string,
  token: string,
  maxPages: number
): Promise<void> {
  const statsSince = await repo.getBoardCursor(env.DB, board, "climb_stats");
  const climbsSince = await repo.getBoardCursor(env.DB, board, "climbs");
  const result = await aurora.syncShared(
    token,
    statsSince,
    climbsSince,
    maxPages,
    async (stats, climbs) => {
      await repo.putClimbData(env.DB, board, stats, climbs);
    }
  );
  await repo.setBoardCursor(env.DB, board, "climb_stats", result.statsCursor);
  await repo.setBoardCursor(env.DB, board, "climbs", result.climbsCursor);
}

async function runCatalogue(
  env: Env,
  aurora: AuroraClient,
  board: string,
  token: string
): Promise<CatalogueOutcome> {
  if ((await repo.getBoardCursor(env.DB, board, "cache_complete")) !== "1") {
    try {
      await fillTable(env, aurora, board, token, "climbs");
      await fillTable(env, aurora, board, token, "climb_stats");
    } catch (err) {
      if (err instanceof FillIncompleteError) return { status: "continuing" };
      throw err;
    }
    await repo.setBoardCursor(env.DB, board, "cache_complete", "1");
    return { status: "complete" };
  }
  await refreshSharedCache(env, aurora, board, token, CACHE_DAILY_PAGES);
  return { status: "complete" };
}

export async function syncBoardCatalogue(
  env: Env,
  board: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init)
): Promise<CatalogueOutcome> {
  const baseUrl = baseUrlFor(board);
  if (baseUrl === undefined) return { status: "unknown_board" };
  const aurora = new AuroraClient(baseUrl, fetchImpl);

  for (const conn of await repo.activeBoardConnectionsForBoard(env.DB, board)) {
    const token = await decryptSecret(conn.token_ciphertext, env.TOKEN_KEY);
    try {
      return await runCatalogue(env, aurora, board, token);
    } catch (err) {
      if (err instanceof BoardTokenRejectedError) {
        await repo.markBoardConnectionDead(env.DB, conn.user_id, board);
        continue;
      }
      throw err;
    }
  }
  return { status: "no_credentials" };
}
```

- [ ] **Step 5: Remove the catalogue functions from the pipeline**

In `packages/sync-service/src/pipeline.ts`, delete `CACHE_FILL_PAGES`, `CACHE_REFRESH_PAGES`, `CacheFillInProgressError`, `fillTable`, and `ensureBoardCache`. In `syncOneBoard`, delete the `await ensureBoardCache(...)` call and the `if (err instanceof CacheFillInProgressError)` branch from the try/catch around `aurora.syncUser`. Remove now-unused imports.

Leave `"cache_filling"` in the `SyncStatus` union and `STATUS_PRIORITY` for now; Task 3 replaces it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @sendtally/sync-service test && pnpm --filter @sendtally/sync-service check-types`

Expected: the four new catalogue tests PASS and types are clean. The pre-existing pipeline test `"pauses a large cache fill and resumes on the next run"` is expected to FAIL, because the behaviour it covers has moved out of the user sync path. Delete that test in this commit; the replacement coverage is the `"reports continuing when the page budget is exhausted"` test you just wrote. Report any other pre-existing failure rather than modifying the test.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add packages/sync-service/src/catalogue.ts packages/sync-service/src/pipeline.ts packages/sync-service/test/catalogue.test.ts packages/sync-service/test/pipeline.test.ts packages/sync-service/test/fakes.ts
git commit -m "feat(sync-service): move board catalogue refresh into its own module"
```

---

### Task 3: Queue job kinds and consumer routing

**Files:**

- Modify: `packages/sync-service/src/bindings.ts`
- Modify: `packages/sync-service/src/index.ts`
- Test: `packages/sync-service/test/queue.test.ts` (create)

**Interfaces:**

- Consumes: `syncBoardCatalogue` from Task 2.
- Produces: `type SyncJob = { kind: "user"; userId: string; board?: string } | { kind: "catalogue"; board: string }` in `bindings.ts`.
- Produces: `queuedJobSchema` in `index.ts`, a Zod union that parses an incoming message body into a `SyncJob`, normalising an untagged legacy body into `{ kind: "user", ... }`. The project requires Zod at every I/O boundary including queue messages, and here it also does real work: `msg.body` is typed as the tagged union, so a plain `"kind" in msg.body` check would be dead code to the type checker while the untagged legacy shape is a genuine runtime possibility during deploy.
- Produces: the queue consumer routes by `kind`; a message with no `kind` is treated as a user job so messages enqueued by the old code are still handled after deploy. A body matching neither shape is recorded and acked rather than retried, so one malformed message cannot loop until it exhausts the queue's retries.
- Produces: a catalogue message reporting `"continuing"` re-enqueues itself and acks, mirroring how the old `cache_filling` path continued a fill in a fresh invocation.

- [ ] **Step 1: Write the failing tests**

Create `packages/sync-service/test/queue.test.ts`:

```typescript
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env, SyncJob } from "../src/bindings";

type Msg = { body: unknown; acked: boolean; retried: boolean; retry: () => void; ack: () => void };

function message(body: unknown): Msg {
  const m: Msg = {
    body,
    acked: false,
    retried: false,
    retry: () => {
      m.retried = true;
    },
    ack: () => {
      m.acked = true;
    },
  };
  return m;
}

function envWithQueue(sent: SyncJob[]): Env {
  return {
    ...env,
    SYNC_QUEUE: { send: async (b: SyncJob) => void sent.push(b) },
  } as unknown as Env;
}

describe("queue consumer routing", () => {
  it("treats a message with no kind as a user job", async () => {
    const sent: SyncJob[] = [];
    const msg = message({ userId: "queue_user_legacy" });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent));
    expect(msg.acked).toBe(true);
  });

  it("routes a catalogue message to the catalogue path", async () => {
    const sent: SyncJob[] = [];
    const msg = message({ kind: "catalogue", board: "soill" });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent));
    expect(msg.acked).toBe(true);
    expect(sent).toHaveLength(0);
  });
});
```

The `soill` board has no active connections in a fresh test database, so `syncBoardCatalogue` returns `no_credentials` and the message acks without re-enqueueing. That is what the second test pins.

Add a third test for the malformed case:

```typescript
it("acks a malformed message instead of retrying it forever", async () => {
  const sent: SyncJob[] = [];
  const msg = message({ nonsense: true });
  await worker.queue({ messages: [msg] } as never, envWithQueue(sent));
  expect(msg.acked).toBe(true);
  expect(msg.retried).toBe(false);
  expect(sent).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sendtally/sync-service test`

Expected: FAIL. The catalogue message currently falls into the user path and `syncOneUser` is called with `msg.body.userId` of `undefined`.

- [ ] **Step 3: Change the job type**

Replace the `SyncJob` type in `packages/sync-service/src/bindings.ts`:

```typescript
export type SyncJob =
  { kind: "user"; userId: string; board?: string } | { kind: "catalogue"; board: string };
```

- [ ] **Step 4: Route in the consumer**

In `packages/sync-service/src/index.ts`, import the catalogue module and replace the body of the `queue` handler's loop:

```typescript
import { z } from "zod";
import { syncBoardCatalogue } from "./catalogue";
```

Add the schema near the top of the file, below the existing constants:

```typescript
const queuedJobSchema = z.union([
  z.object({ kind: z.literal("catalogue"), board: z.string() }),
  z.object({ kind: z.literal("user"), userId: z.string(), board: z.string().optional() }),
  z
    .object({ userId: z.string(), board: z.string().optional() })
    .transform((j) => ({ kind: "user" as const, ...j })),
]);
```

The untagged variant is last so a tagged body never falls through to it.

```typescript
  async queue(batch: MessageBatch<SyncJob>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const parsed = queuedJobSchema.safeParse(msg.body);
      if (!parsed.success) {
        await setBoardCursor(
          env.DB,
          "_meta",
          "last_bad_queue_message",
          `${new Date().toISOString()} ${JSON.stringify(msg.body)}`.slice(0, 500)
        );
        msg.ack();
        continue;
      }
      const job = parsed.data;

      if (job.kind === "catalogue") {
        const outcome = await syncBoardCatalogue(env, job.board);
        await setBoardCursor(
          env.DB,
          "_meta",
          "last_catalogue_outcome",
          `${new Date().toISOString()} ${job.board} ${outcome.status}`
        );
        if (outcome.status === "continuing") await env.SYNC_QUEUE.send(job);
        msg.ack();
        continue;
      }

      let outcome;
      try {
        outcome = await syncOneUser(env, job.userId, undefined, job.board);
      } catch (err) {
        await setBoardCursor(
          env.DB,
          "_meta",
          "last_consumer_error",
          `${new Date().toISOString()} ${err instanceof Error ? err.message : String(err)}`.slice(
            0,
            500
          )
        );
        throw err;
      }
      await setBoardCursor(
        env.DB,
        "_meta",
        "last_consumer_outcome",
        `${new Date().toISOString()} ${outcome.status}`
      );
      if (outcome.status === "rate_limited") {
        msg.retry({ delaySeconds: RATE_LIMIT_RETRY_SECONDS });
      } else {
        msg.ack();
      }
    }
  },
```

Note the `cache_filling` re-enqueue branch is gone from the user path; Task 4 adds the `catalogue_pending` equivalent.

- [ ] **Step 5: Update the hourly fan-out to the new shape**

In the same file, the `scheduled` handler currently sends `{ userId }`. Change it to send the tagged form:

```typescript
await env.SYNC_QUEUE.sendBatch(due.map((userId) => ({ body: { kind: "user" as const, userId } })));
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @sendtally/sync-service test && pnpm --filter @sendtally/sync-service check-types`

Expected: PASS. Existing tests that enqueue jobs may need their expected message shape updated to include `kind`; update those expectations, not the behaviour.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add packages/sync-service/src/bindings.ts packages/sync-service/src/index.ts packages/sync-service/test/queue.test.ts
git commit -m "feat(sync-service): route catalogue and user jobs on one queue"
```

---

### Task 4: Defer a user sync when the catalogue is incomplete

**Files:**

- Modify: `packages/sync-service/src/pipeline.ts`
- Modify: `packages/sync-service/src/index.ts`
- Test: `packages/sync-service/test/pipeline.test.ts`

**Interfaces:**

- Consumes: the `SyncJob` union from Task 3.
- Produces: `SyncStatus` loses `"cache_filling"` and gains `"catalogue_pending"`, with the same position in `STATUS_PRIORITY` that `"cache_filling"` held.
- Produces: `syncOneBoard` returns `{ status: "catalogue_pending", posted: 0 }` without fetching, scoring, persisting, or posting when the board's `cache_complete` cursor is not `"1"`.
- Produces: the queue consumer re-enqueues the same user job when the outcome is `catalogue_pending`, then acks.

Deferring rather than scoring is what stops a first sync posting a session of unresolved climbs to Strava permanently.

- [ ] **Step 1: Write the failing test**

Add to `packages/sync-service/test/pipeline.test.ts`, inside the `describe("syncOneUser", ...)` block:

```typescript
it("defers and persists nothing when the board catalogue has never completed", async () => {
  await seedUser(userId, 61, 31, "grasshopper");
  const { fetchImpl, calls } = makeFakeFetch([...auroraRoutes(), stravaCreateRoute(201, 4001)]);

  const outcome = await syncOneUser(env, userId, fetchImpl);
  expect(outcome).toEqual({ status: "catalogue_pending", posted: 0 });

  const rows = await env.DB.prepare(`SELECT fingerprint FROM sessions WHERE user_id = ?`)
    .bind(userId)
    .all();
  expect(rows.results).toHaveLength(0);
  expect(calls).toHaveLength(0);
});
```

`grasshopper` is used because no other test seeds it, so its `cache_complete` cursor is unset. `expect(calls).toHaveLength(0)` pins that a deferred sync makes no Aurora request at all.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sendtally/sync-service test`

Expected: FAIL with status `"synced"` instead of `"catalogue_pending"`, because `syncOneBoard` currently proceeds regardless of catalogue state.

- [ ] **Step 3: Add the status**

In `packages/sync-service/src/pipeline.ts`, change the `SyncStatus` union and `STATUS_PRIORITY`, replacing `"cache_filling"` with `"catalogue_pending"` in both, keeping the same ordering position:

```typescript
export type SyncStatus =
  | "synced"
  | "no_strava"
  | "catalogue_pending"
  | "rate_limited"
  | "board_dead"
  | "strava_dead"
  | "not_connected";

const STATUS_PRIORITY: SyncStatus[] = [
  "rate_limited",
  "catalogue_pending",
  "strava_dead",
  "board_dead",
  "synced",
  "no_strava",
  "not_connected",
];
```

In `syncOneUser`, update the guard that skips recording a sync result:

```typescript
  if (status !== "rate_limited" && status !== "catalogue_pending") {
```

- [ ] **Step 4: Defer in syncOneBoard**

In `packages/sync-service/src/pipeline.ts`, add the check at the top of `syncOneBoard`, immediately after the `boardConn.status !== "active"` guard and before the `baseUrlFor` call:

```typescript
if ((await repo.getBoardCursor(env.DB, boardConn.board, "cache_complete")) !== "1") {
  return { status: "catalogue_pending", posted: 0 };
}
```

- [ ] **Step 5: Re-enqueue on defer**

In `packages/sync-service/src/index.ts`, add a branch in the user-job path alongside the rate-limit branch:

```typescript
if (outcome.status === "rate_limited") {
  msg.retry({ delaySeconds: RATE_LIMIT_RETRY_SECONDS });
} else if (outcome.status === "catalogue_pending") {
  await env.SYNC_QUEUE.send(job);
  msg.ack();
} else {
  msg.ack();
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @sendtally/sync-service test && pnpm --filter @sendtally/sync-service check-types`

Expected: PASS. Pre-existing pipeline tests that expect a successful sync will now need their board's `cache_complete` cursor set during seeding; add `await env.DB.prepare("INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, 'cache_complete', '1')").bind(board).run();` to the shared `seedUser` helper so those tests keep exercising the full path.

- [ ] **Step 7: Commit**

```bash
pnpm format
git add packages/sync-service/src/pipeline.ts packages/sync-service/src/index.ts packages/sync-service/test/pipeline.test.ts
git commit -m "feat(sync-service): defer user syncs until the board catalogue is ready"
```

---

### Task 5: Daily catalogue cron

**Files:**

- Modify: `packages/sync-service/wrangler.jsonc:7`
- Modify: `packages/sync-service/src/index.ts`
- Test: `packages/sync-service/test/queue.test.ts`

**Interfaces:**

- Consumes: `boardsWithActiveConnections` from Task 1, the `SyncJob` union from Task 3.
- Produces: `scheduled` switches on `controller.cron`. The hourly `"0 * * * *"` enqueues due user syncs as before. The daily `"0 4 * * *"` enqueues one `{ kind: "catalogue", board }` per board with at least one active connection.

- [ ] **Step 1: Write the failing tests**

Add to `packages/sync-service/test/queue.test.ts`:

```typescript
describe("scheduled fan-out", () => {
  it("enqueues catalogue jobs on the daily cron, one per board with active connections", async () => {
    const userId = `cron_user_${Date.now()}`;
    await env.DB.prepare(
      `INSERT INTO users (id, timezone, created_at, auto_sync) VALUES (?, 'UTC', ?, 0)`
    )
      .bind(userId, new Date().toISOString())
      .run();
    await env.DB.prepare(
      `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at, posting_enabled, post_since)
       VALUES (?, 'touchstone', 1, 'ct', 'active', NULL, ?, 0, NULL)`
    )
      .bind(userId, new Date().toISOString())
      .run();

    const sent: SyncJob[] = [];
    const fakeEnv = {
      ...env,
      SYNC_QUEUE: {
        send: async (b: SyncJob) => void sent.push(b),
        sendBatch: async (bs: { body: SyncJob }[]) => void sent.push(...bs.map((b) => b.body)),
      },
    } as unknown as Env;

    await worker.scheduled({ cron: "0 4 * * *" } as never, fakeEnv);

    expect(sent).toContainEqual({ kind: "catalogue", board: "touchstone" });
    expect(sent.every((j) => j.kind === "catalogue")).toBe(true);
  });

  it("enqueues no catalogue jobs on the hourly cron", async () => {
    const sent: SyncJob[] = [];
    const fakeEnv = {
      ...env,
      SYNC_QUEUE: {
        send: async (b: SyncJob) => void sent.push(b),
        sendBatch: async (bs: { body: SyncJob }[]) => void sent.push(...bs.map((b) => b.body)),
      },
    } as unknown as Env;

    await worker.scheduled({ cron: "0 * * * *" } as never, fakeEnv);

    expect(sent.some((j) => j.kind === "catalogue")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @sendtally/sync-service test`

Expected: FAIL - the daily test finds no catalogue job, because `scheduled` ignores its controller and only fans out user syncs.

- [ ] **Step 3: Add the second cron trigger**

In `packages/sync-service/wrangler.jsonc`, line 7:

```jsonc
  "triggers": { "crons": ["0 * * * *", "0 4 * * *"] },
```

- [ ] **Step 4: Switch on the cron expression**

In `packages/sync-service/src/index.ts`, add the constant and replace the `scheduled` handler:

```typescript
const CATALOGUE_CRON = "0 4 * * *";
```

```typescript
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await setBoardCursor(env.DB, "_meta", "cron_heartbeat", new Date().toISOString());

    if (controller.cron === CATALOGUE_CRON) {
      const boards = await boardsWithActiveConnections(env.DB);
      if (boards.length === 0) return;
      await env.SYNC_QUEUE.sendBatch(
        boards.map((board) => ({ body: { kind: "catalogue" as const, board } }))
      );
      return;
    }

    const due = await usersDueForSync(env.DB, SYNC_INTERVAL_MS);
    if (due.length === 0) return;
    await env.SYNC_QUEUE.sendBatch(due.map((userId) => ({ body: { kind: "user" as const, userId } })));
  },
```

Add `boardsWithActiveConnections` to the existing import from `./lib/repo`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sendtally/sync-service test && pnpm --filter @sendtally/sync-service check-types`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add packages/sync-service/wrangler.jsonc packages/sync-service/src/index.ts packages/sync-service/test/queue.test.ts
git commit -m "feat(sync-service): add a daily catalogue cron"
```

---

### Task 6: Connect enqueues a catalogue job

**Files:**

- Modify: `packages/sync-service/src/app.ts` (the `/v1/connect/board` route)
- Test: `packages/sync-service/test/app.test.ts`

**Interfaces:**

- Consumes: the `SyncJob` union from Task 3.
- Produces: `POST /v1/connect/board` enqueues `{ kind: "catalogue", board }` in addition to the existing user sync job. The catalogue job carries only the board; the connection row is written first, so the consumer's token lookup finds the connection just created.

- [ ] **Step 1: Write the failing test**

In `packages/sync-service/test/app.test.ts`, the existing test `"connects a board with pass-through login and stores only the token"` already captures enqueued messages in a `queued` array. Add this assertion to that test, after its existing assertions:

```typescript
expect(queued).toContainEqual({ kind: "catalogue", board: "tension" });
expect(queued).toContainEqual({ kind: "user", userId: "user_connect", board: "tension" });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sendtally/sync-service test`

Expected: FAIL - only the user job is enqueued, and it currently has no `kind`.

- [ ] **Step 3: Enqueue both jobs**

In `packages/sync-service/src/app.ts`, in the `/v1/connect/board` handler, replace the single enqueue after `upsertBoardConnection`:

```typescript
await c.env.SYNC_QUEUE.send({ kind: "catalogue", board });
await c.env.SYNC_QUEUE.send({ kind: "user", userId, board });
```

- [ ] **Step 4: Tag the other enqueue sites**

Two other routes enqueue user jobs and must carry the tag or they will be mis-routed. In `packages/sync-service/src/app.ts`:

In the `/connect/strava/callback` handler, change `await c.env.SYNC_QUEUE.send({ userId: state.userId });` to:

```typescript
await c.env.SYNC_QUEUE.send({ kind: "user", userId: state.userId });
```

In the `/v1/strava/posting` handler, change `await c.env.SYNC_QUEUE.send({ userId, board });` to:

```typescript
await c.env.SYNC_QUEUE.send({ kind: "user", userId, board });
```

In the `/v1/sync-now` handler, change the send to:

```typescript
await c.env.SYNC_QUEUE.send(
  board === undefined ? { kind: "user", userId } : { kind: "user", userId, board }
);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @sendtally/sync-service test && pnpm --filter @sendtally/sync-service check-types`

Expected: PASS. Other app tests asserting enqueued shapes will need `kind: "user"` added to their expectations.

- [ ] **Step 6: Commit**

```bash
pnpm format
git add packages/sync-service/src/app.ts packages/sync-service/test/app.test.ts
git commit -m "feat(sync-service): enqueue a catalogue job when a board is connected"
```

---

### Task 7: Refresh the catalogue when a sync references missing climbs

**Files:**

- Modify: `packages/sync-service/src/pipeline.ts`
- Test: `packages/sync-service/test/pipeline.test.ts`

**Interfaces:**

- Consumes: `refreshSharedCache` and `CACHE_REFRESH_PAGES` from Task 2.
- Produces: before building climbs, `syncOneBoard` collects the climb UUIDs the sync references, and if any are absent from `board_climb_names` it runs one `refreshSharedCache` capped at `CACHE_REFRESH_PAGES` and re-resolves. At most once per sync.

Without this, a problem set the same day resolves to no name and grade `-1`, scores as V1, and posts to Strava permanently wrong. The daily cron is too slow to prevent that on its own.

- [ ] **Step 1: Write the failing test**

Add to `packages/sync-service/test/pipeline.test.ts`, inside the `describe("syncOneUser", ...)` block:

```typescript
it("refreshes the catalogue once when a sync references an unknown climb", async () => {
  await seedUser(userId, 71, 41, "aurora");
  let sharedCalls = 0;
  const { fetchImpl } = makeFakeFetch([
    auroraRoutes()[0]!,
    {
      match: (url, _m, body) => url.endsWith("/sync") && !body.includes("ascents="),
      respond: () => {
        sharedCalls++;
        return jsonResponse(200, {
          climbs: [
            { uuid: "c1", name: "Jug Life" },
            { uuid: "c2", name: "Crimp Reaper" },
            { uuid: "c3", name: "Mind Meld" },
          ],
          climb_stats: [{ climb_uuid: "c3", angle: 40, difficulty_average: 24.2 }],
          shared_syncs: [
            { table_name: "climb_stats", last_synchronized_at: "2026-08-02 00:00:00.000000" },
            { table_name: "climbs", last_synchronized_at: "2026-08-02 00:00:00.000000" },
          ],
          _complete: true,
        });
      },
    },
  ]);

  const outcome = await syncOneUser(env, userId, fetchImpl);
  expect(outcome.status).toBe("synced");
  expect(sharedCalls).toBe(1);

  const row = await env.DB.prepare(`SELECT summary FROM sessions WHERE user_id = ?`)
    .bind(userId)
    .first<{ summary: string }>();
  expect(row?.summary).toContain("Jug Life");
});
```

The `aurora` board starts with an empty climb-name cache, so all three climbs the ascents reference are unknown and the refresh must run exactly once to resolve them.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sendtally/sync-service test`

Expected: FAIL with `sharedCalls` equal to `0` and the summary containing no climb name, because nothing refreshes the catalogue on the user path.

- [ ] **Step 3: Add the miss check**

In `packages/sync-service/src/pipeline.ts`, add the import:

```typescript
import { CACHE_REFRESH_PAGES, refreshSharedCache } from "./catalogue";
```

Then in `syncOneBoard`, between the `aurora.syncUser` try/catch and the `toClimbs` call, add:

```typescript
const referenced = [...ascents.map((a) => a.climb_uuid), ...bids.map((b) => b.climb_uuid)];
const known = await repo.climbNamesFor(env.DB, boardConn.board, referenced);
if (referenced.some((uuid) => !known.has(uuid))) {
  try {
    await refreshSharedCache(env, aurora, boardConn.board, boardToken, CACHE_REFRESH_PAGES);
  } catch (err) {
    if (err instanceof BoardTokenRejectedError) {
      await repo.markBoardConnectionDead(env.DB, userId, boardConn.board);
      return { status: "board_dead", posted: 0 };
    }
    throw err;
  }
}
```

`toClimbs` re-queries the cache itself, so no further plumbing is needed and a climb still missing afterwards keeps today's behaviour of no name and grade `-1`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @sendtally/sync-service test && pnpm --filter @sendtally/sync-service check-types`

Expected: PASS, including all pre-existing pipeline tests.

- [ ] **Step 5: Commit**

```bash
pnpm format
git add packages/sync-service/src/pipeline.ts packages/sync-service/test/pipeline.test.ts
git commit -m "feat(sync-service): refresh the catalogue when a sync hits unknown climbs"
```

---

### Task 8: Verify end to end and open the PR

**Files:** none modified, unless the checks surface something.

- [ ] **Step 1: Run every check from the worktree root**

Run: `pnpm format && pnpm check-types --force && pnpm test --force && pnpm lint --force`

Expected: all green. If `pnpm format` rewrites anything, commit it as `style: formatting`.

- [ ] **Step 2: Confirm the Go CLI is untouched**

Run: `git diff --stat origin/staging -- tools/cli-go`

Expected: empty output. The Go CLI keeps its inline fill by design.

- [ ] **Step 3: Confirm no migration was added**

Run: `git diff --stat origin/staging -- packages/sync-service/migrations`

Expected: empty output. This change adds no schema.

- [ ] **Step 4: Confirm both cron triggers are configured**

Run: `grep -n "crons" packages/sync-service/wrangler.jsonc`

Expected: `"triggers": { "crons": ["0 * * * *", "0 4 * * *"] },`

- [ ] **Step 5: Push the branch**

```bash
git push -u origin feat/catalogue-cron
```

- [ ] **Step 6: Open the PR against staging**

```bash
gh pr create --base staging --title "feat: move board catalogue refresh onto its own cron" --body "$(cat <<'EOF'
The shared board catalogue was refreshed on the user sync path rather than on its own schedule. Every user sync called `ensureBoardCache`, so once a catalogue was complete each additional user still triggered an incremental refresh of the same shared data. Polling scaled with users instead of boards, which is the opposite of what the shared cache exists for: `CLAUDE.md` describes it as protection against being blocked on Aurora's private API.

Catalogue work now lives in its own module and runs from a daily cron. It borrows a token from an active connection for the board and rotates to the next connection when a token is rejected, marking the rejected one dead. A board with no active connections is skipped.

A probe settled that the catalogue endpoints cannot be reached unauthenticated: an otherwise identical request with no `Cookie` header returns HTTP 404. That is why the cron borrows a token rather than running credential-free.

Two behaviours protect against posting bad data to Strava, which matters because posted activities are never updated. A sync against a board whose catalogue has never completed defers instead of scoring, so a first session is never posted with unresolved climbs. And a sync that references climbs missing from the cache does one bounded incremental refresh before scoring, so a problem set the same day still resolves its name and grade.

- Catalogue fill and refresh extracted to `catalogue.ts` with token rotation
- Queue messages became a discriminated union; a message with no `kind` is still handled as a user job, so messages in flight at deploy time are safe
- Daily `0 4 * * *` cron enqueues one catalogue job per board with active connections
- Connecting a board enqueues a catalogue job immediately
- `cache_filling` is replaced by `catalogue_pending`, which means waiting for the catalogue rather than filling it

Design: `docs/superpowers/specs/2026-08-09-catalogue-extraction-design.md`
EOF
)"
```

- [ ] **Step 7: Confirm CI passes**

Run: `gh pr checks --watch`

Expected: all checks green.

---

## Notes for the implementer

**Why the catalogue borrows a token.** Aurora returns HTTP 404, not 401, to a request with no session cookie, so there is no unauthenticated path to the shared tables. The cron therefore depends on at least one live connection per board, which is fine: a board with no connections has no users to serve.

**Why deferring beats scoring with gaps.** An unresolved climb gets grade `-1` and scores conservatively as V1. If a first sync scored and posted on an empty catalogue, that wrong RPE and a climb log full of `V?` would be permanent on Strava, because this project deliberately has no activity-update path. Waiting a few minutes is strictly better than being wrong forever.

**Why `catalogue_pending` re-enqueues rather than retries.** `msg.retry()` counts against the queue's max-retries cap, and a large first fill can span many rounds. Sending a fresh message avoids the cap, which is the same reasoning the old `cache_filling` path used.

**A known gap left alone.** The client treats only 401 and 403 as a rejected token. If Aurora also uses 404 for an expired session, a dead board token would surface as a generic error and never mark the connection dead. The probe proves only that an absent cookie returns 404, so this stays unconfirmed and unchanged. See the spec's out-of-scope section.
