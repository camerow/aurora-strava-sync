import type { BoardStatus, ConnectionStatus, SessionRow } from "@sendtally/api-client";

export type SessionBadge = "in_progress" | "on_strava" | "will_post" | "not_posted";

export const SESSION_BADGE_LABELS: Record<SessionBadge, string> = {
  in_progress: "IN PROGRESS",
  on_strava: "ON STRAVA",
  will_post: "WILL POST",
  not_posted: "NOT POSTED",
};

export function sessionBadge(session: SessionRow, status: ConnectionStatus | null): SessionBadge {
  if (session.inProgress) return "in_progress";
  if (session.strava_activity_id !== null) return "on_strava";
  if (status === null || status.strava === null || status.strava.status !== "active") {
    return "not_posted";
  }
  const board: BoardStatus | undefined = status.boards.find((b) => b.board === session.board);
  if (board === undefined || !board.postingEnabled) return "not_posted";
  if (board.postSince !== null) {
    const cutoff = new Date(`${board.postSince.slice(0, 10)}T00:00:00Z`);
    if (new Date(session.start_at) < cutoff) return "not_posted";
  }
  return "will_post";
}
