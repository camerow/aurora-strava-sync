import type { ClimbRow, ClimbStat } from "./aurora";
import { vFromDisplay } from "@sendtally/core";

export type UserRow = { id: string; timezone: string };

export type BoardConnectionRow = {
  user_id: string;
  board: string;
  board_user_id: number;
  token_ciphertext: string;
  status: string;
  sync_since: string | null;
};

export type StravaConnectionRow = {
  user_id: string;
  athlete_id: number;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  expires_at: number;
  status: string;
};

export type SessionRow = {
  fingerprint: string;
  start_at: string;
  end_at: string;
  climb_count: number;
  top_grade: number;
  rpe: number;
  title: string;
  strava_activity_id: number | null;
  posted_at: string | null;
};

export async function upsertUser(db: D1Database, id: string, timezone: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, timezone, created_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET timezone = excluded.timezone`
    )
    .bind(id, timezone, new Date().toISOString())
    .run();
}

export async function ensureUser(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', ?) ON CONFLICT(id) DO NOTHING`
    )
    .bind(id, new Date().toISOString())
    .run();
}

export async function getUser(db: D1Database, id: string): Promise<UserRow | null> {
  return db.prepare(`SELECT id, timezone FROM users WHERE id = ?`).bind(id).first<UserRow>();
}

export async function upsertBoardConnection(
  db: D1Database,
  row: Omit<BoardConnectionRow, "status">
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         board = excluded.board,
         board_user_id = excluded.board_user_id,
         token_ciphertext = excluded.token_ciphertext,
         status = 'active',
         sync_since = excluded.sync_since,
         connected_at = excluded.connected_at`
    )
    .bind(
      row.user_id,
      row.board,
      row.board_user_id,
      row.token_ciphertext,
      row.sync_since,
      new Date().toISOString()
    )
    .run();
}

export async function getBoardConnection(
  db: D1Database,
  userId: string
): Promise<BoardConnectionRow | null> {
  return db
    .prepare(
      `SELECT user_id, board, board_user_id, token_ciphertext, status, sync_since
       FROM board_connections WHERE user_id = ?`
    )
    .bind(userId)
    .first<BoardConnectionRow>();
}

export async function markBoardConnectionDead(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(`UPDATE board_connections SET status = 'dead' WHERE user_id = ?`)
    .bind(userId)
    .run();
}

export async function upsertStravaConnection(
  db: D1Database,
  row: Omit<StravaConnectionRow, "status">
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO strava_connections (user_id, athlete_id, access_token_ciphertext, refresh_token_ciphertext, expires_at, status, connected_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?)
       ON CONFLICT(user_id) DO UPDATE SET
         athlete_id = excluded.athlete_id,
         access_token_ciphertext = excluded.access_token_ciphertext,
         refresh_token_ciphertext = excluded.refresh_token_ciphertext,
         expires_at = excluded.expires_at,
         status = 'active',
         connected_at = excluded.connected_at`
    )
    .bind(
      row.user_id,
      row.athlete_id,
      row.access_token_ciphertext,
      row.refresh_token_ciphertext,
      row.expires_at,
      new Date().toISOString()
    )
    .run();
}

export async function getStravaConnection(
  db: D1Database,
  userId: string
): Promise<StravaConnectionRow | null> {
  return db
    .prepare(
      `SELECT user_id, athlete_id, access_token_ciphertext, refresh_token_ciphertext, expires_at, status
       FROM strava_connections WHERE user_id = ?`
    )
    .bind(userId)
    .first<StravaConnectionRow>();
}

export async function updateStravaTokens(
  db: D1Database,
  userId: string,
  accessTokenCiphertext: string,
  refreshTokenCiphertext: string,
  expiresAt: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE strava_connections
       SET access_token_ciphertext = ?, refresh_token_ciphertext = ?, expires_at = ?
       WHERE user_id = ?`
    )
    .bind(accessTokenCiphertext, refreshTokenCiphertext, expiresAt, userId)
    .run();
}

export async function markStravaConnectionDeadByAthlete(
  db: D1Database,
  athleteId: number
): Promise<void> {
  await db
    .prepare(`UPDATE strava_connections SET status = 'dead' WHERE athlete_id = ?`)
    .bind(athleteId)
    .run();
}

export type ScoredSessionInput = {
  fingerprint: string;
  start_at: string;
  end_at: string;
  climb_count: number;
  top_grade: number;
  rpe: number;
  title: string;
  summary: string;
};

export async function upsertScoredSession(
  db: D1Database,
  userId: string,
  s: ScoredSessionInput
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sessions (user_id, fingerprint, start_at, end_at, climb_count, top_grade, rpe, title, summary, strava_activity_id, posted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
       ON CONFLICT(user_id, fingerprint) DO UPDATE SET
         start_at = excluded.start_at,
         end_at = excluded.end_at,
         climb_count = excluded.climb_count,
         top_grade = excluded.top_grade,
         rpe = excluded.rpe,
         title = excluded.title,
         summary = excluded.summary`
    )
    .bind(
      userId,
      s.fingerprint,
      s.start_at,
      s.end_at,
      s.climb_count,
      s.top_grade,
      s.rpe,
      s.title,
      s.summary
    )
    .run();
}

