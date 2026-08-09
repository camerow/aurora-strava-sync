import { describe, expect, it } from "vitest";
import type { ConnectionStatus, SessionRow } from "@sendtally/api-client";
import { sessionBadge } from "./badges";

function session(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    fingerprint: "fp",
    board: "tension",
    start_at: "2026-08-08T18:00:00.000Z",
    end_at: "2026-08-08T19:00:00.000Z",
    climb_count: 3,
    top_grade: 6,
    rpe: 7,
    title: "T",
    strava_activity_id: null,
    posted_at: null,
    inProgress: false,
    ...overrides,
  };
}

function status(): ConnectionStatus {
  return {
    boards: [{ board: "tension", status: "active", postingEnabled: true, postSince: null }],
    strava: { athleteId: 1, status: "active" },
    sync: null,
    autoSync: true,
  };
}

describe("sessionBadge", () => {
  it("marks an in-progress session even when posting is enabled", () => {
    expect(sessionBadge(session({ inProgress: true }), status())).toBe("in_progress");
  });

  it("prefers in_progress over on_strava", () => {
    expect(sessionBadge(session({ inProgress: true, strava_activity_id: 9 }), status())).toBe(
      "in_progress"
    );
  });

  it("still reports will_post for a settled session", () => {
    expect(sessionBadge(session(), status())).toBe("will_post");
  });

  it("still reports on_strava for a posted session", () => {
    expect(sessionBadge(session({ strava_activity_id: 9 }), status())).toBe("on_strava");
  });
});
