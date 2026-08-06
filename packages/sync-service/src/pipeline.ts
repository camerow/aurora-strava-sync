import {
  buildSessions,
  defaultEffortConfig,
  defaultSessionConfig,
  score,
  v,
  type Climb,
  type Session,
} from "@sendtally/core";
import type { Env } from "./bindings";
import {
  AuroraClient,
  baseUrlFor,
  BoardTokenRejectedError,
  type Ascent,
  type Bid,
} from "./lib/aurora";
import { decryptSecret, encryptSecret } from "./lib/crypto";
import { fingerprint } from "./lib/fingerprint";
import * as repo from "./lib/repo";
import { StravaClient, StravaRateLimitedError, StravaUnauthorizedError } from "./lib/strava";
import { parseAuroraTime, wallClockNow } from "./lib/time";

export type SyncOutcome = {
  status:
    | "synced"
    | "no_strava"
    | "cache_filling"
    | "rate_limited"
    | "board_dead"
    | "strava_dead"
    | "not_connected";
  posted: number;
};

const CACHE_FILL_PAGES = 12;
const CACHE_REFRESH_PAGES = 4;

export class CacheFillInProgressError extends Error {}

export async function syncOneUser(
  env: Env,
  userId: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init)
): Promise<SyncOutcome> {
  const user = await repo.getUser(env.DB, userId);
  const boardConn = await repo.getBoardConnection(env.DB, userId);
  const stravaConn = await repo.getStravaConnection(env.DB, userId);
  if (user === null || boardConn === null) {
    return { status: "not_connected", posted: 0 };
  }
  if (boardConn.status !== "active") return { status: "board_dead", posted: 0 };

  const baseUrl = baseUrlFor(boardConn.board);
  if (baseUrl === undefined) throw new Error(`unknown board ${boardConn.board}`);
  const aurora = new AuroraClient(baseUrl, fetchImpl);
  const boardToken = await decryptSecret(boardConn.token_ciphertext, env.TOKEN_KEY);

  let ascents: Ascent[];
  let bids: Bid[];
  try {
    await ensureBoardCache(env, aurora, boardConn.board, boardToken);
    ({ ascents, bids } = await aurora.syncUser(boardToken));
  } catch (err) {
    if (err instanceof CacheFillInProgressError) {
      return { status: "cache_filling", posted: 0 };
    }
    if (err instanceof BoardTokenRejectedError) {
      await repo.markBoardConnectionDead(env.DB, userId);
      await repo.recordSyncResult(env.DB, userId, "board token rejected");
      return { status: "board_dead", posted: 0 };
    }
    throw err;
  }

  const climbs = await toClimbs(env, boardConn.board, ascents, bids);
  const sessions = buildSessions(climbs, defaultSessionConfig(), wallClockNow(user.timezone));

  const effortCfg = defaultEffortConfig();
  const scored = sessions.map((sess, i) => ({
    sess,
    result: score(sess, [...sessions.slice(0, i), ...sessions.slice(i + 1)], effortCfg),
    fp: fingerprint(boardConn.board_user_id, sess.climbs[0]!.time),
  }));

  for (const s of scored) {
    await repo.upsertScoredSession(env.DB, userId, {
      fingerprint: s.fp,
      start_at: s.sess.start.toISOString(),
      end_at: s.sess.end.toISOString(),
      climb_count: s.sess.climbs.length,
      top_grade: topGrade(s.sess),
      rpe: s.result.rpe,
      title: s.result.title,
      summary: s.result.summary,
    });
  }

  if (stravaConn === null || stravaConn.status !== "active" || stravaConn.posting_enabled !== 1) {
    await repo.recordSyncResult(env.DB, userId, null);
    return { status: "no_strava", posted: 0 };
  }

  const postCutoff = stravaConn.post_since === null ? null : parseAuroraTime(stravaConn.post_since);
  const posted = await repo.postedSessionFingerprints(env.DB, userId);
  const toPost = scored.filter(
    (s) =>
      !posted.has(s.fp) && (postCutoff === null || s.sess.start.getTime() >= postCutoff.getTime())
  );

  const strava = new StravaClient(
    { clientId: env.STRAVA_CLIENT_ID, clientSecret: env.STRAVA_CLIENT_SECRET },
    {
      accessToken: await decryptSecret(stravaConn.access_token_ciphertext, env.TOKEN_KEY),
      refreshToken: await decryptSecret(stravaConn.refresh_token_ciphertext, env.TOKEN_KEY),
      expiresAt: stravaConn.expires_at,
    },
    fetchImpl
  );

  let postedCount = 0;
  try {
    for (const s of toPost) {
      const activityId = await strava.createActivity({
        name: s.result.title,
        description: s.result.summary,
        startDateLocal: s.sess.start,
        elapsedSeconds: Math.floor((s.sess.end.getTime() - s.sess.start.getTime()) / 1000),
        perceivedExertion: s.result.rpe,
      });
      await repo.markSessionPosted(env.DB, userId, s.fp, activityId);
      try {
        await strava.setPerceivedExertion(activityId, s.result.rpe);
      } catch (err) {
        if (err instanceof StravaRateLimitedError) throw err;
      }
      postedCount++;
    }
  } catch (err) {
    if (err instanceof StravaRateLimitedError) {
      await persistRefreshedTokens(env, userId, strava);
      await repo.recordSyncResult(env.DB, userId, "strava rate limited");
      return { status: "rate_limited", posted: postedCount };
    }
    if (err instanceof StravaUnauthorizedError) {
      await repo.markStravaConnectionDeadByAthlete(env.DB, stravaConn.athlete_id);
      await repo.recordSyncResult(env.DB, userId, "strava token rejected");
      return { status: "strava_dead", posted: postedCount };
    }
    throw err;
  }

  await persistRefreshedTokens(env, userId, strava);
  await repo.recordSyncResult(env.DB, userId, null);
  return { status: "synced", posted: postedCount };
}

