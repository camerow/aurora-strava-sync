import { describe, expect, it } from "vitest";
import type { SessionRow } from "@sendtally/api-client";
import {
  adjacentSessionMonths,
  monthsOfYear,
  resolveSessionMonth,
  sessionMonths,
  sessionYears,
} from "./months";

function session(fingerprint: string, startAt: string): SessionRow {
  return {
    fingerprint,
    board: "tension",
    source: "board",
    location: null,
    name: null,
    start_at: startAt,
    end_at: startAt,
    climb_count: 3,
    top_grade: 6,
    top_send_grade: 6,
    rpe: 7,
    title: "T",
    strava_activity_id: null,
    posted_at: null,
    inProgress: false,
  };
}

const sessions = [
  session("a", "2026-08-20T18:00:00.000Z"),
  session("b", "2026-08-02T18:00:00.000Z"),
  session("c", "2026-05-11T18:00:00.000Z"),
  session("d", "2025-12-31T23:30:00.000Z"),
];

describe("sessionMonths", () => {
  it("groups sessions by UTC month, newest month first", () => {
    const months = sessionMonths(sessions);
    expect(months.map((m) => m.key)).toEqual(["2026-08", "2026-05", "2025-12"]);
    expect(months[0]?.label).toBe("August 2026");
    expect(months[0]?.sessions.map((s) => s.fingerprint)).toEqual(["a", "b"]);
    expect(months[2]?.label).toBe("December 2025");
  });

  it("returns nothing for no sessions", () => {
    expect(sessionMonths([])).toEqual([]);
    expect(resolveSessionMonth([], "2026-08")).toBeNull();
  });
});

describe("resolveSessionMonth", () => {
  const months = sessionMonths(sessions);

  it("picks the requested month", () => {
    expect(resolveSessionMonth(months, "2026-05")?.key).toBe("2026-05");
  });

  it("falls back to the newest month for unknown or missing keys", () => {
    expect(resolveSessionMonth(months, null)?.key).toBe("2026-08");
    expect(resolveSessionMonth(months, "2024-01")?.key).toBe("2026-08");
  });
});

describe("adjacentSessionMonths", () => {
  const months = sessionMonths(sessions);

  it("skips empty months when stepping", () => {
    const { newer, older } = adjacentSessionMonths(months, "2026-05");
    expect(newer?.key).toBe("2026-08");
    expect(older?.key).toBe("2025-12");
  });

  it("has no newer month at the newest end", () => {
    expect(adjacentSessionMonths(months, "2026-08").newer).toBeNull();
    expect(adjacentSessionMonths(months, "2025-12").older).toBeNull();
  });
});

describe("sessionYears and monthsOfYear", () => {
  const months = sessionMonths(sessions);

  it("lists years newest first", () => {
    expect(sessionYears(months)).toEqual([2026, 2025]);
  });

  it("lays out twelve slots with nulls for empty months", () => {
    const slots = monthsOfYear(months, 2026);
    expect(slots).toHaveLength(12);
    expect(slots[7]?.key).toBe("2026-08");
    expect(slots[4]?.key).toBe("2026-05");
    expect(slots[0]).toBeNull();
  });
});
