import { toWallClockString } from "./time";

const boundFetch: typeof fetch = (input, init) => fetch(input, init);

export const STRAVA_API_BASE = "https://www.strava.com/api/v3";
export const STRAVA_OAUTH_BASE = "https://www.strava.com/oauth";

export class StravaRateLimitedError extends Error {}

export class StravaUnauthorizedError extends Error {}

export type StravaTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type StravaActivity = {
  name: string;
  description: string;
  startDateLocal: Date;
  elapsedSeconds: number;
  perceivedExertion: number;
};

export type StravaAppConfig = {
  clientId: string;
  clientSecret: string;
};

export function authorizeUrl(cfg: StravaAppConfig, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "activity:write,activity:read_all",
    state,
  });
  return `${STRAVA_OAUTH_BASE}/authorize?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
};

async function exchange(
  cfg: StravaAppConfig,
  oauthBase: string,
  grant: Record<string, string>,
  fetchImpl: typeof fetch
): Promise<TokenResponse> {
  const resp = await fetchImpl(`${oauthBase}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      ...grant,
    }),
  });
  if (resp.status === 401 || resp.status === 400) {
    throw new StravaUnauthorizedError(`strava token exchange rejected: HTTP ${resp.status}`);
  }
  if (resp.status !== 200) throw new Error(`strava token exchange failed: HTTP ${resp.status}`);
  return (await resp.json()) as TokenResponse;
}

export async function exchangeAuthCode(
  cfg: StravaAppConfig,
  code: string,
  fetchImpl: typeof fetch = boundFetch,
  oauthBase: string = STRAVA_OAUTH_BASE
): Promise<{ tokens: StravaTokens; athleteId: number }> {
  const out = await exchange(cfg, oauthBase, { code, grant_type: "authorization_code" }, fetchImpl);
  return {
    tokens: {
      accessToken: out.access_token,
      refreshToken: out.refresh_token,
      expiresAt: out.expires_at,
    },
    athleteId: out.athlete?.id ?? 0,
  };
}

export class StravaClient {
  private tokens: StravaTokens;
  private refreshed = false;

  constructor(
    private readonly cfg: StravaAppConfig,
    tokens: StravaTokens,
    private readonly fetchImpl: typeof fetch = boundFetch,
    private readonly apiBase: string = STRAVA_API_BASE,
    private readonly oauthBase: string = STRAVA_OAUTH_BASE
  ) {
    this.tokens = tokens;
  }

  currentTokens(): StravaTokens {
    return this.tokens;
  }

  wasRefreshed(): boolean {
    return this.refreshed;
  }

  private async ensureFresh(): Promise<void> {
    if (Date.now() / 1000 < this.tokens.expiresAt - 300) return;
    const out = await exchange(
      this.cfg,
      this.oauthBase,
      { refresh_token: this.tokens.refreshToken, grant_type: "refresh_token" },
      this.fetchImpl
    );
    this.tokens = {
      accessToken: out.access_token,
      refreshToken: out.refresh_token,
      expiresAt: out.expires_at,
    };
    this.refreshed = true;
  }

  async createActivity(a: StravaActivity): Promise<number> {
    await this.ensureFresh();
    const form = new URLSearchParams({
      name: a.name,
      sport_type: "RockClimbing",
      start_date_local: toWallClockString(a.startDateLocal),
      elapsed_time: String(a.elapsedSeconds),
      description: a.description,
      trainer: "0",
    });
    if (a.perceivedExertion > 0) form.set("perceived_exertion", String(a.perceivedExertion));
    const resp = await this.fetchImpl(`${this.apiBase}/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${this.tokens.accessToken}`,
      },
      body: form,
    });
    if (resp.status === 429) throw new StravaRateLimitedError("strava rate limit hit");
    if (resp.status === 401) throw new StravaUnauthorizedError("strava token rejected");
    if (resp.status !== 201 && resp.status !== 200) {
      throw new Error(`create activity failed: HTTP ${resp.status}`);
    }
    const out = (await resp.json()) as { id: number };
    return out.id;
  }

  async deauthorize(): Promise<void> {
    await this.ensureFresh();
    const resp = await this.fetchImpl(`${this.oauthBase}/deauthorize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.tokens.accessToken}` },
    });
    if (resp.status === 429) throw new StravaRateLimitedError("strava rate limit hit");
    if (resp.status === 401) throw new StravaUnauthorizedError("strava token rejected");
    if (resp.status !== 200) throw new Error(`strava deauthorize failed: HTTP ${resp.status}`);
  }

  async setPerceivedExertion(activityId: number, rpe: number): Promise<void> {
    await this.ensureFresh();
    const resp = await this.fetchImpl(`${this.apiBase}/activities/${activityId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${this.tokens.accessToken}`,
      },
      body: new URLSearchParams({
        perceived_exertion: String(rpe),
        prefer_perceived_exertion: "true",
      }),
    });
    if (resp.status === 429) throw new StravaRateLimitedError("strava rate limit hit");
    if (resp.status !== 200) {
      throw new Error(`set perceived exertion failed: HTTP ${resp.status}`);
    }
  }
}