async function persistRefreshedTokens(
  env: Env,
  userId: string,
  strava: StravaClient
): Promise<void> {
  if (!strava.wasRefreshed()) return;
  const t = strava.currentTokens();
  await repo.updateStravaTokens(
    env.DB,
    userId,
    await encryptSecret(t.accessToken, env.TOKEN_KEY),
    await encryptSecret(t.refreshToken, env.TOKEN_KEY),
    t.expiresAt
  );
}

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
    throw new CacheFillInProgressError(`board cache fill for ${board}/${table} continuing`);
  }
  await repo.setBoardCursor(env.DB, board, doneKey, "1");
}

async function ensureBoardCache(
  env: Env,
  aurora: AuroraClient,
  board: string,
  token: string
): Promise<void> {
  if ((await repo.getBoardCursor(env.DB, board, "cache_complete")) !== "1") {
    await fillTable(env, aurora, board, token, "climbs");
    await fillTable(env, aurora, board, token, "climb_stats");
    await repo.setBoardCursor(env.DB, board, "cache_complete", "1");
    return;
  }
  const statsSince = await repo.getBoardCursor(env.DB, board, "climb_stats");
  const climbsSince = await repo.getBoardCursor(env.DB, board, "climbs");
  const result = await aurora.syncShared(
    token,
    statsSince,
    climbsSince,
    CACHE_REFRESH_PAGES,
    async (stats, climbs) => {
      await repo.putClimbData(env.DB, board, stats, climbs);
    }
  );
  await repo.setBoardCursor(env.DB, board, "climb_stats", result.statsCursor);
  await repo.setBoardCursor(env.DB, board, "climbs", result.climbsCursor);
}

async function toClimbs(env: Env, board: string, ascents: Ascent[], bids: Bid[]): Promise<Climb[]> {
  const uuids = [...ascents.map((a) => a.climb_uuid), ...bids.map((b) => b.climb_uuid)];
  const names = await repo.climbNamesFor(env.DB, board, uuids);
  const grades = await repo.climbVGradesFor(
    env.DB,
    board,
    bids.map((b) => b.climb_uuid)
  );
  const out: Climb[] = [];
  for (const a of ascents) {
    out.push({
      time: parseAuroraTime(a.climbed_at),
      vGrade: v(a.difficulty) ?? -1,
      name: names.get(a.climb_uuid) ?? "",
      kind: "send",
      tries: a.bid_count,
    });
  }
  for (const b of bids) {
    out.push({
      time: parseAuroraTime(b.climbed_at),
      vGrade: grades.get(`${b.climb_uuid}:${b.angle}`) ?? -1,
      name: names.get(b.climb_uuid) ?? "",
      kind: "attempt",
      tries: b.bid_count,
    });
  }
  return out;
}

function topGrade(s: Session): number {
  let hi = -1;
  for (const c of s.climbs) {
    if (c.vGrade > hi) hi = c.vGrade;
  }
  return hi;
}
