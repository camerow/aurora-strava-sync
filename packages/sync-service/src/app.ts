import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import type { Env } from "./bindings";
import { AuroraClient, baseUrlFor, BOARDS, InvalidBoardCredentialsError } from "./lib/aurora";
import { decryptSecret, encryptSecret } from "./lib/crypto";
import * as repo from "./lib/repo";
import { authorizeUrl, exchangeAuthCode, StravaUnauthorizedError } from "./lib/strava";
import { wallClockNow } from "./lib/time";

export type AppDeps = {
  verifyUser: (req: Request, env: Env) => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

type Vars = { userId: string };

const connectBoardBody = z.object({
  board: z.enum(BOARDS as [string, ...string[]]),
  username: z.string().min(1),
  password: z.string().min(1),
  timezone: z.string().min(1).default("UTC"),
  backfill: z.boolean().default(false),
});

const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

export function createApp(deps: AppDeps): Hono<{ Bindings: Env; Variables: Vars }> {
  const fetchImpl: typeof fetch = deps.fetchImpl ?? ((input, init) => fetch(input, init));
  const app = new Hono<{ Bindings: Env; Variables: Vars }>();

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
    return c.redirect(`${c.env.WEB_APP_URL}/connected/strava`);
  });

  app.use("/v1/*", async (c, next) => {
    const userId = await deps.verifyUser(c.req.raw, c.env);
    if (userId === null) return c.json({ error: "unauthorized" }, 401);
    c.set("userId", userId);
    await next();
  });

  app.post("/v1/connect/board", async (c) => {
    const parsed = connectBoardBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid request body" }, 400);
    const { board, username, password, timezone, backfill } = parsed.data;
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
    const today = wallClockNow(timezone);
    const syncSince = backfill ? null : `${today.toISOString().slice(0, 10)} 00:00:00.000000`;
    await repo.upsertBoardConnection(c.env.DB, {
      user_id: userId,
      board,
      board_user_id: session.userId,
      token_ciphertext: await encryptSecret(session.token, c.env.TOKEN_KEY),
      sync_since: syncSince,
    });
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
    return c.json({ url });
  });

  app.get("/v1/sessions", async (c) => {
    const sessions = await repo.listSessions(c.env.DB, c.get("userId"), 100);
    return c.json({ sessions });
  });

  app.get("/v1/status", async (c) => {
    const userId = c.get("userId");
    const board = await repo.getBoardConnection(c.env.DB, userId);
    const strava = await repo.getStravaConnection(c.env.DB, userId);
    return c.json({
      board: board === null ? null : { board: board.board, status: board.status },
      strava: strava === null ? null : { athleteId: strava.athlete_id, status: strava.status },
    });
  });

  app.post("/v1/sync-now", async (c) => {
    await c.env.SYNC_QUEUE.send({ userId: c.get("userId") });
    return c.json({ queued: true });
  });

  return app;
}