export async function markSessionPosted(
  db: D1Database,
  userId: string,
  fp: string,
  stravaActivityId: number
): Promise<void> {
  await db
    .prepare(
      `UPDATE sessions SET strava_activity_id = ?, posted_at = ? WHERE user_id = ? AND fingerprint = ?`
    )
    .bind(stravaActivityId, new Date().toISOString(), userId, fp)
    .run();
}

export async function postedSessionFingerprints(
  db: D1Database,
  userId: string
): Promise<Set<string>> {
  const rows = await db
    .prepare(
      `SELECT fingerprint FROM sessions WHERE user_id = ? AND strava_activity_id IS NOT NULL`
    )
    .bind(userId)
    .all<{ fingerprint: string }>();
  return new Set(rows.results.map((r) => r.fingerprint));
}

export async function listSessions(
  db: D1Database,
  userId: string,
  limit: number
): Promise<SessionRow[]> {
  const rows = await db
    .prepare(
      `SELECT fingerprint, start_at, end_at, climb_count, top_grade, rpe, title, strava_activity_id, posted_at
       FROM sessions WHERE user_id = ? ORDER BY start_at DESC LIMIT ?`
    )
    .bind(userId, limit)
    .all<SessionRow>();
  return rows.results;
}

export async function climbName(
  db: D1Database,
  board: string,
  climbUuid: string
): Promise<string | null> {
  const row = await db
    .prepare(`SELECT name FROM board_climb_names WHERE board = ? AND climb_uuid = ?`)
    .bind(board, climbUuid)
    .first<{ name: string }>();
  return row?.name ?? null;
}

export async function climbVGrade(
  db: D1Database,
  board: string,
  climbUuid: string,
  angle: number
): Promise<number | null> {
  const row = await db
    .prepare(
      `SELECT display_difficulty FROM board_climb_stats WHERE board = ? AND climb_uuid = ? AND angle = ?`
    )
    .bind(board, climbUuid, angle)
    .first<{ display_difficulty: number }>();
  if (row === null) return null;
  return vFromDisplay(row.display_difficulty) ?? null;
}

export async function putClimbData(
  db: D1Database,
  board: string,
  stats: ClimbStat[],
  climbs: ClimbRow[]
): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  const putStat = db.prepare(
    `INSERT OR REPLACE INTO board_climb_stats (board, climb_uuid, angle, display_difficulty) VALUES (?, ?, ?, ?)`
  );
  const putName = db.prepare(
    `INSERT OR REPLACE INTO board_climb_names (board, climb_uuid, name) VALUES (?, ?, ?)`
  );
  for (const s of stats)
    statements.push(putStat.bind(board, s.climb_uuid, s.angle, s.display_difficulty));
  for (const c of climbs) statements.push(putName.bind(board, c.uuid, c.name));
  const BATCH = 100;
  for (let i = 0; i < statements.length; i += BATCH) {
    await db.batch(statements.slice(i, i + BATCH));
  }
}

export async function getBoardCursor(
  db: D1Database,
  board: string,
  table: string
): Promise<string> {
  const row = await db
    .prepare(`SELECT value FROM board_cursors WHERE board = ? AND table_name = ?`)
    .bind(board, table)
    .first<{ value: string }>();
  return row?.value ?? "";
}

export async function setBoardCursor(
  db: D1Database,
  board: string,
  table: string,
  value: string
): Promise<void> {
  await db
    .prepare(`INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, ?, ?)`)
    .bind(board, table, value)
    .run();
}

export async function recordSyncResult(
  db: D1Database,
  userId: string,
  error: string | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sync_state (user_id, last_synced_at, last_error) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET last_synced_at = excluded.last_synced_at, last_error = excluded.last_error`
    )
    .bind(userId, new Date().toISOString(), error)
    .run();
}

export async function usersDueForSync(db: D1Database, olderThanMs: number): Promise<string[]> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const rows = await db
    .prepare(
      `SELECT bc.user_id AS user_id
       FROM board_connections bc
       LEFT JOIN sync_state ss ON ss.user_id = bc.user_id
       WHERE bc.status = 'active'
         AND (ss.last_synced_at IS NULL OR ss.last_synced_at < ?)`
    )
    .bind(cutoff)
    .all<{ user_id: string }>();
  return rows.results.map((r) => r.user_id);
}
