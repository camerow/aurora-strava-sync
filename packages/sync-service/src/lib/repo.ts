import type { ClimbRow, ClimbStat } from "./aurora";
import { vFromDisplay } from "@sendtally/core";

export type UserRow = { id: string; timezone: string; auto_sync: number };

export type BoardConnectionRow = {
  user_id: string;
  board: string;
  board_user_id: number;
  token_ciphertext: string;
  status: string;
  sync_since: string | null;
  posting_enabled: number;
  post_since: string | null;
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
  board: string | null;
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
  return db
    .prepare(`SELECT id, timezone, auto_sync FROM users WHERE id = ?`)
    .bind(id)
    .first<UserRow>();
}

export async function setAutoSync(db: D1Database, id: string, enabled: boolean): Promise<void> {
  await db
    .prepare(`UPDATE users SET auto_sync = ? WHERE id = ?`)
    .bind(enabled ? 1 : 0, id)
    .run();
}

export async function upsertBoardConnection(
  db: D1Database,
  row: Omit<BoardConnectionRow, "status" | "posting_enabled" | "post_since">
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)
       ON CONFLICT(user_id, board) DO UPDATE SET
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

const BOARD_CONNECTION_COLS = `user_id, board, board_user_id, token_ciphertext, status, sync_since, posting_enabled, post_since`;

export async function listBoardConnections(
  db: D1Database,
  userId: string
): Promise<BoardConnectionRow[]> {
  const rows = await db
    .prepare(
      `SELECT ${BOARD_CONNECTION_COLS} FROM board_connections WHERE user_id = ? ORDER BY connected_at`
    )
    .bind(userId)
    .all<BoardConnectionRow>();
  return rows.results;
}

export async function getBoardConnection(
  db: D1Database,
  userId: string,
  board: string
): Promise<BoardConnectionRow | null> {
  return db
    .prepare(
      `SELECT ${BOARD_CONNECTION_COLS} FROM board_connections WHERE user_id = ? AND board = ?`
    )
    .bind(userId, board)
    .first<BoardConnectionRow>();
}

export async function markBoardConnectionDead(
  db: D1Database,
  userId: string,
  board: string
): Promise<void> {
  await db
    .prepare(`UPDATE board_connections SET status = 'dead' WHERE user_id = ? AND board = ?`)
    .bind(userId, board)
    .run();
}

export async function setBoardPosting(
  db: D1Database,
  userId: string,
  board: string,
  enabled: boolean,
  postSince: string | null
): Promise<void> {
  await db
    .prepare(
      `UPDATE board_connections SET posting_enabled = ?, post_since = ? WHERE user_id = ? AND board = ?`
    )
    .bind(enabled ? 1 : 0, postSince, userId, board)
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
  board: string;
  start_at: string;
  end_at: string;
  climb_count: number;
  top_grade: number;
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
  await db
    .prepare(
      `INSERT INTO sessions (user_id, fingerprint, board, start_at, end_at, climb_count, top_grade, rpe, title, summary, climbs_json, strava_activity_id, posted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
       ON CONFLICT(user_id, fingerprint) DO UPDATE SET
         board = excluded.board,
         start_at = excluded.start_at,
         end_at = excluded.end_at,
         climb_count = excluded.climb_count,
         top_grade = excluded.top_grade,
         rpe = excluded.rpe,
         title = excluded.title,
         summary = excluded.summary,
         climbs_json = excluded.climbs_json`
    )
    .bind(
      userId,
      s.fingerprint,
      s.board,
      s.start_at,
      s.end_at,
      s.climb_count,
      s.top_grade,
      s.rpe,
      s.title,
      s.summary,
      s.climbs_json
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
  limit: number,
  includeClimbs = false
): Promise<Array<SessionRow & { climbs_json?: string | null }>> {
  const cols = includeClimbs
    ? "fingerprint, board, start_at, end_at, climb_count, top_grade, rpe, title, strava_activity_id, posted_at, climbs_json"
    : "fingerprint, board, start_at, end_at, climb_count, top_grade, rpe, title, strava_activity_id, posted_at";
  const rows = await db
    .prepare(`SELECT ${cols} FROM sessions WHERE user_id = ? ORDER BY start_at DESC LIMIT ?`)
    .bind(userId, limit)
    .all<SessionRow & { climbs_json?: string | null }>();
  return rows.results;
}

export async function getSession(
  db: D1Database,
  userId: string,
  fingerprint: string
): Promise<(SessionRow & { climbs_json: string | null }) | null> {
  return db
    .prepare(
      `SELECT fingerprint, board, start_at, end_at, climb_count, top_grade, rpe, title, strava_activity_id, posted_at, climbs_json
       FROM sessions WHERE user_id = ? AND fingerprint = ?`
    )
    .bind(userId, fingerprint)
    .first<SessionRow & { climbs_json: string | null }>();
}

export async function climbNamesFor(
  db: D1Database,
  board: string,
  climbUuids: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(climbUuids)];
  for (let i = 0; i < unique.length; i += 90) {
    const chunk = unique.slice(i, i + 90);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT climb_uuid, name FROM board_climb_names WHERE board = ? AND climb_uuid IN (${placeholders})`
      )
      .bind(board, ...chunk)
      .all<{ climb_uuid: string; name: string }>();
    for (const r of rows.results) out.set(r.climb_uuid, r.name);
  }
  return out;
}

export async function climbVGradesFor(
  db: D1Database,
  board: string,
  climbUuids: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(climbUuids)];
  for (let i = 0; i < unique.length; i += 90) {
    const chunk = unique.slice(i, i + 90);
    const placeholders = chunk.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT climb_uuid, angle, display_difficulty FROM board_climb_stats WHERE board = ? AND climb_uuid IN (${placeholders})`
      )
      .bind(board, ...chunk)
      .all<{ climb_uuid: string; angle: number; display_difficulty: number }>();
    for (const r of rows.results) {
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
  const statements: D1PreparedStatement[] = [];
  const putStat = db.prepare(
    `INSERT OR REPLACE INTO board_climb_stats (board, climb_uuid, angle, display_difficulty) VALUES (?, ?, ?, ?)`
  );
  const putName = db.prepare(
    `INSERT OR REPLACE INTO board_climb_names (board, climb_uuid, name) VALUES (?, ?, ?)`
  );
  for (const s of stats) {
    const difficulty = s.display_difficulty ?? s.difficulty_average;
    if (s.climb_uuid == null || s.angle == null || difficulty == null) continue;
    statements.push(putStat.bind(board, s.climb_uuid, s.angle, difficulty));
  }
  for (const c of climbs) {
    if (c.uuid == null) continue;
    statements.push(putName.bind(board, c.uuid, c.name ?? ""));
  }
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

export type SyncStateRow = { last_synced_at: string | null; last_error: string | null };

export async function getSyncState(db: D1Database, userId: string): Promise<SyncStateRow | null> {
  return db
    .prepare(`SELECT last_synced_at, last_error FROM sync_state WHERE user_id = ?`)
    .bind(userId)
    .first<SyncStateRow>();
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
      `SELECT DISTINCT bc.user_id AS user_id
       FROM board_connections bc
       JOIN users u ON u.id = bc.user_id
       LEFT JOIN sync_state ss ON ss.user_id = bc.user_id
       WHERE bc.status = 'active'
         AND u.auto_sync = 1
         AND (ss.last_synced_at IS NULL OR ss.last_synced_at < ?)`
    )
    .bind(cutoff)
    .all<{ user_id: string }>();
  return rows.results.map((r) => r.user_id);
}
