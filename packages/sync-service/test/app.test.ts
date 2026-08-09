import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Env } from "../src/bindings";
import { decryptSecret, encryptSecret } from "../src/lib/crypto";
import { jsonResponse, makeFakeFetch } from "./fakes";

function testApp(fetchImpl?: typeof fetch) {
  return createApp({
    verifyUser: async (req) => req.headers.get("x-test-user"),
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
    expect(queued).toEqual([{ userId: "user_connect", board: "tension" }]);
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
    expect(sent).toEqual([{ userId: "user_q" }]);
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
    expect(sent).toEqual([{ userId: "user_qb", board: "kilter" }]);
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
        headers: { "x-test-user": "user_posting", "Content-Type": "application/json" },
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
});
