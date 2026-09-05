import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { encryptSecret } from "../src/lib/crypto";
import { syncOneUser } from "../src/pipeline";
import { jsonResponse, makeFakeFetch, type FakeRoute, type RecordedCall } from "./fakes";

const FAR_FUTURE = 4102444800;
const DEFERRAL_TEST_BOARD = "grasshopper";

type SeedUserOptions = {
  catalogueComplete?: boolean;
};

async function seedUser(
  userId: string,
  boardUserId: number,
  athleteId: number,
  board = "tension",
  { catalogueComplete = true }: SeedUserOptions = {}
): Promise<void> {
  await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', ?)`)
    .bind(userId, new Date().toISOString())
    .run();
  await env.DB.prepare(
    `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at, posting_enabled, post_since)
     VALUES (?, ?, ?, ?, 'active', NULL, ?, 1, NULL)`
  )
    .bind(
      userId,
      board,
      boardUserId,
      await encryptSecret("board-token", env.TOKEN_KEY),
      new Date().toISOString()
    )
    .run();
  await env.DB.prepare(
    `INSERT INTO strava_connections (user_id, athlete_id, access_token_ciphertext, refresh_token_ciphertext, expires_at, status, connected_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?)`
  )
    .bind(
      userId,
      athleteId,
      await encryptSecret("access-token", env.TOKEN_KEY),
      await encryptSecret("refresh-token", env.TOKEN_KEY),
      FAR_FUTURE,
      new Date().toISOString()
    )
    .run();
  if (catalogueComplete) {
    await markCatalogueComplete(board);
  }
}

async function markCatalogueComplete(board: string): Promise<void> {
  await env.DB.prepare(
    `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, 'cache_complete', '1')`
  )
    .bind(board)
    .run();
}

function auroraRoutes(): FakeRoute[] {
  return [
    {
      match: (url, _m, body) => url.endsWith("/sync") && body.includes("ascents="),
      respond: () =>
        jsonResponse(200, {
          ascents: [
            {
              uuid: "a1",
              climb_uuid: "c1",
              angle: 40,
              user_id: 42,
              bid_count: 1,
              difficulty: 18,
              climbed_at: "2026-07-01 18:00:00.000000",
            },
            {
              uuid: "a2",
              climb_uuid: "c2",
              angle: 40,
              user_id: 42,
              bid_count: 2,
              difficulty: 22,
              climbed_at: "2026-07-01 18:10:00.000000",
            },
          ],
          bids: [
            {
              uuid: "b1",
              climb_uuid: "c3",
              angle: 40,
              user_id: 42,
              bid_count: 3,
              climbed_at: "2026-07-01 18:20:00.000000",
            },
          ],
          user_syncs: [],
          _complete: true,
        }),
    },
    {
      match: (url, _m, body) => url.endsWith("/sync") && !body.includes("ascents="),
      respond: () =>
        jsonResponse(200, {
          climbs: [
            { uuid: "c1", name: "Jug Life" },
            { uuid: "c2", name: "Crimp Reaper" },
            { uuid: "c3", name: "Mind Meld" },
          ],
          climb_stats: [{ climb_uuid: "c3", angle: 40, difficulty_average: 24.2 }],
          shared_syncs: [
            { table_name: "climb_stats", last_synchronized_at: "2026-08-01 00:00:00.000000" },
            { table_name: "climbs", last_synchronized_at: "2026-08-01 00:00:00.000000" },
          ],
          _complete: true,
        }),
    },
  ];
}

