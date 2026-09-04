import { and, desc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";
import { vFromDisplay } from "@sendtally/core";
import type { ClimbRow, ClimbStat } from "./aurora";
import {
  boardClimbNames,
  boardClimbStats,
  boardConnections,
  boardCursors,
  sessions,
  stravaConnections,
  syncState,
  users,
} from "../db/schema";

export type UserRow = typeof users.$inferSelect;

export type BoardConnectionRow = typeof boardConnections.$inferSelect;

export type StravaConnectionRow = typeof stravaConnections.$inferSelect;

export type SessionRow = {
  fingerprint: string;
  board: string | null;
  source: string;
  location: string | null;
  name: string | null;
  start_at: string;
  end_at: string;
  climb_count: number;
  top_grade: number;
  top_send_grade: number;
  rpe: number;
  title: string;
  strava_activity_id: number | null;
  posted_at: string | null;
};

const sessionListColumns = {
  fingerprint: sessions.fingerprint,
  board: sessions.board,
  source: sessions.source,
  location: sessions.location,
  name: sessions.name,
  start_at: sessions.start_at,
  end_at: sessions.end_at,
  climb_count: sessions.climb_count,
  top_grade: sessions.top_grade,
  top_send_grade: sessions.top_send_grade,
  rpe: sessions.rpe,
  title: sessions.title,
  strava_activity_id: sessions.strava_activity_id,
  posted_at: sessions.posted_at,
};

export async function upsertUser(db: D1Database, id: string, timezone: string): Promise<void> {
  await drizzle(db)
    .insert(users)
    .values({ id, timezone, created_at: new Date().toISOString() })
    .onConflictDoUpdate({ target: users.id, set: { timezone } });
}

export async function ensureUser(db: D1Database, id: string): Promise<void> {
  await drizzle(db)
    .insert(users)
    .values({ id, created_at: new Date().toISOString() })
    .onConflictDoNothing();
}

export async function getUser(db: D1Database, id: string): Promise<UserRow | null> {
  const row = await drizzle(db).select().from(users).where(eq(users.id, id)).get();
  return row ?? null;
}

export async function setAutoSync(db: D1Database, id: string, enabled: boolean): Promise<void> {
  await drizzle(db)
    .update(users)
    .set({ auto_sync: enabled ? 1 : 0 })
    .where(eq(users.id, id));
}

export type BoardConnectionInput = {
  user_id: string;
  board: string;
  board_user_id: number;
  token_ciphertext: string;
  sync_since: string | null;
};

export async function upsertBoardConnection(
  db: D1Database,
  row: BoardConnectionInput
): Promise<void> {
  const connected_at = new Date().toISOString();
  await drizzle(db)
    .insert(boardConnections)
    .values({ ...row, status: "active", connected_at })
    .onConflictDoUpdate({
      target: [boardConnections.user_id, boardConnections.board],
      set: {
        board_user_id: row.board_user_id,
        token_ciphertext: row.token_ciphertext,
        status: "active",
        sync_since: row.sync_since,
        connected_at,
      },
    });
}

export async function listBoardConnections(
  db: D1Database,
  userId: string
): Promise<BoardConnectionRow[]> {
  return drizzle(db)
    .select()
    .from(boardConnections)
    .where(eq(boardConnections.user_id, userId))
    .orderBy(boardConnections.connected_at)
    .all();
}

export async function getBoardConnection(
  db: D1Database,
  userId: string,
  board: string
): Promise<BoardConnectionRow | null> {
  const row = await drizzle(db)
    .select()
    .from(boardConnections)
    .where(and(eq(boardConnections.user_id, userId), eq(boardConnections.board, board)))
    .get();
  return row ?? null;
}

export async function markBoardConnectionDead(
  db: D1Database,
  userId: string,
  board: string
): Promise<void> {
  await drizzle(db)
    .update(boardConnections)
    .set({ status: "dead" })
    .where(and(eq(boardConnections.user_id, userId), eq(boardConnections.board, board)));
}

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

export async function autoSyncBoardConnectionsForBoard(
  db: D1Database,
  board: string
): Promise<BoardConnectionRow[]> {
  const rows = await drizzle(db)
    .select({ conn: boardConnections })
    .from(boardConnections)
    .innerJoin(users, eq(users.id, boardConnections.user_id))
    .where(
      and(
        eq(boardConnections.board, board),
        eq(boardConnections.status, "active"),
        eq(users.auto_sync, 1)
      )
    )
    .orderBy(desc(boardConnections.connected_at))
    .all();
  return rows.map((r) => r.conn);
}

export async function boardsWithActiveConnections(db: D1Database): Promise<string[]> {
  const rows = await drizzle(db)
    .selectDistinct({ board: boardConnections.board })
    .from(boardConnections)
    .where(eq(boardConnections.status, "active"))
    .all();
  return rows.map((r) => r.board);
}

export async function setBoardPosting(
  db: D1Database,
  userId: string,
  board: string,
  enabled: boolean,
  postSince: string | null
): Promise<void> {
  await drizzle(db)
    .update(boardConnections)
    .set({ posting_enabled: enabled ? 1 : 0, post_since: postSince })
    .where(and(eq(boardConnections.user_id, userId), eq(boardConnections.board, board)));
}

export type StravaConnectionInput = {
  user_id: string;
  athlete_id: number;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  expires_at: number;
};

export async function upsertStravaConnection(
  db: D1Database,
  row: StravaConnectionInput
): Promise<void> {
  const connected_at = new Date().toISOString();
  await drizzle(db)
    .insert(stravaConnections)
    .values({ ...row, status: "active", connected_at })
    .onConflictDoUpdate({
      target: stravaConnections.user_id,
      set: {
        athlete_id: row.athlete_id,
        access_token_ciphertext: row.access_token_ciphertext,
        refresh_token_ciphertext: row.refresh_token_ciphertext,
        expires_at: row.expires_at,
        status: "active",
        connected_at,
      },
    });
}

export async function getStravaConnection(
  db: D1Database,
  userId: string
): Promise<StravaConnectionRow | null> {
  const row = await drizzle(db)
    .select()
    .from(stravaConnections)
    .where(eq(stravaConnections.user_id, userId))
    .get();
  return row ?? null;
}

export async function updateStravaTokens(
  db: D1Database,
  userId: string,
  accessTokenCiphertext: string,
  refreshTokenCiphertext: string,
  expiresAt: number
): Promise<void> {
  await drizzle(db)
    .update(stravaConnections)
    .set({
      access_token_ciphertext: accessTokenCiphertext,
      refresh_token_ciphertext: refreshTokenCiphertext,
      expires_at: expiresAt,
    })
    .where(eq(stravaConnections.user_id, userId));
}

export async function markStravaConnectionDeadByAthlete(
  db: D1Database,
  athleteId: number
): Promise<void> {
  await drizzle(db)
    .update(stravaConnections)
    .set({ status: "dead" })
    .where(eq(stravaConnections.athlete_id, athleteId));
}

export type ScoredSessionInput = {
  fingerprint: string;
  board: string;
  start_at: string;
  end_at: string;
  climb_count: number;
  top_grade: number;
  top_send_grade: number;
  rpe: number;
  title: string;
  summary: string;
  climbs_json: string;
};

export async function upsertScoredSession(
  db: D1Database,
  userId: string,
  s: ScoredSessionInput
): Promise<void> {
  await drizzle(db)
    .insert(sessions)
    .values({ user_id: userId, ...s })
    .onConflictDoUpdate({
      target: [sessions.user_id, sessions.fingerprint],
      set: {
        board: s.board,
        start_at: s.start_at,
        end_at: s.end_at,
        climb_count: s.climb_count,
        top_grade: s.top_grade,
        top_send_grade: s.top_send_grade,
        rpe: s.rpe,
        title: s.title,
        summary: s.summary,
        climbs_json: s.climbs_json,
      },
    });
}

export type ManualSessionInput = {
  fingerprint: string;
  location: string;
  name: string | null;
  start_at: string;
  end_at: string;
  climb_count: number;
  top_grade: number;
  top_send_grade: number;
  rpe: number;
  title: string;
  summary: string;
  climbs_json: string;
};

export async function insertManualSession(
  db: D1Database,
  userId: string,
  s: ManualSessionInput
): Promise<void> {
  await drizzle(db)
    .insert(sessions)
    .values({ user_id: userId, source: "manual", board: null, ...s });
}

export async function updateManualSession(
  db: D1Database,
  userId: string,
  s: ManualSessionInput
): Promise<boolean> {
  const { fingerprint, ...rest } = s;
  const result = await drizzle(db)
    .update(sessions)
    .set(rest)
    .where(
      and(
        eq(sessions.user_id, userId),
        eq(sessions.fingerprint, fingerprint),
        eq(sessions.source, "manual")
      )
    );
  return result.meta.changes > 0;
}

export async function deleteManualSession(
  db: D1Database,
  userId: string,
  fingerprint: string
): Promise<boolean> {
  const result = await drizzle(db)
    .delete(sessions)
    .where(
      and(
        eq(sessions.user_id, userId),
        eq(sessions.fingerprint, fingerprint),
        eq(sessions.source, "manual")
      )
    );
  return result.meta.changes > 0;
}

export async function markSessionPosted(
  db: D1Database,
  userId: string,
  fp: string,
  stravaActivityId: number
): Promise<void> {
  await drizzle(db)
    .update(sessions)
    .set({ strava_activity_id: stravaActivityId, posted_at: new Date().toISOString() })
    .where(and(eq(sessions.user_id, userId), eq(sessions.fingerprint, fp)));
}

export async function postedSessionFingerprints(
  db: D1Database,
  userId: string
): Promise<Set<string>> {
  const rows = await drizzle(db)
    .select({ fingerprint: sessions.fingerprint })
    .from(sessions)
    .where(and(eq(sessions.user_id, userId), isNotNull(sessions.strava_activity_id)))
    .all();
  return new Set(rows.map((r) => r.fingerprint));
}

export async function listSessions(
  db: D1Database,
  userId: string,
  limit: number,
  includeClimbs = false
): Promise<Array<SessionRow & { climbs_json?: string | null }>> {
  const d = drizzle(db);
  const query = includeClimbs
    ? d.select({ ...sessionListColumns, climbs_json: sessions.climbs_json }).from(sessions)
    : d.select(sessionListColumns).from(sessions);
  return query
    .where(eq(sessions.user_id, userId))
    .orderBy(desc(sessions.start_at))
    .limit(limit)
    .all();
}

export async function getSession(
  db: D1Database,
  userId: string,
  fingerprint: string
): Promise<(SessionRow & { climbs_json: string | null }) | null> {
  const row = await drizzle(db)
    .select({ ...sessionListColumns, climbs_json: sessions.climbs_json })
    .from(sessions)
    .where(and(eq(sessions.user_id, userId), eq(sessions.fingerprint, fingerprint)))
    .get();
  return row ?? null;
}

const IN_CHUNK = 90;

export async function climbNamesFor(
  db: D1Database,
  board: string,
  climbUuids: string[]
): Promise<Map<string, string>> {
  const d = drizzle(db);
  const out = new Map<string, string>();
  const unique = [...new Set(climbUuids)];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const chunk = unique.slice(i, i + IN_CHUNK);
    const rows = await d
      .select({ climb_uuid: boardClimbNames.climb_uuid, name: boardClimbNames.name })
      .from(boardClimbNames)
      .where(and(eq(boardClimbNames.board, board), inArray(boardClimbNames.climb_uuid, chunk)))
      .all();
    for (const r of rows) out.set(r.climb_uuid, r.name);
  }
  return out;
}

