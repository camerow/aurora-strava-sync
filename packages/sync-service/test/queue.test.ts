import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
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

function envWithQueue(sent: SyncJob[], sentJobs: SentJob[] = []): Env {
  return {
    ...env,
    SYNC_QUEUE: {
      send: async (b: SyncJob, options?: { delaySeconds?: number }) => {
        sent.push(b);
        sentJobs.push({ body: b, options });
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

async function seedConnection(board: string, token: string, connectedAt: string): Promise<string> {
  const userId = `queue_cat_user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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

  it("re-enqueues a user job with a delay when the board catalogue is pending", async () => {
    const board = "so_ill";
    const userId = await seedConnection(board, "tok-pending", "2026-06-01T00:00:00.000Z");

    const sent: SyncJob[] = [];
    const sentJobs: SentJob[] = [];
    const msg = message({ kind: "user", userId });
    await worker.queue({ messages: [msg] } as never, envWithQueue(sent, sentJobs));

    expect(msg.acked).toBe(true);
    expect(msg.retried).toBe(false);
    expect(sentJobs).toEqual([{ body: { kind: "user", userId }, options: { delaySeconds: 60 } }]);
  });
});
