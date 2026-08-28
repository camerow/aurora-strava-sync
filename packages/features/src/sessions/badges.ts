import type { SessionRow } from "@sendtally/api-client";

export type SessionBadge = "in_progress" | "on_strava";

export const SESSION_BADGE_LABELS: Record<SessionBadge, string> = {
  in_progress: "IN PROGRESS",
  on_strava: "ON STRAVA",
};

export function sessionBadge(session: SessionRow): SessionBadge | null {
  if (session.inProgress) return "in_progress";
  if (session.strava_activity_id !== null) return "on_strava";
  return null;
}