export async function climbVGradesFor(
  db: D1Database,
  board: string,
  climbUuids: string[]
): Promise<Map<string, number>> {
  const d = drizzle(db);
  const out = new Map<string, number>();
  const unique = [...new Set(climbUuids)];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const chunk = unique.slice(i, i + IN_CHUNK);
    const rows = await d
      .select({
        climb_uuid: boardClimbStats.climb_uuid,
        angle: boardClimbStats.angle,
        display_difficulty: boardClimbStats.display_difficulty,
      })
      .from(boardClimbStats)
      .where(and(eq(boardClimbStats.board, board), inArray(boardClimbStats.climb_uuid, chunk)))
      .all();
    for (const r of rows) {
      const grade = vFromDisplay(r.display_difficulty);
      if (grade !== undefined) out.set(`${r.climb_uuid}:${r.angle}`, grade);
    }
  }
  return out;
}

export async function putClimbData(
  db: D1Database,
  board: string,
  stats: ClimbStat[],
  climbs: ClimbRow[]
): Promise<void> {
  const d = drizzle(db);
  const statements: BatchItem<"sqlite">[] = [];
  for (const s of stats) {
    const difficulty = s.display_difficulty ?? s.difficulty_average;
    if (s.climb_uuid == null || s.angle == null || difficulty == null) continue;
    statements.push(
      d
        .insert(boardClimbStats)
        .values({ board, climb_uuid: s.climb_uuid, angle: s.angle, display_difficulty: difficulty })
        .onConflictDoUpdate({
          target: [boardClimbStats.board, boardClimbStats.climb_uuid, boardClimbStats.angle],
          set: { display_difficulty: difficulty },
        })
    );
  }
  for (const c of climbs) {
    if (c.uuid == null) continue;
    statements.push(
      d
        .insert(boardClimbNames)
        .values({ board, climb_uuid: c.uuid, name: c.name ?? "" })
        .onConflictDoUpdate({
          target: [boardClimbNames.board, boardClimbNames.climb_uuid],
          set: { name: c.name ?? "" },
        })
    );
  }
  const BATCH = 100;
  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    await d.batch(chunk as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  }
}

