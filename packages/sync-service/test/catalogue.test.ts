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
    expect(outcome).toEqual({ status: "complete", initialFill: true });

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
    expect(outcome).toEqual({ status: "complete", initialFill: true });

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

  it("takes the daily refresh path for a board with a complete catalogue and reports complete", async () => {
    const board = "aurora";
    await seedConnection(board, "tok-live", "2026-06-01T00:00:00.000Z");
    await env.DB.prepare(
      `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, 'cache_complete', '1')`
    )
      .bind(board)
      .run();
    const { fetchImpl } = makeFakeFetch([cataloguePage(true, "2026-08-08 00:00:00.000000")]);

    const outcome = await syncBoardCatalogue(env, board, fetchImpl);
    expect(outcome).toEqual({ status: "complete" });
  });

  it("reports continuing when the daily refresh exhausts its page budget", async () => {
    const board = "grasshopper";
    await seedConnection(board, "tok-live", "2026-06-01T00:00:00.000Z");
    await env.DB.prepare(
      `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, 'cache_complete', '1')`
    )
      .bind(board)
      .run();
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
});
