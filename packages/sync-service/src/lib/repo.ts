import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { sessions, stravaConnections, users } from "../db/schema";

export type UserRow = typeof users.$inferSelect;

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
