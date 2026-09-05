import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { defaultSessionConfig, isInProgress } from "@sendtally/core";
import { z } from "zod";
import type { AuthedUser, AuthWebhookEvent } from "./auth";
import type { Env } from "./bindings";
import { purgeAccount } from "./lib/account";
import { AuroraClient, baseUrlFor, BOARDS, InvalidBoardCredentialsError } from "./lib/aurora";
import { decryptSecret, encryptSecret } from "./lib/crypto";
import { buildManualSession, historySession, manualSessionBody } from "./lib/manual";
import { getPostHog } from "./lib/posthog";
import * as repo from "./lib/repo";
import {
  authorizeUrl,
  exchangeAuthCode,
  StravaClient,
  StravaUnauthorizedError,
} from "./lib/strava";
import { wallClockNow } from "./lib/time";

export type AppDeps = {
  verifyUser: (req: Request, env: Env) => Promise<AuthedUser | null>;
  deleteAuthUser: (userId: string, env: Env) => Promise<void>;
  verifyAuthWebhook: (req: Request, env: Env) => Promise<AuthWebhookEvent>;
  fetchImpl?: typeof fetch;
};

type Vars = { userId: string; hasFeature: (feature: string) => boolean };

type AppEnv = { Bindings: Env; Variables: Vars };

const connectBoardBody = z.object({
  board: z.enum(BOARDS as [string, ...string[]]),
  username: z.string().min(1),
  password: z.string().min(1),
  timezone: z.string().min(1).default("UTC"),
});

const stravaPostingBody = z.object({
  board: z.enum(BOARDS as [string, ...string[]]),
  mode: z.enum(["off", "new", "all"]),
});

const syncNowBody = z.object({
  board: z.enum(BOARDS as [string, ...string[]]).optional(),
});

