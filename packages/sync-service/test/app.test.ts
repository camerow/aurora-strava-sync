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
    expect(queued).toEqual([{ userId: "user_connect" }]);
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
    expect(conn?.sync_since).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00\.000000$/);

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
});
