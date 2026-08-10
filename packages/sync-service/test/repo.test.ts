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
