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

export type ClimbGrade = { scale: "v"; value: number } | { scale: "font"; value: string };

export type SessionClimb = {
  time: string;
  name: string;
  vGrade: number;
  kind: "send" | "attempt";
  tries: number;
  angle: number | null;
  grade?: ClimbGrade;
};

export type SessionSource = "board" | "manual";

export type SessionLocation = "indoor" | "outdoor";

export type SessionRow = {
  fingerprint: string;
  board: string | null;
  source: SessionSource;
  location: SessionLocation | null;
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
  inProgress: boolean;
};

export type LogClimbInput = {
  name?: string;
  grade: ClimbGrade;
  kind?: "send" | "attempt";
  tries?: number;
};

export type LogSessionInput = {
  name?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  rpe?: number;
  location: SessionLocation;
  climbs: LogClimbInput[];
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
