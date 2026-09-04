import { describe, expect, it } from "vitest";
import type { SessionRow } from "@sendtally/api-client";
import { sessionGradeLabels } from "./grades";

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

describe("sessionGradeLabels", () => {
  it("shows only the send when the hardest climb was sent", () => {
    expect(sessionGradeLabels(session())).toEqual([{ kind: "sent", label: "SENT V6" }]);
  });

  it("shows the harder attempt separately from the hardest send", () => {
    expect(sessionGradeLabels(session({ top_grade: 8, top_send_grade: 6 }))).toEqual([
      { kind: "sent", label: "SENT V6" },
      { kind: "tried", label: "TRIED V8" },
    ]);
  });

  it("shows only the attempt when nothing was sent", () => {
    expect(sessionGradeLabels(session({ top_grade: 8, top_send_grade: -1 }))).toEqual([
      { kind: "tried", label: "TRIED V8" },
    ]);
  });

  it("shows nothing when no grades are known", () => {
    expect(sessionGradeLabels(session({ top_grade: -1, top_send_grade: -1 }))).toEqual([]);
  });
});
