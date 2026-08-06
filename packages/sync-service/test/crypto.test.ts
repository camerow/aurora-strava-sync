import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../src/lib/crypto";

describe("crypto", () => {
  it("round-trips a secret", async () => {
    const ciphertext = await encryptSecret("board-token-123", env.TOKEN_KEY);
    expect(ciphertext).not.toContain("board-token-123");
    expect(await decryptSecret(ciphertext, env.TOKEN_KEY)).toBe("board-token-123");
  });

  it("produces a different ciphertext per call", async () => {
    const a = await encryptSecret("same", env.TOKEN_KEY);
    const b = await encryptSecret("same", env.TOKEN_KEY);
    expect(a).not.toBe(b);
  });

  it("rejects tampered ciphertext", async () => {
    const ciphertext = await encryptSecret("secret", env.TOKEN_KEY);
    const tampered = ciphertext.slice(0, -4) + (ciphertext.endsWith("AAAA") ? "BBBB" : "AAAA");
    await expect(decryptSecret(tampered, env.TOKEN_KEY)).rejects.toThrow();
  });
});