export async function getBoardCursor(
  db: D1Database,
  board: string,
  table: string
): Promise<string> {
  const row = await drizzle(db)
    .select({ value: boardCursors.value })
    .from(boardCursors)
    .where(and(eq(boardCursors.board, board), eq(boardCursors.table_name, table)))
    .get();
  return row?.value ?? "";
}

export async function setBoardCursor(
  db: D1Database,
  board: string,
  table: string,
  value: string
): Promise<void> {
  await drizzle(db)
    .insert(boardCursors)
    .values({ board, table_name: table, value })
    .onConflictDoUpdate({
      target: [boardCursors.board, boardCursors.table_name],
      set: { value },
    });
}

export type SyncStateRow = { last_synced_at: string | null; last_error: string | null };

export async function getSyncState(db: D1Database, userId: string): Promise<SyncStateRow | null> {
  const row = await drizzle(db)
    .select({ last_synced_at: syncState.last_synced_at, last_error: syncState.last_error })
    .from(syncState)
    .where(eq(syncState.user_id, userId))
    .get();
  return row ?? null;
}

export async function recordSyncResult(
  db: D1Database,
  userId: string,
  error: string | null
): Promise<void> {
  const last_synced_at = new Date().toISOString();
  await drizzle(db)
    .insert(syncState)
    .values({ user_id: userId, last_synced_at, last_error: error })
    .onConflictDoUpdate({
      target: syncState.user_id,
      set: { last_synced_at, last_error: error },
    });
}

export async function usersDueForSync(db: D1Database, olderThanMs: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const rows = await drizzle(db)
    .selectDistinct({ user_id: boardConnections.user_id })
    .from(boardConnections)
    .innerJoin(users, eq(users.id, boardConnections.user_id))
    .leftJoin(syncState, eq(syncState.user_id, boardConnections.user_id))
    .where(
      and(
        eq(boardConnections.status, "active"),
        eq(users.auto_sync, 1),
        or(isNull(syncState.last_synced_at), lt(syncState.last_synced_at, cutoff))
      )
    )
    .all();
  return rows.map((r) => r.user_id);
}
