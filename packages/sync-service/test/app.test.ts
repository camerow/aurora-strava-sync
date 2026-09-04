import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Env } from "../src/bindings";
import { decryptSecret, encryptSecret } from "../src/lib/crypto";
import { wallClockNow } from "../src/lib/time";
import { jsonResponse, makeFakeFetch } from "./fakes";

function testApp(fetchImpl?: typeof fetch, deleteAuthUser?: (userId: string) => Promise<void>) {
  return createApp({
    verifyUser: async (req) => {
      const userId = req.headers.get("x-test-user");
      if (userId === null) return null;
      const features = (req.headers.get("x-test-features") ?? "").split(",");
      return { userId, hasFeature: (feature) => features.includes(feature) };
    },
    deleteAuthUser: deleteAuthUser ?? (async () => {}),
    ...(fetchImpl === undefined ? {} : { fetchImpl }),
  });
}

describe("app", () => {
  it("serves health without auth", async () => {
    const res = await testApp().request("/health", {}, env);
    expect(res.status).toBe(200);
  });

  it("rejects /v1 routes without a verified user", async () => {
    const res = await testApp().request("/v1/sessions", {}, env);
    expect(res.status).toBe(401);
  });

  it("connects a board with pass-through login and stores only the token", async () => {
    const { fetchImpl, calls } = makeFakeFetch([
      {
        match: (url, method) => url.endsWith("/sessions") && method === "POST",
        respond: () => jsonResponse(201, { session: { token: "tok-abc", user_id: 42 } }),
      },
    ]);
    const queued: unknown[] = [];
    const fakeEnv = {
      ...env,
      SYNC_QUEUE: { send: async (msg: unknown) => void queued.push(msg) },
    } as unknown as Env;
    const res = await testApp(fetchImpl).request(
      "/v1/connect/board",
      {
        method: "POST",
        headers: { "x-test-user": "user_connect", "Content-Type": "application/json" },
        body: JSON.stringify({
          board: "tension",
          username: "will",
          password: "hunter2",
          timezone: "America/New_York",
        }),
      },
      fakeEnv
    );
    expect(res.status).toBe(200);
    expect(queued).toHaveLength(2);
    expect(queued).toContainEqual({ kind: "catalogue", board: "tension" });
    expect(queued).toContainEqual({ kind: "user", userId: "user_connect", board: "tension" });
    expect(await res.json()).toEqual({ board: "tension", boardUserId: 42 });

    const loginCall = calls.find((c) => c.url.endsWith("/sessions"));
    expect(loginCall?.url).toBe("https://tensionboardapp2.com/sessions");

    const conn = await env.DB.prepare(
      `SELECT board, board_user_id, token_ciphertext, sync_since FROM board_connections WHERE user_id = ?`
    )
      .bind("user_connect")
      .first<{
        board: string;
        board_user_id: number;
        token_ciphertext: string;
        sync_since: string;
      }>();
    expect(conn?.board).toBe("tension");
    expect(conn?.board_user_id).toBe(42);
    expect(conn?.token_ciphertext).not.toContain("tok-abc");
    expect(await decryptSecret(conn!.token_ciphertext, env.TOKEN_KEY)).toBe("tok-abc");
    expect(conn?.sync_since).toBeNull();

    const user = await env.DB.prepare(`SELECT timezone FROM users WHERE id = ?`)
      .bind("user_connect")
      .first<{ timezone: string }>();
    expect(user?.timezone).toBe("America/New_York");
  });

  it("rejects bad board credentials with 422", async () => {
    const { fetchImpl } = makeFakeFetch([
      {
        match: (url) => url.endsWith("/sessions"),
        respond: () => jsonResponse(422, {}),
      },
    ]);
    const res = await testApp(fetchImpl).request(
      "/v1/connect/board",
      {
        method: "POST",
        headers: { "x-test-user": "user_badcreds", "Content-Type": "application/json" },
        body: JSON.stringify({ board: "kilter", username: "will", password: "wrong" }),
      },
      env
    );
    expect(res.status).toBe(422);
  });

  it("answers the Strava webhook verification challenge", async () => {
    const res = await testApp().request(
      "/webhooks/strava?hub.verify_token=test-verify-token&hub.challenge=ch-123",
      {},
      env
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ "hub.challenge": "ch-123" });

    const bad = await testApp().request("/webhooks/strava?hub.verify_token=nope", {}, env);
    expect(bad.status).toBe(403);
  });

  it("marks the Strava connection dead on a deauthorization event", async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, timezone, created_at) VALUES ('user_deauth', 'UTC', '')`
    ).run();
    await env.DB.prepare(
      `INSERT INTO strava_connections (user_id, athlete_id, access_token_ciphertext, refresh_token_ciphertext, expires_at, status, connected_at)
       VALUES ('user_deauth', 555, 'x', 'y', 0, 'active', '')`
    ).run();

    const res = await testApp().request(
      "/webhooks/strava",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object_type: "athlete",
          object_id: 555,
          aspect_type: "update",
          updates: { authorized: "false" },
        }),
      },
      env
    );
    expect(res.status).toBe(200);

    const conn = await env.DB.prepare(
      `SELECT status FROM strava_connections WHERE athlete_id = 555`
    ).first<{ status: string }>();
    expect(conn?.status).toBe("dead");
  });

  it("completes the OAuth callback for a user with no users row yet", async () => {
    const state = await encryptSecret(
      JSON.stringify({ userId: "user_fresh", nonce: "n", exp: Date.now() + 60_000 }),
      env.TOKEN_KEY
    );
    const { fetchImpl } = makeFakeFetch([
      {
        match: (url) => url.includes("/oauth/token"),
        respond: () =>
          jsonResponse(200, {
            access_token: "at",
            refresh_token: "rt",
            expires_at: 4102444800,
            athlete: { id: 1234 },
          }),
      },
    ]);
    const res = await testApp(fetchImpl).request(
      `/connect/strava/callback?code=x&state=${encodeURIComponent(state)}`,
      {},
      env
    );
    expect(res.status).toBe(302);
    const conn = await env.DB.prepare(
      `SELECT athlete_id FROM strava_connections WHERE user_id = 'user_fresh'`
    ).first<{ athlete_id: number }>();
    expect(conn?.athlete_id).toBe(1234);
  });

  it("binds the OAuth callback to the browser nonce when the cookie is present", async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, timezone, created_at) VALUES ('user_oauth', 'UTC', '')`
    ).run();
    const state = await encryptSecret(
      JSON.stringify({ userId: "user_oauth", nonce: "good-nonce", exp: Date.now() + 60_000 }),
      env.TOKEN_KEY
    );
    const { fetchImpl } = makeFakeFetch([
      {
        match: (url) => url.includes("/oauth/token"),
        respond: () =>
          jsonResponse(200, {
            access_token: "at",
            refresh_token: "rt",
            expires_at: 4102444800,
            athlete: { id: 999 },
          }),
      },
    ]);
    const path = `/connect/strava/callback?code=x&state=${encodeURIComponent(state)}`;

    const mismatched = await testApp(fetchImpl).request(
      path,
      { headers: { Cookie: "st_oauth=evil-nonce" } },
      env
    );
    expect(mismatched.status).toBe(400);

    const matched = await testApp(fetchImpl).request(
      path,
      { headers: { Cookie: "st_oauth=good-nonce" } },
      env
    );
    expect(matched.status).toBe(302);

    const noCookie = await testApp(fetchImpl).request(path, {}, env);
    expect(noCookie.status).toBe(302);

    const conn = await env.DB.prepare(
      `SELECT athlete_id FROM strava_connections WHERE user_id = 'user_oauth'`
    ).first<{ athlete_id: number }>();
    expect(conn?.athlete_id).toBe(999);
  });

  it("skips malformed climb rows instead of failing the cache fill", async () => {
    const { putClimbData } = await import("../src/lib/repo");
    await putClimbData(
      env.DB,
      "probe",
      [
        { climb_uuid: "ok", angle: 40, display_difficulty: 20 },
        { climb_uuid: "bad", angle: 40 } as never,
      ],
      [{ uuid: "ok" }, { uuid: undefined } as never] as never
    );
    const stats = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM board_climb_stats WHERE board = 'probe'`
    ).first<{ n: number }>();
    const names = await env.DB.prepare(
      `SELECT name FROM board_climb_names WHERE board = 'probe'`
    ).all<{ name: string }>();
    expect(stats?.n).toBe(1);
    expect(names.results).toEqual([{ name: "" }]);
  });

  it("enqueues a sync job on sync-now", async () => {
    const sent: unknown[] = [];
    const fakeEnv = {
      ...env,
      SYNC_QUEUE: { send: async (msg: unknown) => void sent.push(msg) },
    } as unknown as Env;
    const res = await testApp().request(
      "/v1/sync-now",
      { method: "POST", headers: { "x-test-user": "user_q" } },
      fakeEnv
    );
    expect(res.status).toBe(200);
    expect(sent).toEqual([{ kind: "user", userId: "user_q" }]);
  });

  it("enqueues a board-scoped sync job when a board is given", async () => {
    const sent: unknown[] = [];
    const fakeEnv = {
      ...env,
      SYNC_QUEUE: { send: async (msg: unknown) => void sent.push(msg) },
    } as unknown as Env;
    const res = await testApp().request(
      "/v1/sync-now",
      {
        method: "POST",
        headers: { "x-test-user": "user_qb", "Content-Type": "application/json" },
        body: JSON.stringify({ board: "kilter" }),
      },
      fakeEnv
    );
    expect(res.status).toBe(200);
    expect(sent).toEqual([{ kind: "user", userId: "user_qb", board: "kilter" }]);
  });

  it("keeps existing connections when a second board is connected", async () => {
    const { fetchImpl } = makeFakeFetch([
      {
        match: (url, method) => url.endsWith("/sessions") && method === "POST",
        respond: () => jsonResponse(201, { session: { token: "tok-2", user_id: 77 } }),
      },
    ]);
    const fakeEnv = {
      ...env,
      SYNC_QUEUE: { send: async () => undefined },
    } as unknown as Env;
    for (const board of ["tension", "kilter"]) {
      const res = await testApp(fetchImpl).request(
        "/v1/connect/board",
        {
          method: "POST",
          headers: { "x-test-user": "user_two_boards", "Content-Type": "application/json" },
          body: JSON.stringify({ board, username: "will", password: "hunter2" }),
        },
        fakeEnv
      );
      expect(res.status).toBe(200);
    }
    const rows = await env.DB.prepare(
      `SELECT board FROM board_connections WHERE user_id = 'user_two_boards' ORDER BY board`
    ).all<{ board: string }>();
    expect(rows.results).toEqual([{ board: "kilter" }, { board: "tension" }]);
  });

  it("sets Strava posting per board", async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, timezone, created_at) VALUES ('user_posting', 'UTC', '')`
    ).run();
    await env.DB.prepare(
      `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at)
       VALUES ('user_posting', 'tension', 1, 'x', 'active', NULL, ''),
              ('user_posting', 'kilter', 2, 'x', 'active', NULL, '')`
    ).run();
    await env.DB.prepare(
      `INSERT INTO strava_connections (user_id, athlete_id, access_token_ciphertext, refresh_token_ciphertext, expires_at, status, connected_at)
       VALUES ('user_posting', 321, 'x', 'y', 0, 'active', '')`
    ).run();
    const fakeEnv = {
      ...env,
      SYNC_QUEUE: { send: async () => undefined },
    } as unknown as Env;

    const res = await testApp().request(
      "/v1/strava/posting",
      {
        method: "POST",
        headers: {
          "x-test-user": "user_posting",
          "x-test-features": "strava-sync",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ board: "kilter", mode: "all" }),
      },
      fakeEnv
    );
    expect(res.status).toBe(200);

    const rows = await env.DB.prepare(
      `SELECT board, posting_enabled FROM board_connections WHERE user_id = 'user_posting' ORDER BY board`
    ).all<{ board: string; posting_enabled: number }>();
    expect(rows.results).toEqual([
      { board: "kilter", posting_enabled: 1 },
      { board: "tension", posting_enabled: 0 },
    ]);
  });

  it("stores the daily sync schedule choice", async () => {
    const daily = await testApp().request(
      "/v1/sync-schedule",
      {
        method: "POST",
        headers: { "x-test-user": "user_sched", "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "daily" }),
      },
      env
    );
    expect(daily.status).toBe(200);
    let user = await env.DB.prepare(`SELECT auto_sync FROM users WHERE id = 'user_sched'`).first<{
      auto_sync: number;
    }>();
    expect(user?.auto_sync).toBe(1);

    const off = await testApp().request(
      "/v1/sync-schedule",
      {
        method: "POST",
        headers: { "x-test-user": "user_sched", "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "off" }),
      },
      env
    );
    expect(off.status).toBe(200);
    user = await env.DB.prepare(`SELECT auto_sync FROM users WHERE id = 'user_sched'`).first<{
      auto_sync: number;
    }>();
    expect(user?.auto_sync).toBe(0);
  });

  it("marks recent sessions in progress and settled ones not", async () => {
    const userId = "user_in_progress";
    await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', ?)`)
      .bind(userId, new Date().toISOString())
      .run();

    const recentEnd = new Date(Date.now() - 5 * 60_000).toISOString();
    const oldEnd = new Date(Date.now() - 5 * 60 * 60_000).toISOString();
    const insert = `INSERT INTO sessions (user_id, fingerprint, board, start_at, end_at, climb_count, top_grade, rpe, title, summary, climbs_json)
       VALUES (?, ?, 'tension', ?, ?, 1, 4, 5, 'T', 'S', '[]')`;
    await env.DB.prepare(insert)
      .bind(userId, "fp_recent", new Date(Date.now() - 65 * 60_000).toISOString(), recentEnd)
      .run();
    await env.DB.prepare(insert)
      .bind(userId, "fp_old", new Date(Date.now() - 6 * 60 * 60_000).toISOString(), oldEnd)
      .run();

    const res = await testApp().request(
      "/v1/sessions",
      { headers: { "x-test-user": userId } },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessions: Array<{ fingerprint: string; inProgress: boolean }>;
    };
    const byFingerprint = new Map(body.sessions.map((s) => [s.fingerprint, s.inProgress]));
    expect(byFingerprint.get("fp_recent")).toBe(true);
    expect(byFingerprint.get("fp_old")).toBe(false);

    const detail = await testApp().request(
      "/v1/sessions/fp_recent",
      { headers: { "x-test-user": userId } },
      env
    );
    const detailBody = (await detail.json()) as { session: { inProgress: boolean } };
    expect(detailBody.session.inProgress).toBe(true);
  });

  it("uses the user's wall clock timezone, not raw UTC now, to decide in progress", async () => {
    const userId = "user_in_progress_tz";
    const timezone = "America/Los_Angeles";
    await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, ?, ?)`)
      .bind(userId, timezone, new Date().toISOString())
      .run();

    const userWallClockNow = wallClockNow(timezone);
    const recentEnd = new Date(userWallClockNow.getTime() - 5 * 60_000).toISOString();
    const insert = `INSERT INTO sessions (user_id, fingerprint, board, start_at, end_at, climb_count, top_grade, rpe, title, summary, climbs_json)
       VALUES (?, ?, 'tension', ?, ?, 1, 4, 5, 'T', 'S', '[]')`;
    await env.DB.prepare(insert)
      .bind(
        userId,
        "fp_tz_recent",
        new Date(userWallClockNow.getTime() - 65 * 60_000).toISOString(),
        recentEnd
      )
      .run();

    const res = await testApp().request(
      "/v1/sessions",
      { headers: { "x-test-user": userId } },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessions: Array<{ fingerprint: string; inProgress: boolean }>;
    };
    const byFingerprint = new Map(body.sessions.map((s) => [s.fingerprint, s.inProgress]));
    expect(byFingerprint.get("fp_tz_recent")).toBe(true);

    const detail = await testApp().request(
      "/v1/sessions/fp_tz_recent",
      { headers: { "x-test-user": userId } },
      env
    );
    const detailBody = (await detail.json()) as { session: { inProgress: boolean } };
    expect(detailBody.session.inProgress).toBe(true);
  });

  const logBody = (overrides: Record<string, unknown> = {}) => ({
    name: "Gym bouldering",
    date: "2026-08-20",
    startTime: "18:00",
    endTime: "20:00",
    location: "indoor",
    climbs: [
      { name: "Cave problem", grade: { scale: "v", value: 4 }, kind: "send", tries: 2 },
      { grade: { scale: "font", value: "6C+" } },
      { grade: { scale: "v", value: 6 }, kind: "attempt" },
    ],
    ...overrides,
  });

  const postSession = (userId: string, body: unknown) =>
    testApp().request(
      "/v1/sessions",
      {
        method: "POST",
        headers: { "x-test-user": userId, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      env
    );

  type ManualSessionResponse = {
    session: {
      fingerprint: string;
      board: string | null;
      source: string;
      location: string | null;
      name: string | null;
      start_at: string;
      end_at: string;
      climb_count: number;
      top_grade: number;
      rpe: number;
      title: string;
      inProgress: boolean;
      climbs: Array<{
        time: string;
        name: string;
        vGrade: number;
        kind: string;
        tries: number;
        grade: { scale: string; value: string | number };
      }>;
    };
  };

  it("logs a manual session with converted grades and a scored effort", async () => {
    const res = await postSession("user_manual", logBody());
    expect(res.status).toBe(201);
    const { session } = (await res.json()) as ManualSessionResponse;

    expect(session.fingerprint).toMatch(/^manual-/);
    expect(session.source).toBe("manual");
    expect(session.board).toBeNull();
    expect(session.location).toBe("indoor");
    expect(session.name).toBe("Gym bouldering");
    expect(session.title).toBe("Gym bouldering");
    expect(session.start_at).toBe("2026-08-20T18:00:00.000Z");
    expect(session.end_at).toBe("2026-08-20T20:00:00.000Z");
    expect(session.climb_count).toBe(3);
    expect(session.top_grade).toBe(6);
    expect(session.rpe).toBeGreaterThanOrEqual(1);
    expect(session.rpe).toBeLessThanOrEqual(10);
    expect(session.inProgress).toBe(false);

    expect(session.climbs).toHaveLength(3);
    expect(session.climbs[0]).toMatchObject({
      name: "Cave problem",
      vGrade: 4,
      kind: "send",
      tries: 2,
      grade: { scale: "v", value: 4 },
    });
    expect(session.climbs[1]).toMatchObject({
      vGrade: 5,
      kind: "send",
      tries: 1,
      grade: { scale: "font", value: "6C+" },
    });
    expect(session.climbs[2]).toMatchObject({ vGrade: 6, kind: "attempt" });

    const row = await env.DB.prepare(
      `SELECT source, board, location, name, summary FROM sessions WHERE user_id = 'user_manual'`
    ).first<{
      source: string;
      board: string | null;
      location: string;
      name: string;
      summary: string;
    }>();
    expect(row?.source).toBe("manual");
    expect(row?.board).toBeNull();
    expect(row?.location).toBe("indoor");
    expect(row?.summary).toContain("synced by sendtally");
  });

  it("never marks a manual session in progress, even with a recent end time", async () => {
    const userId = "user_manual_recent";
    const start = new Date(Date.now() - 30 * 60_000);
    const end = new Date(start.getTime() + 25 * 60_000);
    const res = await postSession(
      userId,
      logBody({
        date: start.toISOString().slice(0, 10),
        startTime: start.toISOString().slice(11, 16),
        endTime: end.toISOString().slice(11, 16),
      })
    );
    expect(res.status).toBe(201);
    const { session } = (await res.json()) as ManualSessionResponse;
    expect(session.inProgress).toBe(false);

    const list = await testApp().request(
      "/v1/sessions",
      { headers: { "x-test-user": userId } },
      env
    );
    const body = (await list.json()) as {
      sessions: Array<{ fingerprint: string; source: string; inProgress: boolean }>;
    };
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]?.source).toBe("manual");
    expect(body.sessions[0]?.inProgress).toBe(false);
  });

  it("rejects invalid manual session bodies", async () => {
    const bad = [
      logBody({ climbs: [] }),
      logBody({ climbs: [{ grade: { scale: "font", value: "6D" } }] }),
      logBody({ climbs: [{ grade: { scale: "v", value: 99 } }] }),
      logBody({ date: "2026-02-31" }),
      logBody({ date: "20-08-2026" }),
      logBody({ location: "moon" }),
      logBody({ rpe: 11 }),
      logBody({ rpe: 6.5 }),
      logBody({ startTime: "18:00", endTime: "07:00" }),
    ];
    for (const body of bad) {
      const res = await postSession("user_manual_bad", body);
      expect(res.status).toBe(400);
    }
  });

  it("uses a manual RPE override for the score and summary", async () => {
    const res = await postSession("user_manual_rpe", logBody({ rpe: 9, name: undefined }));
    expect(res.status).toBe(201);
    const { session } = (await res.json()) as ManualSessionResponse;
    expect(session.rpe).toBe(9);
    expect(session.title).toContain("Hard climbing session");

    const row = await env.DB.prepare(
      `SELECT summary FROM sessions WHERE user_id = 'user_manual_rpe'`
    ).first<{ summary: string }>();
    expect(row?.summary).toContain("RPE 9/10");
  });

  it("wraps an end time past midnight into the next day", async () => {
    const res = await postSession(
      "user_manual_midnight",
      logBody({ startTime: "23:00", endTime: "01:00" })
    );
    expect(res.status).toBe(201);
    const { session } = (await res.json()) as ManualSessionResponse;
    expect(session.start_at).toBe("2026-08-20T23:00:00.000Z");
    expect(session.end_at).toBe("2026-08-21T01:00:00.000Z");
  });

  it("defaults to a 90-minute session when no end time is given", async () => {
    const res = await postSession("user_manual_defaults", logBody({ endTime: undefined }));
    expect(res.status).toBe(201);
    const { session } = (await res.json()) as ManualSessionResponse;
    expect(session.end_at).toBe("2026-08-20T19:30:00.000Z");
  });

  it("updates a manual session and re-scores it", async () => {
    const userId = "user_manual_edit";
    const created = await postSession(userId, logBody());
    const { session } = (await created.json()) as ManualSessionResponse;

    const updated = await testApp().request(
      `/v1/sessions/${session.fingerprint}`,
      {
        method: "PUT",
        headers: { "x-test-user": userId, "Content-Type": "application/json" },
        body: JSON.stringify(
          logBody({
            name: undefined,
            location: "outdoor",
            climbs: [{ grade: { scale: "font", value: "7A" }, kind: "send" }],
          })
        ),
      },
      env
    );
    expect(updated.status).toBe(200);
    const { session: after } = (await updated.json()) as ManualSessionResponse;
    expect(after.fingerprint).toBe(session.fingerprint);
    expect(after.location).toBe("outdoor");
    expect(after.name).toBeNull();
    expect(after.title).toContain("climbing session");
    expect(after.climb_count).toBe(1);
    expect(after.top_grade).toBe(6);
  });

  it("refuses to edit or delete board-synced sessions", async () => {
    const userId = "user_manual_guard";
    await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', '')`)
      .bind(userId)
      .run();
    await env.DB.prepare(
      `INSERT INTO sessions (user_id, fingerprint, board, start_at, end_at, climb_count, top_grade, rpe, title, summary, climbs_json)
       VALUES (?, 'fp_board', 'tension', '2026-08-01T18:00:00.000Z', '2026-08-01T19:00:00.000Z', 1, 4, 5, 'T', 'S', '[]')`
    )
      .bind(userId)
      .run();

    const put = await testApp().request(
      "/v1/sessions/fp_board",
      {
        method: "PUT",
        headers: { "x-test-user": userId, "Content-Type": "application/json" },
        body: JSON.stringify(logBody()),
      },
      env
    );
    expect(put.status).toBe(409);

    const del = await testApp().request(
      "/v1/sessions/fp_board",
      { method: "DELETE", headers: { "x-test-user": userId } },
      env
    );
    expect(del.status).toBe(409);

    const missing = await testApp().request(
      "/v1/sessions/manual-nope",
      { method: "DELETE", headers: { "x-test-user": userId } },
      env
    );
    expect(missing.status).toBe(404);
  });

  it("deletes a manual session", async () => {
    const userId = "user_manual_delete";
    const created = await postSession(userId, logBody());
    const { session } = (await created.json()) as ManualSessionResponse;

    const del = await testApp().request(
      `/v1/sessions/${session.fingerprint}`,
      { method: "DELETE", headers: { "x-test-user": userId } },
      env
    );
    expect(del.status).toBe(200);
    expect(await del.json()).toEqual({ deleted: true });

    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?`)
      .bind(userId)
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it("deletes the account: revokes Strava, clears D1 rows, removes the Clerk user", async () => {
    const userId = "user_delete_account";
    await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', '')`)
      .bind(userId)
      .run();
    await env.DB.prepare(
      `INSERT INTO board_connections (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at)
       VALUES (?, 'tension', 7, 'tok', 'active', NULL, '')`
    )
      .bind(userId)
      .run();
    await env.DB.prepare(
      `INSERT INTO strava_connections (user_id, athlete_id, access_token_ciphertext, refresh_token_ciphertext, expires_at, status, connected_at)
       VALUES (?, 999, ?, ?, ?, 'active', '')`
    )
      .bind(
        userId,
        await encryptSecret("access-tok", env.TOKEN_KEY),
        await encryptSecret("refresh-tok", env.TOKEN_KEY),
        Math.floor(Date.now() / 1000) + 3600
      )
      .run();
    await env.DB.prepare(
      `INSERT INTO sync_state (user_id, last_synced_at, last_error) VALUES (?, '', NULL)`
    )
      .bind(userId)
      .run();
    await env.DB.prepare(
      `INSERT INTO sessions (user_id, fingerprint, board, start_at, end_at, climb_count, top_grade, rpe, title, summary, climbs_json)
       VALUES (?, 'fp_x', 'tension', '2025-01-01T00:00:00Z', '2025-01-01T01:00:00Z', 3, 5, 6, 't', 's', '[]')`
    )
      .bind(userId)
      .run();

    const { fetchImpl, calls } = makeFakeFetch([
      {
        match: (url, method) => url.endsWith("/oauth/deauthorize") && method === "POST",
        respond: () => jsonResponse(200, { access_token: "access-tok" }),
      },
    ]);
    const deleted: string[] = [];

    const res = await testApp(fetchImpl, async (id) => void deleted.push(id)).request(
      "/v1/account",
      { method: "DELETE", headers: { "x-test-user": userId } },
      env
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(deleted).toEqual([userId]);

    const deauth = calls.find((c) => c.url.endsWith("/oauth/deauthorize"));
    expect(deauth?.headers["authorization"]).toBe("Bearer access-tok");

    for (const table of [
      "users",
      "board_connections",
      "strava_connections",
      "sync_state",
      "sessions",
    ]) {
      const column = table === "users" ? "id" : "user_id";
      const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`)
        .bind(userId)
        .first<{ n: number }>();
      expect(`${table}:${row?.n}`).toBe(`${table}:0`);
    }
  });

  it("deletes the account of a user who never connected Strava", async () => {
    const userId = "user_delete_no_strava";
    await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', '')`)
      .bind(userId)
      .run();

    const res = await testApp().request(
      "/v1/account",
      { method: "DELETE", headers: { "x-test-user": userId } },
      env
    );
    expect(res.status).toBe(200);

    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE id = ?`)
      .bind(userId)
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it("still clears D1 rows when Strava rejects the deauthorization", async () => {
    const userId = "user_delete_strava_fails";
    await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', '')`)
      .bind(userId)
      .run();
    await env.DB.prepare(
      `INSERT INTO strava_connections (user_id, athlete_id, access_token_ciphertext, refresh_token_ciphertext, expires_at, status, connected_at)
       VALUES (?, 1001, ?, ?, ?, 'active', '')`
    )
      .bind(
        userId,
        await encryptSecret("access-tok", env.TOKEN_KEY),
        await encryptSecret("refresh-tok", env.TOKEN_KEY),
        Math.floor(Date.now() / 1000) + 3600
      )
      .run();

    const { fetchImpl } = makeFakeFetch([
      {
        match: (url) => url.endsWith("/oauth/deauthorize"),
        respond: () => jsonResponse(401, {}),
      },
    ]);

    const res = await testApp(fetchImpl).request(
      "/v1/account",
      { method: "DELETE", headers: { "x-test-user": userId } },
      env
    );
    expect(res.status).toBe(200);

    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM strava_connections WHERE user_id = ?`
    )
      .bind(userId)
      .first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it("reports 502 when the auth user cannot be removed", async () => {
    const userId = "user_delete_clerk_fails";
    await env.DB.prepare(`INSERT INTO users (id, timezone, created_at) VALUES (?, 'UTC', '')`)
      .bind(userId)
      .run();

    const res = await testApp(undefined, async () => {
      throw new Error("clerk down");
    }).request("/v1/account", { method: "DELETE", headers: { "x-test-user": userId } }, env);
    expect(res.status).toBe(502);
  });

  it("gates the strava connect start on the strava-sync feature", async () => {
    const locked = await testApp().request(
      "/v1/connect/strava/start",
      { headers: { "x-test-user": "user_free" } },
      env
    );
    expect(locked.status).toBe(402);
    expect(await locked.json()).toEqual({
      error: "membership required",
      feature: "strava-sync",
    });

    const member = await testApp().request(
      "/v1/connect/strava/start",
      { headers: { "x-test-user": "user_member", "x-test-features": "strava-sync" } },
      env
    );
    expect(member.status).toBe(200);
    const { url } = (await member.json()) as { url: string };
    expect(url).toContain("https://www.strava.com/oauth/authorize");
  });
});
