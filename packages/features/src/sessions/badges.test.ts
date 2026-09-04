import { describe, expect, it } from "vitest";
import type { SessionRow } from "@sendtally/api-client";
import { sessionBadge } from "./badges";
import { sessionTitle } from "./title";

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    fingerprint: "fp",
    board: "tension",
    source: "board",
    location: null,
    name: null,
    start_at: "2026-08-08T18:00:00.000Z",
    end_at: "2026-08-08T19:00:00.000Z",
    climb_count: 3,
    top_grade: 6,
    top_send_grade: 6,
    rpe: 7,
    title: "T",
    strava_activity_id: null,
    posted_at: null,
    inProgress: false,
    ...overrides,
  };
}

describe("sessionBadge", () => {
  it("marks in-progress sessions first", () => {
    expect(sessionBadge(session({ inProgress: true, strava_activity_id: 5 }))).toBe("in_progress");
  });

  it("marks posted sessions as on Strava", () => {
    expect(sessionBadge(session({ strava_activity_id: 555 }))).toBe("on_strava");
  });

  it("shows no badge for an ordinary unposted session", () => {
    expect(sessionBadge(session())).toBeNull();
    expect(sessionBadge(session({ source: "manual", board: null }))).toBeNull();
  });
});

describe("sessionTitle", () => {
  it("prefers the user-given name", () => {
    expect(sessionTitle(session({ name: "Tuesday board night" }))).toBe("Tuesday board night");
  });

  it("labels unnamed manual sessions", () => {
    expect(sessionTitle(session({ source: "manual", board: null }))).toBe("Logged session");
  });

  it("labels legacy board sessions by their board", () => {
    expect(sessionTitle(session())).toBe("Tension Board");
    expect(sessionTitle(session({ board: "unknown-board" }))).toBe("Board session");
  });
});
