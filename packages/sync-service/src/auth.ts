import { verifyToken } from "@clerk/backend";
// signedInAuthObject is Clerk's own internal builder for the `has()` helper; it is what every
// Clerk SDK calls after verifying a token, and it keeps billing claim parsing out of our code.
import { signedInAuthObject } from "@clerk/backend/internal";
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
