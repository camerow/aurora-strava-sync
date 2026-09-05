import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { decryptSecret, encryptSecret } from "../src/lib/crypto";
import { jsonResponse, makeFakeFetch } from "./fakes";

function testApp(fetchImpl?: typeof fetch) {
  return createApp({
    verifyUser: async (req) => {
      const userId = req.headers.get("x-test-user");
      if (userId === null) return null;
      const features = (req.headers.get("x-test-features") ?? "").split(",");
      return { userId, hasFeature: (feature) => features.includes(feature) };
    },
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
      top_send_grade: number;
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
    expect(session.top_send_grade).toBe(5);
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

  it("starts the strava connect flow for any signed-in user", async () => {
    const res = await testApp().request(
      "/v1/connect/strava/start",
      { headers: { "x-test-user": "user_free" } },
      env
    );
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    expect(url).toContain("https://www.strava.com/oauth/authorize");
  });
});
