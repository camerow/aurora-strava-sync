import type { Env } from "../bindings";
import { decryptSecret } from "./crypto";
import * as repo from "./repo";
import { StravaClient } from "./strava";

// Revoking Strava is best effort: a lapsed or already-revoked grant must never
// leave the user's data behind. Safe to run twice - the webhook fires after our
// own endpoint has already purged, and both steps no-op on missing rows.
export async function purgeAccount(
  env: Env,
  userId: string,
  fetchImpl: typeof fetch
): Promise<void> {
  const strava = await repo.getStravaConnection(env.DB, userId);
  if (strava !== null) {
    const client = new StravaClient(
      { clientId: env.STRAVA_CLIENT_ID, clientSecret: env.STRAVA_CLIENT_SECRET },
      {
        accessToken: await decryptSecret(strava.access_token_ciphertext, env.TOKEN_KEY),
        refreshToken: await decryptSecret(strava.refresh_token_ciphertext, env.TOKEN_KEY),
        expiresAt: strava.expires_at,
      },
      fetchImpl
    );
    try {
      await client.deauthorize();
    } catch (err) {
      console.error(
        `strava deauthorize failed during account deletion: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  await repo.deleteUserData(env.DB, userId);
}
