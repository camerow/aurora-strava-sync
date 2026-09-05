import { createClerkClient, verifyToken } from "@clerk/backend";
// signedInAuthObject is Clerk's own internal builder for the `has()` helper; it is what every
// Clerk SDK calls after verifying a token, and it keeps billing claim parsing out of our code.
import { signedInAuthObject } from "@clerk/backend/internal";
import { verifyWebhook } from "@clerk/backend/webhooks";
import type { Env } from "./bindings";

export type AuthedUser = {
  userId: string;
  hasFeature: (feature: string) => boolean;
};

export async function verifyClerkUser(req: Request, env: Env): Promise<AuthedUser | null> {
  const header = req.headers.get("Authorization");
  if (header === null || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  try {
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    const auth = signedInAuthObject({ sessionToken: token }, token, payload);
    return { userId: payload.sub, hasFeature: (feature) => auth.has({ feature }) };
  } catch (err) {
    console.error(`clerk token rejected: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export async function deleteClerkUser(userId: string, env: Env): Promise<void> {
  await createClerkClient({ secretKey: env.CLERK_SECRET_KEY }).users.deleteUser(userId);
}

export type AuthWebhookEvent = { type: string; userId: string | null };

export async function verifyClerkWebhook(req: Request, env: Env): Promise<AuthWebhookEvent> {
  const event = await verifyWebhook(req, {
    signingSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
  });
  const id: unknown = event.data.id;
  return { type: event.type, userId: typeof id === "string" ? id : null };
}
