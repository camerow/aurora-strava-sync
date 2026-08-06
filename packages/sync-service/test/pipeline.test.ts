import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { encryptSecret } from "../src/lib/crypto";
import { syncOneUser } from "../src/pipeline";
import { jsonResponse, makeFakeFetch, type FakeRoute, type RecordedCall } from "./fakes";

const FAR_FUTURE = 4102444800;

async function seedUser(
  userId: string,
  boardUserId: number,
  athleteId: number,
  board = "tension"
): Promise<void> {
  await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', ?)`)
    .bind(userId, new Date().toISOString())
    .run();
  await env.DB.prepare(
    `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at)
     VALUES (?, ?, ?, ?, 'active', NULL, ?)`
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
      match: (url, _m, body) => url.endsWith("/sync") && body.includes("climb_stats="),
      respond: () =>
        jsonResponse(200, {
          climbs: [
            { uuid: "c1", name: "Jug Life" },
            { uuid: "c2", name: "Crimp Reaper" },
            { uuid: "c3", name: "Mind Meld" },
          ],
          climb_stats: [{ climb_uuid: "c3", angle: 40, display_difficulty: 24.2 }],
          shared_syncs: [
            { table_name: "climb_stats", last_synchronized_at: "2026-08-01 00:00:00.000000" },
            { table_name: "climbs", last_synchronized_at: "2026-08-01 00:00:00.000000" },
          ],
          _complete: true,
        }),
    },
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
      `SELECT fingerprint, climb_count, top_grade, rpe, title, summary, strava_activity_id FROM sessions WHERE user_id = ?`
    )
      .bind(userId)
      .all<{
        fingerprint: string;
        climb_count: number;
        top_grade: number;
        rpe: number;
        title: string;
        summary: string;
        strava_activity_id: number;
      }>();
    expect(rows.results).toHaveLength(1);
    const session = rows.results[0]!;
    expect(session.climb_count).toBe(3);
    expect(session.top_grade).toBe(8);
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

  it("pauses a large cache fill and resumes on the next run", async () => {
    await seedUser(userId, 47, 11, "kilter");
    let sharedCalls = 0;
    const routes: FakeRoute[] = [
      auroraRoutes()[0]!,
      {
        match: (url, _m, body) => url.endsWith("/sync") && body.includes("climb_stats="),
        respond: () => {
          sharedCalls++;
          return jsonResponse(200, {
            climbs: [
              { uuid: "c1", name: "Jug Life" },
              { uuid: "c2", name: "Crimp Reaper" },
              { uuid: "c3", name: "Mind Meld" },
            ],
            climb_stats: [{ climb_uuid: "c3", angle: 40, display_difficulty: 24.2 }],
            shared_syncs: [
              {
                table_name: "climb_stats",
                last_synchronized_at: `2026-08-0${sharedCalls} 00:00:00.000000`,
              },
              {
                table_name: "climbs",
                last_synchronized_at: `2026-08-0${sharedCalls} 00:00:00.000000`,
              },
            ],
            _complete: sharedCalls > 12,
          });
        },
      },
      stravaCreateRoute(201, 4004),
      stravaPatchRoute,
    ];
    const { fetchImpl } = makeFakeFetch(routes);

    const first = await syncOneUser(env, userId, fetchImpl);
    expect(first).toEqual({ status: "cache_filling", posted: 0 });

    const second = await syncOneUser(env, userId, fetchImpl);
    expect(second).toEqual({ status: "synced", posted: 1 });
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

  it("respects sync_since as the posting cutoff", async () => {
    await seedUser(userId, 45, 10);
    await env.DB.prepare(`UPDATE board_connections SET sync_since = ? WHERE user_id = ?`)
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
});