function auroraTime(d: Date): string {
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}.000000`;
}

function auroraRoutesAt(minutesAgo: number): FakeRoute[] {
  const climbedAt = auroraTime(new Date(Date.now() - minutesAgo * 60_000));
  const [ascentsRoute, sharedRoute] = auroraRoutes() as [FakeRoute, FakeRoute];
  return [
    {
      match: ascentsRoute.match,
      respond: () =>
        jsonResponse(200, {
          ascents: [
            {
              uuid: "a1",
              climb_uuid: "c1",
              angle: 40,
              user_id: 42,
              bid_count: 1,
              difficulty: 18,
              climbed_at: climbedAt,
            },
          ],
          bids: [],
          user_syncs: [],
          _complete: true,
        }),
    },
    sharedRoute,
  ];
}

function auroraRoutesAtTwo(
  oldMinutesAgo: number,
  recentMinutesAgo: number,
  recentDifficulty = 30
): FakeRoute[] {
  const oldAt = auroraTime(new Date(Date.now() - oldMinutesAgo * 60_000));
  const recentAt = auroraTime(new Date(Date.now() - recentMinutesAgo * 60_000));
  const [ascentsRoute, sharedRoute] = auroraRoutes() as [FakeRoute, FakeRoute];
  return [
    {
      match: ascentsRoute.match,
      respond: () =>
        jsonResponse(200, {
          ascents: [
            {
              uuid: "a1",
              climb_uuid: "c1",
              angle: 40,
              user_id: 42,
              bid_count: 1,
              difficulty: 18,
              climbed_at: oldAt,
            },
            {
              uuid: "a2",
              climb_uuid: "c2",
              angle: 40,
              user_id: 42,
              bid_count: 1,
              difficulty: recentDifficulty,
              climbed_at: recentAt,
            },
          ],
          bids: [],
          user_syncs: [],
          _complete: true,
        }),
    },
    sharedRoute,
  ];
}

function stravaCreateRoute(status: number, id: number): FakeRoute {
  return {
    match: (url, method) => url.endsWith("/api/v3/activities") && method === "POST",
    respond: () => (status === 429 ? jsonResponse(429, {}) : jsonResponse(201, { id })),
  };
}

const stravaPatchRoute: FakeRoute = {
  match: (url, method) => /\/api\/v3\/activities\/\d+$/.test(url) && method === "PUT",
  respond: () => jsonResponse(200, {}),
};

function stravaCreateCalls(calls: RecordedCall[]): RecordedCall[] {
  return calls.filter((c) => c.url.endsWith("/api/v3/activities") && c.method === "POST");
}

let userCounter = 0;

describe("syncOneUser", () => {
  let userId: string;

  beforeEach(async () => {
    userId = `user_${++userCounter}_${Date.now()}`;
  });

  it("syncs, scores, posts, and is idempotent on re-run", async () => {
    await seedUser(userId, 42, 7);
    const { fetchImpl, calls } = makeFakeFetch([
      ...auroraRoutes(),
      stravaCreateRoute(201, 1001),
      stravaPatchRoute,
    ]);

    const first = await syncOneUser(env, userId, fetchImpl);
    expect(first).toEqual({ status: "synced", posted: 1 });

    const rows = await env.DB.prepare(
      `SELECT fingerprint, climb_count, top_grade, top_send_grade, rpe, title, summary, strava_activity_id FROM sessions WHERE user_id = ?`
    )
      .bind(userId)
      .all<{
        fingerprint: string;
        climb_count: number;
        top_grade: number;
        top_send_grade: number;
        rpe: number;
        title: string;
        summary: string;
        strava_activity_id: number;
      }>();
    expect(rows.results).toHaveLength(1);
    const session = rows.results[0]!;
    expect(session.climb_count).toBe(3);
    expect(session.top_grade).toBe(8);
    expect(session.top_send_grade).toBe(6);
    expect(session.strava_activity_id).toBe(1001);
    expect(session.title).toContain("top V8");
    expect(session.summary).toContain("✓ V4 Jug Life");
    expect(session.summary).toContain("✓ V6 Crimp Reaper");
    expect(session.summary).toContain("✗ V8 Mind Meld (3 tries)");
    expect(session.summary).toContain("synced by sendtally");

    const firstCreates = stravaCreateCalls(calls).length;
    expect(firstCreates).toBe(1);

    const second = await syncOneUser(env, userId, fetchImpl);
    expect(second).toEqual({ status: "synced", posted: 0 });
    expect(stravaCreateCalls(calls)).toHaveLength(firstCreates);
  });

  it("pauses cleanly on Strava rate limit and resumes next run", async () => {
    await seedUser(userId, 43, 8);
    const limited = makeFakeFetch([...auroraRoutes(), stravaCreateRoute(429, 0)]);
    const first = await syncOneUser(env, userId, limited.fetchImpl);
    expect(first).toEqual({ status: "rate_limited", posted: 0 });

    const unposted = await env.DB.prepare(
      `SELECT strava_activity_id FROM sessions WHERE user_id = ?`
    )
      .bind(userId)
      .all<{ strava_activity_id: number | null }>();
    expect(unposted.results).toHaveLength(1);
    expect(unposted.results[0]!.strava_activity_id).toBeNull();

    const ok = makeFakeFetch([...auroraRoutes(), stravaCreateRoute(201, 2002), stravaPatchRoute]);
    const second = await syncOneUser(env, userId, ok.fetchImpl);
    expect(second).toEqual({ status: "synced", posted: 1 });
  });

  it("marks the board connection dead when the token is rejected", async () => {
    await seedUser(userId, 44, 9);
    const { fetchImpl } = makeFakeFetch([
      {
        match: (url) => url.endsWith("/sync"),
        respond: () => jsonResponse(401, {}),
      },
    ]);
    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome).toEqual({ status: "board_dead", posted: 0 });

    const conn = await env.DB.prepare(`SELECT status FROM board_connections WHERE user_id = ?`)
      .bind(userId)
      .first<{ status: string }>();
    expect(conn?.status).toBe("dead");
  });

  it("computes and stores sessions without a Strava connection", async () => {
    await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', ?)`)
      .bind(userId, new Date().toISOString())
      .run();
    await env.DB.prepare(
      `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at)
       VALUES (?, 'tension', 46, ?, 'active', NULL, ?)`
    )
      .bind(userId, await encryptSecret("board-token", env.TOKEN_KEY), new Date().toISOString())
      .run();
    await markCatalogueComplete("tension");
    const { fetchImpl, calls } = makeFakeFetch(auroraRoutes());

    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome).toEqual({ status: "no_strava", posted: 0 });

    const rows = await env.DB.prepare(
      `SELECT rpe, strava_activity_id FROM sessions WHERE user_id = ?`
    )
      .bind(userId)
      .all<{ rpe: number; strava_activity_id: number | null }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]!.rpe).toBeGreaterThan(0);
    expect(rows.results[0]!.strava_activity_id).toBeNull();
    expect(calls.every((c) => !c.url.includes("strava"))).toBe(true);
  });

  it("does not post when posting is not enabled", async () => {
    await seedUser(userId, 45, 10);
    await env.DB.prepare(`UPDATE board_connections SET posting_enabled = 0 WHERE user_id = ?`)
      .bind(userId)
      .run();
    const { fetchImpl, calls } = makeFakeFetch([
      ...auroraRoutes(),
      stravaCreateRoute(201, 3003),
      stravaPatchRoute,
    ]);
    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome).toEqual({ status: "no_strava", posted: 0 });
    expect(stravaCreateCalls(calls)).toHaveLength(0);

    const rows = await env.DB.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?`)
      .bind(userId)
      .first<{ n: number }>();
    expect(rows?.n).toBe(1);
  });

  it("syncs every connected board and stamps sessions with their board", async () => {
    await seedUser(userId, 42, 7);
    await env.DB.prepare(
      `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at, posting_enabled, post_since)
       VALUES (?, 'kilter', 52, ?, 'active', NULL, ?, 1, NULL)`
    )
      .bind(userId, await encryptSecret("board-token-2", env.TOKEN_KEY), new Date().toISOString())
      .run();
    await markCatalogueComplete("kilter");
    const { fetchImpl, calls } = makeFakeFetch([
      ...auroraRoutes(),
      stravaCreateRoute(201, 5005),
      stravaPatchRoute,
    ]);

    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome).toEqual({ status: "synced", posted: 2 });
    expect(stravaCreateCalls(calls)).toHaveLength(2);

    const rows = await env.DB.prepare(
      `SELECT board, fingerprint FROM sessions WHERE user_id = ? ORDER BY board`
    )
      .bind(userId)
      .all<{ board: string; fingerprint: string }>();
    expect(rows.results.map((r) => r.board)).toEqual(["kilter", "tension"]);
    expect(rows.results[0]!.fingerprint).not.toBe(rows.results[1]!.fingerprint);
  });

  it("syncs only the requested board when one is specified", async () => {
    await seedUser(userId, 42, 7);
    await env.DB.prepare(
      `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at, posting_enabled, post_since)
       VALUES (?, 'kilter', 52, ?, 'active', NULL, ?, 1, NULL)`
    )
      .bind(userId, await encryptSecret("board-token-2", env.TOKEN_KEY), new Date().toISOString())
      .run();
    await markCatalogueComplete("kilter");
    const { fetchImpl } = makeFakeFetch([
      ...auroraRoutes(),
      stravaCreateRoute(201, 6006),
      stravaPatchRoute,
    ]);

    const outcome = await syncOneUser(env, userId, fetchImpl, "kilter");
    expect(outcome).toEqual({ status: "synced", posted: 1 });

    const rows = await env.DB.prepare(`SELECT board FROM sessions WHERE user_id = ?`)
      .bind(userId)
      .all<{ board: string }>();
    expect(rows.results).toEqual([{ board: "kilter" }]);
  });

  it("respects post_since as the posting cutoff", async () => {
    await seedUser(userId, 48, 12);
    await env.DB.prepare(`UPDATE board_connections SET post_since = ? WHERE user_id = ?`)
      .bind("2026-07-15 00:00:00.000000", userId)
      .run();
    const { fetchImpl, calls } = makeFakeFetch([
      ...auroraRoutes(),
      stravaCreateRoute(201, 3003),
      stravaPatchRoute,
    ]);
    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome).toEqual({ status: "synced", posted: 0 });
    expect(stravaCreateCalls(calls)).toHaveLength(0);
  });

  it("persists a session still inside the in-progress window without posting it", async () => {
    await seedUser(userId, 51, 21);
    const { fetchImpl, calls } = makeFakeFetch([
      ...auroraRoutesAt(10),
      stravaCreateRoute(201, 3001),
      stravaPatchRoute,
    ]);

    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome).toEqual({ status: "synced", posted: 0 });

    const rows = await env.DB.prepare(
      `SELECT climb_count, strava_activity_id FROM sessions WHERE user_id = ?`
    )
      .bind(userId)
      .all<{ climb_count: number; strava_activity_id: number | null }>();
    expect(rows.results).toHaveLength(1);
    expect(rows.results[0]!.climb_count).toBe(1);
    expect(rows.results[0]!.strava_activity_id).toBeNull();
    expect(stravaCreateCalls(calls)).toHaveLength(0);
  });

  it("posts a session once it falls outside the in-progress window", async () => {
    await seedUser(userId, 52, 22);
    const { fetchImpl, calls } = makeFakeFetch([
      ...auroraRoutesAt(180),
      stravaCreateRoute(201, 3002),
      stravaPatchRoute,
    ]);

    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome).toEqual({ status: "synced", posted: 1 });
    expect(stravaCreateCalls(calls)).toHaveLength(1);

    const row = await env.DB.prepare(`SELECT strava_activity_id FROM sessions WHERE user_id = ?`)
      .bind(userId)
      .first<{ strava_activity_id: number | null }>();
    expect(row?.strava_activity_id).toBe(3002);
  });

  it("keeps a completed session's score unaffected by an in-progress session in the same sync", async () => {
    const baselineUserId = userId;
    await seedUser(baselineUserId, 60, 30);
    const baseline = makeFakeFetch([
      ...auroraRoutesAt(300),
      stravaCreateRoute(201, 9001),
      stravaPatchRoute,
    ]);
    const baselineOutcome = await syncOneUser(env, baselineUserId, baseline.fetchImpl);
    expect(baselineOutcome).toEqual({ status: "synced", posted: 1 });

    const baselineRow = await env.DB.prepare(`SELECT rpe, title FROM sessions WHERE user_id = ?`)
      .bind(baselineUserId)
      .first<{ rpe: number; title: string }>();
    expect(baselineRow).not.toBeNull();

    const mixedUserId = `${userId}_mixed`;
    await seedUser(mixedUserId, 61, 31);
    const mixed = makeFakeFetch([
      ...auroraRoutesAtTwo(300, 10),
      stravaCreateRoute(201, 9002),
      stravaPatchRoute,
    ]);
    const mixedOutcome = await syncOneUser(env, mixedUserId, mixed.fetchImpl);
    expect(mixedOutcome).toEqual({ status: "synced", posted: 1 });

    const mixedRows = await env.DB.prepare(
      `SELECT rpe, title FROM sessions WHERE user_id = ? ORDER BY start_at ASC`
    )
      .bind(mixedUserId)
      .all<{ rpe: number; title: string }>();
    expect(mixedRows.results).toHaveLength(2);
    expect(mixedRows.results[0]).toEqual(baselineRow);
  });

  it("refreshes the catalogue once when a sync references an unknown climb", async () => {
    await seedUser(userId, 71, 41, "aurora");
    let sharedCalls = 0;
    const { fetchImpl } = makeFakeFetch([
      auroraRoutes()[0]!,
      {
        match: (url, _m, body) => url.endsWith("/sync") && !body.includes("ascents="),
        respond: () => {
          sharedCalls++;
          return jsonResponse(200, {
            climbs: [
              { uuid: "c1", name: "Jug Life" },
              { uuid: "c2", name: "Crimp Reaper" },
              { uuid: "c3", name: "Mind Meld" },
            ],
            climb_stats: [{ climb_uuid: "c3", angle: 40, difficulty_average: 24.2 }],
            shared_syncs: [
              { table_name: "climb_stats", last_synchronized_at: "2026-08-02 00:00:00.000000" },
              { table_name: "climbs", last_synchronized_at: "2026-08-02 00:00:00.000000" },
            ],
            _complete: true,
          });
        },
      },
      stravaCreateRoute(201, 7001),
      stravaPatchRoute,
    ]);

    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome.status).toBe("synced");
    expect(sharedCalls).toBe(1);

    const row = await env.DB.prepare(`SELECT summary FROM sessions WHERE user_id = ?`)
      .bind(userId)
      .first<{ summary: string }>();
    expect(row?.summary).toContain("Jug Life");
  });

  it("refreshes the catalogue when a bid's grade is missing even though its name is cached", async () => {
    await seedUser(userId, 72, 42, "kilter");
    await env.DB.prepare(
      `INSERT INTO board_climb_names (board, climb_uuid, name) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`
    )
      .bind("kilter", "c1", "Jug Life", "kilter", "c2", "Crimp Reaper", "kilter", "c3", "Mind Meld")
      .run();

    let sharedCalls = 0;
    const { fetchImpl } = makeFakeFetch([
      auroraRoutes()[0]!,
      {
        match: (url, _m, body) => url.endsWith("/sync") && !body.includes("ascents="),
        respond: () => {
          sharedCalls++;
          return jsonResponse(200, {
            climbs: [
              { uuid: "c1", name: "Jug Life" },
              { uuid: "c2", name: "Crimp Reaper" },
              { uuid: "c3", name: "Mind Meld" },
            ],
            climb_stats: [{ climb_uuid: "c3", angle: 40, difficulty_average: 24.2 }],
            shared_syncs: [
              { table_name: "climb_stats", last_synchronized_at: "2026-08-03 00:00:00.000000" },
              { table_name: "climbs", last_synchronized_at: "2026-08-03 00:00:00.000000" },
            ],
            _complete: true,
          });
        },
      },
      stravaCreateRoute(201, 7002),
      stravaPatchRoute,
    ]);

    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome.status).toBe("synced");
    expect(sharedCalls).toBe(1);

    const row = await env.DB.prepare(`SELECT summary FROM sessions WHERE user_id = ?`)
      .bind(userId)
      .first<{ summary: string }>();
    expect(row?.summary).toContain("✗ V8 Mind Meld");
  });

  it("does not re-trigger a refresh for an unresolvable climb on the next sync within the debounce window", async () => {
    await seedUser(userId, 73, 43, "soill");
    let sharedCalls = 0;
    const { fetchImpl } = makeFakeFetch([
      auroraRoutes()[0]!,
      {
        match: (url, _m, body) => url.endsWith("/sync") && !body.includes("ascents="),
        respond: () => {
          sharedCalls++;
          return jsonResponse(200, {
            climbs: [
              { uuid: "c1", name: "Jug Life" },
              { uuid: "c2", name: "Crimp Reaper" },
            ],
            climb_stats: [],
            shared_syncs: [
              { table_name: "climb_stats", last_synchronized_at: "2026-08-04 00:00:00.000000" },
              { table_name: "climbs", last_synchronized_at: "2026-08-04 00:00:00.000000" },
            ],
            _complete: true,
          });
        },
      },
      stravaCreateRoute(201, 7003),
      stravaPatchRoute,
    ]);

    const first = await syncOneUser(env, userId, fetchImpl);
    expect(first.status).toBe("synced");
    expect(sharedCalls).toBe(1);

    const second = await syncOneUser(env, userId, fetchImpl);
    expect(second.status).toBe("synced");
    expect(sharedCalls).toBe(1);
  });

  it("defers and persists nothing when the board catalogue has never completed", async () => {
    await seedUser(userId, 61, 31, DEFERRAL_TEST_BOARD, { catalogueComplete: false });
    const { fetchImpl, calls } = makeFakeFetch([...auroraRoutes(), stravaCreateRoute(201, 4001)]);

    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome).toEqual({
      status: "catalogue_pending",
      posted: 0,
      pendingBoards: [DEFERRAL_TEST_BOARD],
    });

    const rows = await env.DB.prepare(`SELECT fingerprint FROM sessions WHERE user_id = ?`)
      .bind(userId)
      .all();
    expect(rows.results).toHaveLength(0);
    expect(calls).toHaveLength(0);

    const syncState = await env.DB.prepare(
      `SELECT last_synced_at, last_error FROM sync_state WHERE user_id = ?`
    )
      .bind(userId)
      .first<{ last_synced_at: string | null; last_error: string | null }>();
    expect(syncState?.last_synced_at).not.toBeNull();
    expect(syncState?.last_error).toBe("waiting for board catalogue");
  });

  it("does not write the miss-refresh timestamp when the refresh is incomplete", async () => {
    await seedUser(userId, 74, 44, "touchstone");
    let sharedCalls = 0;
    const { fetchImpl } = makeFakeFetch([
      auroraRoutes()[0]!,
      {
        match: (url, _m, body) => url.endsWith("/sync") && !body.includes("ascents="),
        respond: () => {
          sharedCalls++;
          return jsonResponse(200, {
            climbs: [
              { uuid: "c1", name: "Jug Life" },
              { uuid: "c2", name: "Crimp Reaper" },
            ],
            climb_stats: [],
            shared_syncs: [
              { table_name: "climb_stats", last_synchronized_at: "2026-08-05 00:00:00.000000" },
              { table_name: "climbs", last_synchronized_at: "2026-08-05 00:00:00.000000" },
            ],
            _complete: false,
          });
        },
      },
      stravaCreateRoute(201, 7004),
      stravaPatchRoute,
    ]);

    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome.status).toBe("synced");
    expect(sharedCalls).toBe(4);

    const cursor = await env.DB.prepare(
      `SELECT value FROM board_cursors WHERE board = ? AND table_name = 'last_miss_refresh_at'`
    )
      .bind("touchstone")
      .first<{ value: string }>();
    expect(cursor).toBeNull();
  });

  it("treats a corrupt miss-refresh timestamp as due rather than blocking forever", async () => {
    await seedUser(userId, 76, 46, "soill");
    await env.DB.prepare(
      `INSERT OR REPLACE INTO board_cursors (board, table_name, value) VALUES (?, 'last_miss_refresh_at', 'not-a-date')`
    )
      .bind("soill")
      .run();

    let sharedCalls = 0;
    const { fetchImpl } = makeFakeFetch([
      auroraRoutes()[0]!,
      {
        match: (url, _m, body) => url.endsWith("/sync") && !body.includes("ascents="),
        respond: () => {
          sharedCalls++;
          return jsonResponse(200, {
            climbs: [
              { uuid: "c1", name: "Jug Life" },
              { uuid: "c2", name: "Crimp Reaper" },
              { uuid: "c3", name: "Mind Meld" },
            ],
            climb_stats: [{ climb_uuid: "c3", angle: 40, difficulty_average: 24.2 }],
            shared_syncs: [
              { table_name: "climb_stats", last_synchronized_at: "2026-08-07 00:00:00.000000" },
              { table_name: "climbs", last_synchronized_at: "2026-08-07 00:00:00.000000" },
            ],
            _complete: true,
          });
        },
      },
      stravaCreateRoute(201, 7006),
      stravaPatchRoute,
    ]);

    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome.status).toBe("synced");
    expect(sharedCalls).toBe(1);
  });

  it("does not write the miss-refresh timestamp when a complete refresh resolves the miss", async () => {
    await seedUser(userId, 75, 45, "decoy");
    let sharedCalls = 0;
    const { fetchImpl } = makeFakeFetch([
      auroraRoutes()[0]!,
      {
        match: (url, _m, body) => url.endsWith("/sync") && !body.includes("ascents="),
        respond: () => {
          sharedCalls++;
          return jsonResponse(200, {
            climbs: [
              { uuid: "c1", name: "Jug Life" },
              { uuid: "c2", name: "Crimp Reaper" },
              { uuid: "c3", name: "Mind Meld" },
            ],
            climb_stats: [{ climb_uuid: "c3", angle: 40, difficulty_average: 24.2 }],
            shared_syncs: [
              { table_name: "climb_stats", last_synchronized_at: "2026-08-06 00:00:00.000000" },
              { table_name: "climbs", last_synchronized_at: "2026-08-06 00:00:00.000000" },
            ],
            _complete: true,
          });
        },
      },
      stravaCreateRoute(201, 7005),
      stravaPatchRoute,
    ]);

    const outcome = await syncOneUser(env, userId, fetchImpl);
    expect(outcome.status).toBe("synced");
    expect(sharedCalls).toBe(1);

    const cursor = await env.DB.prepare(
      `SELECT value FROM board_cursors WHERE board = ? AND table_name = 'last_miss_refresh_at'`
    )
      .bind("decoy")
      .first<{ value: string }>();
    expect(cursor).toBeNull();
  });
});
