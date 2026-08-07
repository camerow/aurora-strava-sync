export type BoardStatus = {
  board: string;
  status: string;
  postingEnabled: boolean;
  postSince: string | null;
};

export type ConnectionStatus = {
  boards: BoardStatus[];
  strava: {
    athleteId: number;
    status: string;
  } | null;
  sync: { lastSyncedAt: string | null; lastError: string | null } | null;
  autoSync: boolean;
};

export type StravaPostingMode = "off" | "new" | "all";

export type SyncScheduleMode = "off" | "daily";

export type SessionClimb = {
  time: string;
  name: string;
  vGrade: number;
  kind: "send" | "attempt";
  tries: number;
  angle: number | null;
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

export type SessionDetail = SessionRow & { climbs: SessionClimb[] };

export type SessionWithClimbs = SessionRow & { climbs: SessionClimb[] };

export type ConnectBoardInput = {
  board: string;
  username: string;
  password: string;
  timezone?: string;
};

export type ConnectBoardResult = { board: string; boardUserId: number };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}
