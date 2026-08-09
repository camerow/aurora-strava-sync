import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { sendBatched } from "../src/index";
import type { Env, SyncJob } from "../src/bindings";
import { encryptSecret } from "../src/lib/crypto";
import { jsonResponse, makeFakeFetch } from "./fakes";

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

type SentJob = { body: SyncJob; options?: { delaySeconds?: number } };

function envWithQueue(sent: SyncJob[], sentJobs: SentJob[] = [], batchSizes: number[] = []): Env {
  return {
    ...env,
    SYNC_QUEUE: {
      send: async (b: SyncJob, options?: { delaySeconds?: number }) => {
        sent.push(b);
        sentJobs.push({ body: b, options });
      },
      sendBatch: async (batch: { body: SyncJob }[]) => {
        batchSizes.push(batch.length);
        for (const { body } of batch) {
          sent.push(body);
          sentJobs.push({ body });
        }
      },
    },
  } as unknown as Env;
}

async function boardCursorValue(board: string, tableName: string): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT value FROM board_cursors WHERE board = ? AND table_name = ?`
  )
    .bind(board, tableName)
    .first<{ value: string }>();
  return row?.value ?? null;
}

async function clearMetaBreadcrumbs(): Promise<void> {
  await env.DB.prepare(
    `DELETE FROM board_cursors WHERE board = '_meta' AND table_name IN ('last_consumer_outcome', 'last_bad_queue_message')`
  ).run();
}

async function seedConnection(
  board: string,
  token: string,
  connectedAt: string,
  autoSync = true
): Promise<string> {
  const userId = `queue_cat_user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await env.DB.prepare(
    `INSERT INTO users (id, timezone, created_at, auto_sync) VALUES (?, 'UTC', ?, ?)`
  )
    .bind(userId, new Date().toISOString(), autoSync ? 1 : 0)
    .run();
  await env.DB.prepare(
    `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at, posting_enabled, post_since)
     VALUES (?, ?, 1, ?, 'active', NULL, ?, 0, NULL)`
  )
    .bind(userId, board, await encryptSecret(token, env.TOKEN_KEY), connectedAt)
    .run();
  return userId;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("queue consumer routing", () => {
  it("treats a message with no kind as a user job", async () => {
    await clearMetaBreadcrumbs();
    const sent: SyncJob[] = [];
    const msg = message({ userId: "queue_user_legacy" });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent));
    expect(msg.acked).toBe(true);

    const outcome = await boardCursorValue("_meta", "last_consumer_outcome");
    expect(outcome).not.toBeNull();
    expect(outcome).toContain("not_connected");

    const badMessage = await boardCursorValue("_meta", "last_bad_queue_message");
    expect(badMessage).toBeNull();
  });

  it("routes a catalogue message to the catalogue path", async () => {
    const sent: SyncJob[] = [];
    const msg = message({ kind: "catalogue", board: "soill" });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent));
    expect(msg.acked).toBe(true);
    expect(sent).toHaveLength(0);

    const outcome = await boardCursorValue("_meta", "last_catalogue_outcome");
    expect(outcome).not.toBeNull();
    expect(outcome).toContain("soill");
    expect(outcome).toContain("no_credentials");
  });

  it("acks a malformed message instead of retrying it forever", async () => {
    const sent: SyncJob[] = [];
    const msg = message({ nonsense: true });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent));
    expect(msg.acked).toBe(true);
    expect(msg.retried).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("re-enqueues a catalogue job and acks when the sync reports continuing", async () => {
    const board = "grasshopper";
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
    vi.stubGlobal("fetch", fetchImpl);

    const sent: SyncJob[] = [];
    const msg = message({ kind: "catalogue", board });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent));

    expect(msg.acked).toBe(true);
    expect(msg.retried).toBe(false);
    expect(sent).toEqual([{ kind: "catalogue", board }]);
  });

  it("enqueues a catalogue job for the waiting board and does not re-enqueue the user job when catalogue is pending", async () => {
    const board = "decoy";
    const userId = await seedConnection(board, "tok-pending", "2026-06-01T00:00:00.000Z");

    const sent: SyncJob[] = [];
    const sentJobs: SentJob[] = [];
    const msg = message({ kind: "user", userId });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent, sentJobs));

    expect(msg.acked).toBe(true);
    expect(msg.retried).toBe(false);
    expect(sentJobs).toEqual([{ body: { kind: "catalogue", board }, options: undefined }]);
  });

  it("debounces catalogue enqueues from the deferral path within the debounce window", async () => {
    const board = "decoy_debounce";
    const userA = await seedConnection(board, "tok-a", "2026-06-01T00:00:00.000Z");
    const userB = await seedConnection(board, "tok-b", "2026-06-02T00:00:00.000Z");

    const sentA: SyncJob[] = [];
    await worker.queue(
      { messages: [message({ kind: "user", userId: userA })] } as never,
      envWithQueue(sentA)
    );
    expect(sentA).toEqual([{ kind: "catalogue", board }]);

    const sentB: SyncJob[] = [];
    await worker.queue(
      { messages: [message({ kind: "user", userId: userB })] } as never,
      envWithQueue(sentB)
    );
    expect(sentB).toHaveLength(0);
  });

  it("fans out user jobs for a board's active connections when a catalogue job completes its initial fill", async () => {
    const board = "aurora";
    const userA = await seedConnection(board, "tok-a", "2026-06-01T00:00:00.000Z");
    const userB = await seedConnection(board, "tok-b", "2026-06-02T00:00:00.000Z");
    const { fetchImpl } = makeFakeFetch([
      {
        match: (url) => url.endsWith("/sync"),
        respond: () =>
          jsonResponse(200, {
            climbs: [{ uuid: "c1", name: "Jug Life" }],
            climb_stats: [{ climb_uuid: "c1", angle: 40, difficulty_average: 20.0 }],
            shared_syncs: [
              { table_name: "climb_stats", last_synchronized_at: "2026-08-08 00:00:00.000000" },
              { table_name: "climbs", last_synchronized_at: "2026-08-08 00:00:00.000000" },
            ],
            _complete: true,
          }),
      },
    ]);
    vi.stubGlobal("fetch", fetchImpl);

    const sent: SyncJob[] = [];
    const sentJobs: SentJob[] = [];
    const msg = message({ kind: "catalogue", board });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent, sentJobs));

    expect(msg.acked).toBe(true);
    const userJobs = sentJobs.filter((j) => j.body.kind === "user");
    expect(userJobs).toHaveLength(2);
    expect(userJobs.map((j) => j.body)).toEqual(
      expect.arrayContaining([
        { kind: "user", userId: userA, board },
        { kind: "user", userId: userB, board },
      ])
    );
  });

  it("does not fan out to a connection whose user has auto-sync switched off", async () => {
    const board = "kilter";
    const autoUser = await seedConnection(board, "tok-auto", "2026-06-01T00:00:00.000Z", true);
    const manualUser = await seedConnection(board, "tok-manual", "2026-06-02T00:00:00.000Z", false);
    const { fetchImpl } = makeFakeFetch([
      {
        match: (url) => url.endsWith("/sync"),
        respond: () =>
          jsonResponse(200, {
            climbs: [{ uuid: "c1", name: "Jug Life" }],
            climb_stats: [{ climb_uuid: "c1", angle: 40, difficulty_average: 20.0 }],
            shared_syncs: [
              { table_name: "climb_stats", last_synchronized_at: "2026-08-08 00:00:00.000000" },
              { table_name: "climbs", last_synchronized_at: "2026-08-08 00:00:00.000000" },
            ],
            _complete: true,
          }),
      },
    ]);
    vi.stubGlobal("fetch", fetchImpl);

    const sent: SyncJob[] = [];
    const sentJobs: SentJob[] = [];
    const msg = message({ kind: "catalogue", board });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent, sentJobs));

    expect(msg.acked).toBe(true);
    const userJobs = sentJobs.filter((j) => j.body.kind === "user");
    expect(userJobs.map((j) => j.body)).toEqual([{ kind: "user", userId: autoUser, board }]);
    expect(userJobs.map((j) => j.body)).not.toEqual(
      expect.arrayContaining([{ kind: "user", userId: manualUser, board }])
    );
  });

  it("chunks a large batch of jobs into sendBatch calls of at most 100 messages", async () => {
    const jobs: SyncJob[] = Array.from({ length: 150 }, (_, i) => ({
      kind: "user" as const,
      userId: `user-${i}`,
    }));
    const batchSizes: number[] = [];
    const sent: SyncJob[] = [];
    const queue = {
      send: async () => {},
      sendBatch: async (batch: { body: SyncJob }[]) => {
        batchSizes.push(batch.length);
        sent.push(...batch.map((b) => b.body));
      },
    } as unknown as Env["SYNC_QUEUE"];

    await sendBatched(queue, jobs);

    expect(sent).toHaveLength(150);
    expect(batchSizes).toEqual([100, 50]);
  });

  it("does not fan out user jobs after a routine daily catalogue refresh", async () => {
    const board = "touchstone";
    await seedConnection(board, "tok-refresh", "2026-06-01T00:00:00.000Z");
    await env.DB.prepare(
      `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, 'cache_complete', '1')`
    )
      .bind(board)
      .run();
    const { fetchImpl } = makeFakeFetch([
      {
        match: (url) => url.endsWith("/sync"),
        respond: () =>
          jsonResponse(200, {
            climbs: [{ uuid: "c1", name: "Jug Life" }],
            climb_stats: [{ climb_uuid: "c1", angle: 40, difficulty_average: 20.0 }],
            shared_syncs: [
              { table_name: "climb_stats", last_synchronized_at: "2026-08-08 00:00:00.000000" },
              { table_name: "climbs", last_synchronized_at: "2026-08-08 00:00:00.000000" },
            ],
            _complete: true,
          }),
      },
    ]);
    vi.stubGlobal("fetch", fetchImpl);

    const sent: SyncJob[] = [];
    const sentJobs: SentJob[] = [];
    const msg = message({ kind: "catalogue", board });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent, sentJobs));

    expect(msg.acked).toBe(true);
    expect(sentJobs).toHaveLength(0);
  });

  it("treats a corrupt catalogue_enqueued_at cursor as due rather than blocking forever", async () => {
    const board = "decoy_corrupt";
    const userId = await seedConnection(board, "tok-corrupt", "2026-06-01T00:00:00.000Z");
    await env.DB.prepare(
      `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, 'catalogue_enqueued_at', 'not-a-date')`
    )
      .bind(board)
      .run();

    const sent: SyncJob[] = [];
    const msg = message({ kind: "user", userId });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent));

    expect(sent).toEqual([{ kind: "catalogue", board }]);
  });

  it("does not claim the catalogue enqueue window when the send fails", async () => {
    const board = "decoy_send_fail";
    const userId = await seedConnection(board, "tok-fail", "2026-06-01T00:00:00.000Z");

    const failingEnv = {
      ...env,
      SYNC_QUEUE: {
        send: async () => {
          throw new Error("queue unavailable");
        },
        sendBatch: async () => {},
      },
    } as unknown as Env;

    const msg = message({ kind: "user", userId });
    await expect(worker.queue({ messages: [msg] } as never, failingEnv)).rejects.toThrow(
      "queue unavailable"
    );

    const stamp = await boardCursorValue(board, "catalogue_enqueued_at");
    expect(stamp).toBeNull();
  });

  it("refreshes catalogue_enqueued_at on each continuing round of an initial fill", async () => {
    const board = "tension";
    await seedConnection(board, "tok-chain", "2026-06-01T00:00:00.000Z");
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
    vi.stubGlobal("fetch", fetchImpl);

    const sent1: SyncJob[] = [];
    await worker.queue(
      { messages: [message({ kind: "catalogue", board })] } as never,
      envWithQueue(sent1)
    );
    const firstStamp = await boardCursorValue(board, "catalogue_enqueued_at");
    expect(firstStamp).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 5));

    const sent2: SyncJob[] = [];
    await worker.queue(
      { messages: [message({ kind: "catalogue", board })] } as never,
      envWithQueue(sent2)
    );
    const secondStamp = await boardCursorValue(board, "catalogue_enqueued_at");
    expect(secondStamp).not.toBeNull();
    expect(secondStamp).not.toBe(firstStamp);
  });

  it("writes a last_catalogue_error breadcrumb before rethrowing from the catalogue branch", async () => {
    const board = "decoy";
    await seedConnection(board, "tok-stuck", "2026-06-01T00:00:00.000Z");
    const stuckTimestamp = "2026-07-01 00:00:00.000000";
    await env.DB.prepare(
      `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, 'cache_complete', '1')`
    )
      .bind(board)
      .run();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, 'climb_stats', ?)`
    )
      .bind(board, stuckTimestamp)
      .run();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, 'climbs', ?)`
    )
      .bind(board, stuckTimestamp)
      .run();

    const { fetchImpl } = makeFakeFetch([
      {
        match: (url) => url.endsWith("/sync"),
        respond: () =>
          jsonResponse(200, {
            climbs: [],
            climb_stats: [],
            shared_syncs: [
              { table_name: "climb_stats", last_synchronized_at: stuckTimestamp },
              { table_name: "climbs", last_synchronized_at: stuckTimestamp },
            ],
            _complete: false,
          }),
      },
    ]);
    vi.stubGlobal("fetch", fetchImpl);

    const msg = message({ kind: "catalogue", board });
    await expect(worker.queue({ messages: [msg] } as never, envWithQueue([]))).rejects.toThrow(
      "made no progress"
    );

    const breadcrumb = await boardCursorValue("_meta", "last_catalogue_error");
    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb).toContain(board);
    expect(breadcrumb).toContain("made no progress");
  });
});

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
