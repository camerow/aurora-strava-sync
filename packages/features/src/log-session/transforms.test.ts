import { describe, expect, it } from "vitest";
import {
  convertGrade,
  draftProblem,
  draftSummary,
  durationLabel,
  durationMinutes,
  emptyDraft,
  gradeOptions,
  toLogSessionInput,
  vGradeOf,
  withScale,
} from "./transforms";
import type { LogSessionDraft } from "./types";

function draft(overrides: Partial<LogSessionDraft> = {}): LogSessionDraft {
  return {
    name: "Tuesday board night",
    date: "2026-08-26",
    startTime: "18:30",
    endTime: "20:00",
    location: "indoor",
    scale: "v",
    rpe: null,
    climbs: [
      { key: "a", grade: "V4", name: "Cave traverse", kind: "send", tries: 2 },
      { key: "b", grade: "V6", name: "", kind: "attempt", tries: 4 },
    ],
    ...overrides,
  };
}

describe("gradeOptions", () => {
  it("lists V0-V17 and the Font ladder without the sub-4 grades", () => {
    expect(gradeOptions("v")).toHaveLength(18);
    expect(gradeOptions("v")[0]).toBe("V0");
    expect(gradeOptions("font")).toContain("6C+");
    expect(gradeOptions("font")).not.toContain("3");
  });
});

describe("vGradeOf", () => {
  it("parses both scales", () => {
    expect(vGradeOf("V7", "v")).toBe(7);
    expect(vGradeOf("6C+", "font")).toBe(5);
    expect(vGradeOf("V99", "v")).toBeUndefined();
    expect(vGradeOf("banana", "font")).toBeUndefined();
  });
});

describe("convertGrade", () => {
  it("converts between scales and keeps unknown grades as-is", () => {
    expect(convertGrade("V4", "v", "font")).toBe("6B");
    expect(convertGrade("7A", "font", "v")).toBe("V6");
    expect(convertGrade("mystery", "v", "font")).toBe("mystery");
  });
});

describe("withScale", () => {
  it("converts every climb's grade label", () => {
    const font = withScale(draft(), "font");
    expect(font.scale).toBe("font");
    expect(font.climbs.map((c) => c.grade)).toEqual(["6B", "7A"]);
  });
});

describe("durationMinutes", () => {
  it("derives duration and wraps past midnight", () => {
    expect(durationMinutes("18:30", "20:00")).toBe(90);
    expect(durationMinutes("23:00", "01:00")).toBe(120);
    expect(durationMinutes("bad", "20:00")).toBeUndefined();
  });

  it("labels durations", () => {
    expect(durationLabel(90)).toBe("1H 30M");
    expect(durationLabel(60)).toBe("1H");
    expect(durationLabel(45)).toBe("45M");
  });
});

describe("emptyDraft", () => {
  it("defaults to a 90-minute window ending now", () => {
    const d = emptyDraft(new Date(2026, 7, 26, 20, 2));
    expect(d.date).toBe("2026-08-26");
    expect(d.startTime).toBe("18:30");
    expect(d.endTime).toBe("20:00");
    expect(d.climbs).toHaveLength(1);
    expect(d.rpe).toBeNull();
  });
});

describe("draftSummary", () => {
  it("summarises climbs, results, top grade, and duration", () => {
    expect(draftSummary(draft())).toBe("2 CLIMBS · 1 SEND, 1 ATTEMPT · TOP V6 · 1H 30M");
  });

  it("uses the active scale for the top grade", () => {
    expect(draftSummary(withScale(draft(), "font"))).toContain("TOP 7A");
  });
});

describe("draftProblem", () => {
  it("accepts a complete draft", () => {
    expect(draftProblem(draft())).toBeNull();
  });

  it("flags missing climbs, bad times, and over-long sessions", () => {
    expect(draftProblem(draft({ climbs: [] }))).toContain("climb");
    expect(draftProblem(draft({ endTime: "" }))).toContain("time");
    expect(draftProblem(draft({ startTime: "18:00", endTime: "07:00" }))).toContain("12 hours");
  });
});

describe("toLogSessionInput", () => {
  it("builds the API payload with per-climb grades", () => {
    expect(toLogSessionInput(draft())).toEqual({
      name: "Tuesday board night",
      date: "2026-08-26",
      startTime: "18:30",
      endTime: "20:00",
      location: "indoor",
      climbs: [
        { name: "Cave traverse", grade: { scale: "v", value: 4 }, kind: "send", tries: 2 },
        { grade: { scale: "v", value: 6 }, kind: "attempt", tries: 4 },
      ],
    });
  });

  it("carries the RPE override and Font grades", () => {
    const input = toLogSessionInput(withScale(draft({ rpe: 8, name: "  " }), "font"));
    expect(input.rpe).toBe(8);
    expect(input.name).toBeUndefined();
    expect(input.climbs[0]?.grade).toEqual({ scale: "font", value: "6B" });
  });
});
