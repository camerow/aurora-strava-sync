const HOST_BASES: Record<string, string> = {
  aurora: "auroraboardapp",
  decoy: "decoyboardapp",
  grasshopper: "grasshopperboardapp",
  kilter: "kilterboardapp",
  soill: "soillboardapp",
  tension: "tensionboardapp2",
  touchstone: "touchstoneboardapp",
};

export const BOARDS = Object.keys(HOST_BASES);

export function baseUrlFor(board: string): string | undefined {
  const hostBase = HOST_BASES[board];
  return hostBase === undefined ? undefined : `https://${hostBase}.com`;
}

const EPOCH_SYNC_DATE = "1970-01-01 00:00:00.000000";
const MAX_SYNC_PAGES = 100;
const USER_AGENT = "Kilter%20Board/202 CFNetwork/1568.100.1 Darwin/24.0.0";

export type Ascent = {
  uuid: string;
  climb_uuid: string;
  angle: number;
  user_id: number;
  bid_count: number;
  difficulty: number;
  climbed_at: string;
};

export type Bid = {
  uuid: string;
  climb_uuid: string;
  angle: number;
  user_id: number;
  bid_count: number;
  climbed_at: string;
};

export type ClimbRow = { uuid: string; name: string };

export type ClimbStat = { climb_uuid: string; angle: number; display_difficulty: number };

export type BoardSession = { token: string; userId: number };

type SyncMark = { table_name: string; last_synchronized_at: string };

type SyncPage = {
  ascents?: Ascent[];
  bids?: Bid[];
  climb_stats?: ClimbStat[];
  climbs?: ClimbRow[];
  user_syncs?: SyncMark[];
  shared_syncs?: SyncMark[];
  _complete?: boolean;
};

export class InvalidBoardCredentialsError extends Error {}

export class BoardTokenRejectedError extends Error {}

export class AuroraClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async login(username: string, password: string): Promise<BoardSession> {
    const resp = await this.fetchImpl(`${this.baseUrl}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        username,
        password,
        tou: "accepted",
        pp: "accepted",
        ua: "app",
      }),
    });
    if (resp.status === 422) throw new InvalidBoardCredentialsError("invalid board credentials");
    if (resp.status !== 200 && resp.status !== 201) {
      throw new Error(`board login failed: HTTP ${resp.status}`);
    }
    const out = (await resp.json()) as { session: { token: string; user_id: number } };
    return { token: out.session.token, userId: out.session.user_id };
  }

  private async syncTables(
    token: string,
    cursors: Record<string, string>,
    onPage: (p: SyncPage) => void
  ): Promise<void> {
    for (let page = 0; page < MAX_SYNC_PAGES; page++) {
      const body = Object.entries(cursors)
        .map(([table, date]) => `${encodeURIComponent(table)}=${encodeURIComponent(date)}`)
        .join("&");
      const resp = await this.fetchImpl(`${this.baseUrl}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
          ...(token !== "" ? { Cookie: `token=${token}` } : {}),
        },
        body,
      });
      if (resp.status === 401 || resp.status === 403) {
        throw new BoardTokenRejectedError(`board sync rejected: HTTP ${resp.status}`);
      }
      if (resp.status !== 200) throw new Error(`board sync failed: HTTP ${resp.status}`);
      const p = (await resp.json()) as SyncPage;
      onPage(p);
      for (const m of [...(p.user_syncs ?? []), ...(p.shared_syncs ?? [])]) {
        if (m.table_name in cursors && m.last_synchronized_at !== "") {
          cursors[m.table_name] = m.last_synchronized_at;
        }
      }
      if (p._complete === true) return;
    }
    throw new Error(`board sync did not complete within ${MAX_SYNC_PAGES} pages`);
  }

  async syncUser(token: string): Promise<{ ascents: Ascent[]; bids: Bid[] }> {
    const ascents: Ascent[] = [];
    const bids: Bid[] = [];
    await this.syncTables(token, { ascents: EPOCH_SYNC_DATE, bids: EPOCH_SYNC_DATE }, (p) => {
      ascents.push(...(p.ascents ?? []));
      bids.push(...(p.bids ?? []));
    });
    return { ascents, bids };
  }

  async syncShared(
    token: string,
    statsSince: string,
    climbsSince: string
  ): Promise<{
    stats: ClimbStat[];
    climbs: ClimbRow[];
    statsCursor: string;
    climbsCursor: string;
  }> {
    const cursors: Record<string, string> = {
      climb_stats: statsSince === "" ? EPOCH_SYNC_DATE : statsSince,
      climbs: climbsSince === "" ? EPOCH_SYNC_DATE : climbsSince,
    };
    const stats: ClimbStat[] = [];
    const climbs: ClimbRow[] = [];
    await this.syncTables(token, cursors, (p) => {
      stats.push(...(p.climb_stats ?? []));
      climbs.push(...(p.climbs ?? []));
    });
    return {
      stats,
      climbs,
      statsCursor: cursors["climb_stats"]!,
      climbsCursor: cursors["climbs"]!,
    };
  }
}
