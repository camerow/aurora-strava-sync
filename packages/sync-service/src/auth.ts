import { verifyToken } from "@clerk/backend";
import type { Env } from "./bindings";

export async function verifyClerkUser(req: Request, env: Env): Promise<string | null> {
  const header = req.headers.get("Authorization");
  if (header === null || !header.startsWith("Bearer ")) return null;
  try {
    const payload = await verifyToken(header.slice("Bearer ".length), {
      secretKey: env.CLERK_SECRET_KEY,
    });
    return payload.sub;
  } catch (err) {
    console.error(`clerk token rejected: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
