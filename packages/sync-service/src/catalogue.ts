import type { Env } from "./bindings";
import { AuroraClient, baseUrlFor, BoardTokenRejectedError } from "./lib/aurora";
import { decryptSecret } from "./lib/crypto";
import * as repo from "./lib/repo";

export const CACHE_FILL_PAGES = 12;
export const CACHE_DAILY_PAGES = 24;
export const CACHE_REFRESH_PAGES = 4;

export type CatalogueOutcome = {
  status: "complete" | "continuing" | "no_credentials" | "unknown_board";
  initialFill?: boolean;
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
): Promise<boolean> {
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
  return result.complete;
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
    return { status: "complete", initialFill: true };
  }
  const complete = await refreshSharedCache(env, aurora, board, token, CACHE_DAILY_PAGES);
  return complete ? { status: "complete" } : { status: "continuing" };
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
