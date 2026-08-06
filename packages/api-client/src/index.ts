import {
  ApiError,
  type ConnectBoardInput,
  type ConnectBoardResult,
  type ConnectionStatus,
  type SessionRow,
  type StravaPostingMode,
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

  connectBoard(input: ConnectBoardInput): Promise<ConnectBoardResult> {
    return this.request<ConnectBoardResult>("/v1/connect/board", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  stravaAuthorizeUrl(): Promise<{ url: string }> {
    return this.request<{ url: string }>("/v1/connect/strava/start");
  }

  setStravaPosting(mode: StravaPostingMode): Promise<{ mode: StravaPostingMode }> {
    return this.request<{ mode: StravaPostingMode }>("/v1/strava/posting", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
  }

  syncNow(): Promise<{ queued: boolean }> {
    return this.request<{ queued: boolean }>("/v1/sync-now", { method: "POST" });
  }
}
