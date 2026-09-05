import { describe, expect, it } from "vitest";
import { toWallClockString, wallClockNow } from "../src/lib/time";

describe("wallClockNow", () => {
  it("returns the wall clock of the given timezone", () => {
    const instant = new Date("2026-01-15T12:00:00Z");
    expect(wallClockNow("UTC", instant).toISOString()).toBe("2026-01-15T12:00:00.000Z");
    expect(wallClockNow("America/New_York", instant).toISOString()).toBe(
      "2026-01-15T07:00:00.000Z"
    );
  });
});

describe("toWallClockString", () => {
  it("renders the Strava start_date_local format", () => {
    expect(toWallClockString(new Date("2026-07-01T18:05:30.000Z"))).toBe("2026-07-01T18:05:30Z");
  });
});
