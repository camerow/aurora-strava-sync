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
import { CACHE_REFRESH_PAGES, refreshSharedCache } from "./catalogue";
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

export type SyncStatus =
  | "synced"
  | "no_strava"
  | "cache_filling"
  | "rate_limited"
  | "board_dead"
  | "strava_dead"
  | "not_connected";

export type SyncOutcome = {
  status: SyncStatus;
  posted: number;
};

const STATUS_PRIORITY: SyncStatus[] = [
  "rate_limited",
  "cache_filling",
  "strava_dead",
  "board_dead",
  "synced",
  "no_strava",
  "not_connected",
];

export async function syncOneUser(
  env: Env,
  userId: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
  board?: string
): Promise<SyncOutcome> {
  const user = await repo.getUser(env.DB, userId);
  if (user === null) return { status: "not_connected", posted: 0 };

  const connections =
    board === undefined
      ? await repo.listBoardConnections(env.DB, userId)
      : [await repo.getBoardConnection(env.DB, userId, board)].filter(
          (c): c is repo.BoardConnectionRow => c !== null
        );
  if (connections.length === 0) return { status: "not_connected", posted: 0 };

  const stravaConn = await repo.getStravaConnection(env.DB, userId);
  const outcomes: SyncOutcome[] = [];
  for (const conn of connections) {
    outcomes.push(await syncOneBoard(env, user, conn, stravaConn, fetchImpl));
  }

  const status = STATUS_PRIORITY.find((s) => outcomes.some((o) => o.status === s)) ?? "synced";
  const posted = outcomes.reduce((a, o) => a + o.posted, 0);
  if (status !== "rate_limited" && status !== "cache_filling") {
    const boardDead = outcomes.some((o) => o.status === "board_dead");
    const stravaDead = outcomes.some((o) => o.status === "strava_dead");
    await repo.recordSyncResult(
      env.DB,
      userId,
      stravaDead ? "strava token rejected" : boardDead ? "board token rejected" : null
    );
  }
  return { status, posted };
}

async function syncOneBoard(
  env: Env,
  user: repo.UserRow,
  boardConn: repo.BoardConnectionRow,
  stravaConn: repo.StravaConnectionRow | null,
  fetchImpl: typeof fetch
): Promise<SyncOutcome> {
  const userId = user.id;
  if (boardConn.status !== "active") return { status: "board_dead", posted: 0 };

  const baseUrl = baseUrlFor(boardConn.board);
  if (baseUrl === undefined) throw new Error(`unknown board ${boardConn.board}`);
  const aurora = new AuroraClient(baseUrl, fetchImpl);
  const boardToken = await decryptSecret(boardConn.token_ciphertext, env.TOKEN_KEY);

  let ascents: Ascent[];
  let bids: Bid[];
  try {
    ({ ascents, bids } = await aurora.syncUser(boardToken));
  } catch (err) {
    if (err instanceof BoardTokenRejectedError) {
      await repo.markBoardConnectionDead(env.DB, userId, boardConn.board);
      return { status: "board_dead", posted: 0 };
    }
    throw err;
  }

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

  const climbs = await toClimbs(env, boardConn.board, ascents, bids);
  const sessions = buildSessions(climbs, defaultSessionConfig(), wallClockNow(user.timezone));

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

  for (const s of scored) {
    await repo.upsertScoredSession(env.DB, userId, {
      fingerprint: s.fp,
      board: boardConn.board,
      start_at: s.sess.start.toISOString(),
      end_at: s.sess.end.toISOString(),
      climb_count: s.sess.climbs.length,
      top_grade: topGrade(s.sess),
      rpe: s.result.rpe,
      title: s.result.title,
      summary: s.result.summary,
      climbs_json: JSON.stringify(
        s.sess.climbs.map((c) => ({
          time: c.time.toISOString(),
          name: c.name,
          vGrade: c.vGrade,
          kind: c.kind,
          tries: c.tries,
          angle: c.angle ?? null,
        }))
      ),
    });
  }

  if (stravaConn === null || stravaConn.status !== "active" || boardConn.posting_enabled !== 1) {
    return { status: "no_strava", posted: 0 };
  }

  const postCutoff = boardConn.post_since === null ? null : parseAuroraTime(boardConn.post_since);
  const posted = await repo.postedSessionFingerprints(env.DB, userId);
  const toPost = scored.filter(
    (s) =>
      !s.sess.inProgress &&
      !posted.has(s.fp) &&
      (postCutoff === null || s.sess.start.getTime() >= postCutoff.getTime())
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
      return { status: "strava_dead", posted: postedCount };
    }
    throw err;
  }

  await persistRefreshedTokens(env, userId, strava);
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
      angle: a.angle,
    });
  }
  for (const b of bids) {
    out.push({
      time: parseAuroraTime(b.climbed_at),
      vGrade: grades.get(`${b.climb_uuid}:${b.angle}`) ?? -1,
      name: names.get(b.climb_uuid) ?? "",
      kind: "attempt",
      tries: b.bid_count,
      angle: b.angle,
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