const syncScheduleBody = z.object({
  mode: z.enum(["off", "daily"]),
});

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const fetchImpl: typeof fetch = deps.fetchImpl ?? ((input, init) => fetch(input, init));
  const app = new Hono<AppEnv>();

  const captureEvent = async (
    env: Env,
    event: string,
    properties: Record<string, string | boolean>,
    distinctId?: string
  ) => {
    const posthog = getPostHog(env);
    if (posthog === null) return;
    posthog.capture(
      distinctId === undefined ? { event, properties } : { distinctId, event, properties }
    );
    await posthog.flush();
  };

  app.onError(async (error, c) => {
    console.error(error);
    const posthog = getPostHog(c.env);
    if (posthog !== null) {
      posthog.captureException(error, c.get("userId"));
      await posthog.flush();
    }
    return c.json({ error: "internal server error" }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/webhooks/strava", (c) => {
    if (c.req.query("hub.verify_token") !== c.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
      return c.json({ error: "bad verify token" }, 403);
    }
    return c.json({ "hub.challenge": c.req.query("hub.challenge") ?? "" });
  });

  app.post("/webhooks/strava", async (c) => {
    const event = (await c.req.json()) as {
      object_type?: string;
      object_id?: number;
      aspect_type?: string;
      updates?: Record<string, string>;
    };
    if (
      event.object_type === "athlete" &&
      event.aspect_type === "update" &&
      event.updates?.["authorized"] === "false" &&
      typeof event.object_id === "number"
    ) {
      await repo.markStravaConnectionDeadByAthlete(c.env.DB, event.object_id);
    }
    return c.json({ ok: true });
  });

  app.post("/webhooks/clerk", async (c) => {
    let event: AuthWebhookEvent;
    try {
      event = await deps.verifyAuthWebhook(c.req.raw, c.env);
    } catch (err) {
      console.error(`clerk webhook rejected: ${err instanceof Error ? err.message : String(err)}`);
      return c.json({ error: "bad signature" }, 400);
    }
    // Covers deletions we did not initiate - Clerk's account portal and the
    // Clerk dashboard both land here, and they would otherwise orphan the
    // user's D1 rows and leave their Strava grant live.
    if (event.type === "user.deleted" && event.userId !== null) {
      await purgeAccount(c.env, event.userId, fetchImpl);
    }
    return c.json({ ok: true });
  });

  app.get("/connect/strava/callback", async (c) => {
    const code = c.req.query("code");
    const stateRaw = c.req.query("state");
    if (code === undefined || stateRaw === undefined) {
      return c.json({ error: "missing code or state" }, 400);
    }
    let state: { userId: string; nonce: string; exp: number };
    try {
      state = JSON.parse(await decryptSecret(stateRaw, c.env.TOKEN_KEY)) as typeof state;
    } catch {
      return c.json({ error: "bad state" }, 400);
    }
    if (Date.now() > state.exp) return c.json({ error: "state expired" }, 400);
    c.set("userId", state.userId);
    // Soft browser binding: the web flow carries the nonce cookie and must match;
    // the mobile flow authorizes in the system browser, which never saw the cookie.
    const cookieNonce = getCookie(c, "st_oauth");
    if (cookieNonce !== undefined && cookieNonce !== state.nonce) {
      return c.json({ error: "bad state" }, 400);
    }
    deleteCookie(c, "st_oauth", { path: "/connect/strava" });

    let exchanged;
    try {
      exchanged = await exchangeAuthCode(
        { clientId: c.env.STRAVA_CLIENT_ID, clientSecret: c.env.STRAVA_CLIENT_SECRET },
        code,
        fetchImpl
      );
    } catch (err) {
      if (err instanceof StravaUnauthorizedError) {
        return c.json({ error: "strava rejected the authorization code" }, 422);
      }
      throw err;
    }
    await repo.ensureUser(c.env.DB, state.userId);
    await repo.upsertStravaConnection(c.env.DB, {
      user_id: state.userId,
      athlete_id: exchanged.athleteId,
      access_token_ciphertext: await encryptSecret(exchanged.tokens.accessToken, c.env.TOKEN_KEY),
      refresh_token_ciphertext: await encryptSecret(exchanged.tokens.refreshToken, c.env.TOKEN_KEY),
      expires_at: exchanged.tokens.expiresAt,
    });
    await c.env.SYNC_QUEUE.send({ kind: "user", userId: state.userId });
    await captureEvent(c.env, "strava_connection_completed", {}, state.userId);
    return c.redirect(`${c.env.WEB_APP_URL}/connected/strava`);
  });

  app.use("/v1/*", (c, next) =>
    cors({
      origin: c.env.WEB_APP_URL,
      allowHeaders: [
        "Authorization",
        "Content-Type",
        "X-POSTHOG-DISTINCT-ID",
        "X-POSTHOG-SESSION-ID",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    })(c, next)
  );
  app.use("/v1/*", async (c, next) => {
    const user = await deps.verifyUser(c.req.raw, c.env);
    if (user === null) return c.json({ error: "unauthorized" }, 401);
    c.set("userId", user.userId);
    c.set("hasFeature", user.hasFeature);

    const posthog = getPostHog(c.env);
    if (posthog === null) return next();

    return posthog.withContext(
      {
        distinctId: user.userId,
        sessionId: c.req.header("X-POSTHOG-SESSION-ID"),
      },
      next
    );
  });

  app.post("/v1/connect/board", async (c) => {
    const parsed = connectBoardBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid request body" }, 400);
    const { board, username, password, timezone } = parsed.data;
    const userId = c.get("userId");

    const client = new AuroraClient(baseUrlFor(board)!, fetchImpl);
    let session;
    try {
      session = await client.login(username, password);
    } catch (err) {
      if (err instanceof InvalidBoardCredentialsError) {
        return c.json({ error: "invalid board credentials" }, 422);
      }
      throw err;
    }

    await repo.upsertUser(c.env.DB, userId, timezone);
    await repo.upsertBoardConnection(c.env.DB, {
      user_id: userId,
      board,
      board_user_id: session.userId,
      token_ciphertext: await encryptSecret(session.token, c.env.TOKEN_KEY),
      sync_since: null,
    });
    await c.env.SYNC_QUEUE.send({ kind: "catalogue", board });
    await c.env.SYNC_QUEUE.send({ kind: "user", userId, board });
    await captureEvent(c.env, "board_connection_created", { board });
    return c.json({ board, boardUserId: session.userId });
  });

  app.get("/v1/connect/strava/start", async (c) => {
    const userId = c.get("userId");
    const nonce = crypto.randomUUID();
    setCookie(c, "st_oauth", nonce, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: OAUTH_STATE_TTL_MS / 1000,
      path: "/connect/strava",
    });
    const state = await encryptSecret(
      JSON.stringify({ userId, nonce, exp: Date.now() + OAUTH_STATE_TTL_MS }),
      c.env.TOKEN_KEY
    );
    const redirectUri = new URL("/connect/strava/callback", c.req.url).toString();
    const url = authorizeUrl(
      { clientId: c.env.STRAVA_CLIENT_ID, clientSecret: c.env.STRAVA_CLIENT_SECRET },
      redirectUri,
      state
    );
    await captureEvent(c.env, "strava_connection_started", {});
    return c.json({ url });
  });

  app.get("/v1/sessions", async (c) => {
    const userId = c.get("userId");
    const includeClimbs = c.req.query("include") === "climbs";
    const user = await repo.getUser(c.env.DB, userId);
    const now = wallClockNow(user?.timezone ?? "UTC");
    const cfg = defaultSessionConfig();
    const rows = await repo.listSessions(c.env.DB, userId, 200, includeClimbs);
    const sessions = rows.map(({ climbs_json, ...rest }) => ({
      ...rest,
      inProgress: rest.source === "manual" ? false : isInProgress(new Date(rest.end_at), cfg, now),
      ...(includeClimbs ? { climbs: climbs_json == null ? [] : JSON.parse(climbs_json) } : {}),
    }));
    return c.json({ sessions });
  });

  app.get("/v1/sessions/:fingerprint", async (c) => {
    const userId = c.get("userId");
    const row = await repo.getSession(c.env.DB, userId, c.req.param("fingerprint"));
    if (row === null) return c.json({ error: "not found" }, 404);
    const user = await repo.getUser(c.env.DB, userId);
    const { climbs_json, ...rest } = row;
    return c.json({
      session: {
        ...rest,
        inProgress:
          rest.source === "manual"
            ? false
            : isInProgress(
                new Date(rest.end_at),
                defaultSessionConfig(),
                wallClockNow(user?.timezone ?? "UTC")
              ),
        climbs: climbs_json == null ? [] : JSON.parse(climbs_json),
      },
    });
  });

  const manualScoringHistory = async (
    db: D1Database,
    userId: string,
    excludeFingerprint?: string
  ) => {
    const rows = await repo.listSessions(db, userId, 200, true);
    return rows
      .filter((r) => r.fingerprint !== excludeFingerprint)
      .map(historySession)
      .filter((s): s is NonNullable<typeof s> => s !== null);
  };

  const sessionResponse = async (c: { env: Env }, userId: string, fingerprint: string) => {
    const row = await repo.getSession(c.env.DB, userId, fingerprint);
    if (row === null) return null;
    const { climbs_json, ...rest } = row;
    return {
      ...rest,
      inProgress: false,
      climbs: climbs_json == null ? [] : JSON.parse(climbs_json),
    };
  };

  app.post("/v1/sessions", async (c) => {
    const parsed = manualSessionBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid request body" }, 400);
    const userId = c.get("userId");
    await repo.ensureUser(c.env.DB, userId);
    const fingerprint = `manual-${crypto.randomUUID()}`;
    const history = await manualScoringHistory(c.env.DB, userId);
    const input = buildManualSession(fingerprint, parsed.data, history);
    await repo.insertManualSession(c.env.DB, userId, input);
    await captureEvent(c.env, "manual_session_created", { session_source: "manual" });
    return c.json({ session: await sessionResponse(c, userId, fingerprint) }, 201);
  });

  app.put("/v1/sessions/:fingerprint", async (c) => {
    const parsed = manualSessionBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid request body" }, 400);
    const userId = c.get("userId");
    const fingerprint = c.req.param("fingerprint");
    const existing = await repo.getSession(c.env.DB, userId, fingerprint);
    if (existing === null) return c.json({ error: "not found" }, 404);
    if (existing.source !== "manual") {
      return c.json({ error: "only manually logged sessions can be edited" }, 409);
    }
    const history = await manualScoringHistory(c.env.DB, userId, fingerprint);
    const input = buildManualSession(fingerprint, parsed.data, history);
    await repo.updateManualSession(c.env.DB, userId, input);
    await captureEvent(c.env, "manual_session_updated", { session_source: "manual" });
    return c.json({ session: await sessionResponse(c, userId, fingerprint) });
  });

  app.delete("/v1/sessions/:fingerprint", async (c) => {
    const userId = c.get("userId");
    const fingerprint = c.req.param("fingerprint");
    const existing = await repo.getSession(c.env.DB, userId, fingerprint);
    if (existing === null) return c.json({ error: "not found" }, 404);
    if (existing.source !== "manual") {
      return c.json({ error: "only manually logged sessions can be deleted" }, 409);
    }
    await repo.deleteManualSession(c.env.DB, userId, fingerprint);
    await captureEvent(c.env, "manual_session_deleted", { session_source: "manual" });
    return c.json({ deleted: true });
  });

  app.get("/v1/status", async (c) => {
    const userId = c.get("userId");
    const user = await repo.getUser(c.env.DB, userId);
    const boards = await repo.listBoardConnections(c.env.DB, userId);
    const strava = await repo.getStravaConnection(c.env.DB, userId);
    const sync = await repo.getSyncState(c.env.DB, userId);
    return c.json({
      boards: boards.map((b) => ({
        board: b.board,
        status: b.status,
        postingEnabled: b.posting_enabled === 1,
        postSince: b.post_since,
      })),
      strava:
        strava === null
          ? null
          : {
              athleteId: strava.athlete_id,
              status: strava.status,
            },
      sync:
        sync === null ? null : { lastSyncedAt: sync.last_synced_at, lastError: sync.last_error },
      autoSync: user?.auto_sync === 1,
    });
  });

  app.post("/v1/strava/posting", async (c) => {
    const parsed = stravaPostingBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid request body" }, 400);
    const userId = c.get("userId");
    const { board, mode } = parsed.data;
    const conn = await repo.getBoardConnection(c.env.DB, userId, board);
    if (conn === null) return c.json({ error: "board is not connected" }, 409);
    const strava = await repo.getStravaConnection(c.env.DB, userId);
    if (strava === null) return c.json({ error: "strava is not connected" }, 409);
    if (mode === "off") {
      await repo.setBoardPosting(c.env.DB, userId, board, false, null);
    } else {
      const user = await repo.getUser(c.env.DB, userId);
      const postSince =
        mode === "new"
          ? `${wallClockNow(user?.timezone ?? "UTC")
              .toISOString()
              .slice(0, 10)} 00:00:00.000000`
          : null;
      await repo.setBoardPosting(c.env.DB, userId, board, true, postSince);
      await c.env.SYNC_QUEUE.send({ kind: "user", userId, board });
    }
    await captureEvent(c.env, "strava_posting_configured", { board, mode });
    return c.json({ board, mode });
  });

  app.post("/v1/sync-now", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = syncNowBody.safeParse(raw ?? {});
    if (!parsed.success) return c.json({ error: "invalid request body" }, 400);
    const userId = c.get("userId");
    const { board } = parsed.data;
    await c.env.SYNC_QUEUE.send(
      board === undefined ? { kind: "user", userId } : { kind: "user", userId, board }
    );
    await captureEvent(c.env, "sync_requested", {
      sync_scope: board === undefined ? "all_boards" : "board",
    });
    return c.json({ queued: true });
  });

  app.delete("/v1/account", async (c) => {
    const userId = c.get("userId");
    await purgeAccount(c.env, userId, fetchImpl);
    try {
      await deps.deleteAuthUser(userId, c.env);
    } catch (err) {
      console.error(
        `clerk user deletion failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return c.json({ error: "account data deleted but sign-in could not be removed" }, 502);
    }
    return c.json({ deleted: true });
  });

  app.post("/v1/sync-schedule", async (c) => {
    const parsed = syncScheduleBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid request body" }, 400);
    const userId = c.get("userId");
    await repo.ensureUser(c.env.DB, userId);
    await repo.setAutoSync(c.env.DB, userId, parsed.data.mode === "daily");
    await captureEvent(c.env, "sync_schedule_updated", { mode: parsed.data.mode });
    return c.json({ mode: parsed.data.mode });
  });

  return app;
}
