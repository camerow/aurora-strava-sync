import {
  ApiError,
  type ConnectionStatus,
  type LogSessionInput,
  type SessionRow,
  type SessionDetail,
  type SessionWithClimbs,
} from "./types";

export * from "./types";

export type TokenProvider = () => Promise<string | null>;

export class SendtallyApi {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: TokenProvider
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getToken();
    if (token === null) throw new ApiError(401, "not signed in");
    const resp = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    if (!resp.ok) {
      const body = (await resp.json().catch(() => null)) as { error?: string } | null;
      throw new ApiError(resp.status, body?.error ?? `request failed: HTTP ${resp.status}`);
    }
    return (await resp.json()) as T;
  }

  status(): Promise<ConnectionStatus> {
    return this.request<ConnectionStatus>("/v1/status");
  }

  sessions(): Promise<{ sessions: SessionRow[] }> {
    return this.request<{ sessions: SessionRow[] }>("/v1/sessions");
  }

  sessionsWithClimbs(): Promise<{ sessions: SessionWithClimbs[] }> {
    return this.request<{ sessions: SessionWithClimbs[] }>("/v1/sessions?include=climbs");
  }

  session(fingerprint: string): Promise<{ session: SessionDetail }> {
    return this.request<{ session: SessionDetail }>(
      `/v1/sessions/${encodeURIComponent(fingerprint)}`
    );
  }

  logSession(input: LogSessionInput): Promise<{ session: SessionDetail }> {
    return this.request<{ session: SessionDetail }>("/v1/sessions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateLoggedSession(
    fingerprint: string,
    input: LogSessionInput
  ): Promise<{ session: SessionDetail }> {
    return this.request<{ session: SessionDetail }>(
      `/v1/sessions/${encodeURIComponent(fingerprint)}`,
      { method: "PUT", body: JSON.stringify(input) }
    );
  }

  deleteLoggedSession(fingerprint: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/v1/sessions/${encodeURIComponent(fingerprint)}`, {
      method: "DELETE",
    });
  }

  stravaAuthorizeUrl(): Promise<{ url: string }> {
    return this.request<{ url: string }>("/v1/connect/strava/start");
  }
}
