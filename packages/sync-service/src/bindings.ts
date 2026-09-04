export type SyncJob =
  { kind: "user"; userId: string; board?: string } | { kind: "catalogue"; board: string };

export type Env = {
  DB: D1Database;
  SYNC_QUEUE: Queue<SyncJob>;
  TOKEN_KEY: string;
  CLERK_SECRET_KEY: string;
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  STRAVA_WEBHOOK_VERIFY_TOKEN: string;
  WEB_APP_URL: string;
  POSTHOG_PROJECT_TOKEN?: string;
  POSTHOG_HOST?: string;
};
