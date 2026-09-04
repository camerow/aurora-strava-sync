import { signedInAuthObject } from "@clerk/backend/internal";
import { describe, expect, it } from "vitest";
import { INSIGHTS_FEATURE } from "../src/features";

function claims(fea: string): Parameters<typeof signedInAuthObject>[2] {
  return {
    v: 2,
    fea,
    sub: "user_test",
    sid: "sess_test",
    iss: "https://clerk.sendtally.com",
    exp: 0,
    iat: 0,
    nbf: 0,
  } as unknown as Parameters<typeof signedInAuthObject>[2];
}

function hasFeature(fea: string, feature: string): boolean {
  return signedInAuthObject({ sessionToken: "tok" }, "tok", claims(fea)).has({ feature });
}

describe("billing claims", () => {
  it("reads user-scoped features off the session token", () => {
    const fea = `u:${INSIGHTS_FEATURE}`;
    expect(hasFeature(fea, INSIGHTS_FEATURE)).toBe(true);
  });

  it("denies features the plan does not grant", () => {
    expect(hasFeature("", INSIGHTS_FEATURE)).toBe(false);
  });
});
