export type ConnectionStatus = {
  board: { board: string; status: string } | null;
  strava: { athleteId: number; status: string } | null;
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

export type ConnectBoardInput = {
  board: string;
  username: string;
  password: string;
  timezone?: string;
  backfill?: boolean;
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
