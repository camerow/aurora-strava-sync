import { describe, expect, it } from "vitest";
import { defaultEffortConfig, points, score, sessionPoints } from "./effort";
import type { Session } from "./session";

function at(day: number, hour: number, minute: number): Date {
  return new Date(2026, 6, day, hour, minute);
}

function mkSession(day: number, hour: number, n: number, grade: number): Session {
  const climbs = Array.from({ length: n }, (_, i) => ({
    time: at(day, hour, i * 10),
    vGrade: grade,
    name: "",
    kind: "send" as const,
    tries: 1,
  }));
  const first = climbs[0]!;
  const last = climbs[climbs.length - 1]!;
  return {
    start: new Date(first.time.getTime() - 10 * 60_000),
    end: new Date(last.time.getTime() + 5 * 60_000),
    climbs,
  };
}

function history6(climbsPerSession: number, grade: number): Session[] {
  return Array.from({ length: 6 }, (_, i) => mkSession(i + 1, 18, climbsPerSession, grade));
}

describe("points", () => {
  it("grows exponentially with grade", () => {
    expect(points(0)).toBe(1);
    expect(points(2)).toBe(2);
    expect(points(4)).toBe(4);
    expect(points(6)).toBe(8);
  });

  it("scores unknown grades as V1", () => {
    expect(points(-1)).toBe(points(1));
  });
});

describe("sessionPoints", () => {
  it("weights attempts at the bid weight", () => {
    const s: Session = {
      start: at(1, 18, 0),
      end: at(1, 19, 0),
      climbs: [
        { time: at(1, 18, 0), vGrade: 4, name: "", kind: "send", tries: 1 },
        { time: at(1, 18, 10), vGrade: 4, name: "", kind: "attempt", tries: 1 },
      ],
    };
    expect(sessionPoints(s, defaultEffortConfig())).toBe(4 + 4 * 0.4);
  });
});

describe("score", () => {
  it("scores the median session as RPE 6", () => {
    const history = history6(10, 4);
    const res = score(mkSession(10, 18, 10, 4), history, defaultEffortConfig());
    expect(res.rpe).toBe(6);
    expect(res.title).toContain("Solid climbing session");
    expect(res.title).toContain("10 climbs, top V4");
  });

  it("scores small sessions below 6 and big sessions above 6", () => {
    const history = history6(10, 4);
    const small = score(mkSession(10, 18, 4, 3), history, defaultEffortConfig());
    const big = score(mkSession(10, 18, 18, 5), history, defaultEffortConfig());
    expect(small.rpe).toBeLessThan(6);
    expect(big.rpe).toBeGreaterThan(6);
  });

  it("nudges up when projecting above the rolling max", () => {
    const history = history6(10, 4);
    const base = mkSession(10, 18, 10, 4);
    const project = mkSession(10, 18, 10, 4);
    project.climbs[9] = { ...project.climbs[9]!, vGrade: 6, kind: "attempt" };
    const baseRes = score(base, history, defaultEffortConfig());
    const projRes = score(project, history, defaultEffortConfig());
    expect(projRes.rpe).toBeGreaterThan(baseRes.rpe);
  });

  it("defaults to near 6 with no history", () => {
    const res = score(mkSession(10, 18, 10, 4), [], defaultEffortConfig());
    expect(res.rpe).toBeGreaterThanOrEqual(5);
    expect(res.rpe).toBeLessThanOrEqual(7);
  });

  it("renders the summary stats line and climb log", () => {
    const s: Session = {
      start: at(1, 17, 50),
      end: at(1, 18, 25),
      climbs: [
        { time: at(1, 18, 0), vGrade: 4, name: "Jug Life", kind: "send", tries: 1 },
        { time: at(1, 18, 10), vGrade: 7, name: "Crimp Reaper", kind: "send", tries: 1 },
        { time: at(1, 18, 20), vGrade: 7, name: "Crimp Reaper", kind: "attempt", tries: 3 },
      ],
    };
    const res = score(s, [], defaultEffortConfig());
    for (const want of [
      "2 sends",
      "1 attempt",
      "V4-V7",
      "avg V6.0",
      "synced by boardsync",
      "RPE",
      "✓ V4 Jug Life",
      "✓ V7 Crimp Reaper",
      "✗ V7 Crimp Reaper (3 tries)",
    ]) {
      expect(res.summary).toContain(want);
    }
  });

  it("omits grade stats when no grades are known", () => {
    const s: Session = {
      start: at(1, 17, 50),
      end: at(1, 18, 5),
      climbs: [{ time: at(1, 18, 0), vGrade: -1, name: "", kind: "attempt", tries: 1 }],
    };
    const res = score(s, [], defaultEffortConfig());
    expect(res.summary).not.toContain("avg");
    expect(res.summary).toContain("✗ V?");
  });

  it("uses the singular for one climb", () => {
    const res = score(mkSession(10, 18, 1, 4), [], defaultEffortConfig());
    expect(res.title).toContain("1 climb,");
    expect(res.title).not.toContain("1 climbs");
  });

  it("labels high-scoring sessions well below the rolling max as volume", () => {
    const history = history6(8, 6);
    const volume = score(mkSession(10, 18, 40, 3), history, defaultEffortConfig());
    expect(volume.rpe).toBeGreaterThanOrEqual(8);
    expect(volume.title).toContain("volume climbing session");
    if (volume.rpe === 10) {
      expect(volume.title).toContain("Max volume climbing session");
    }
    const limit = score(mkSession(10, 18, 40, 6), history, defaultEffortConfig());
    expect(limit.title).not.toContain("volume climbing session");
    const near = score(mkSession(10, 18, 40, 5), history, defaultEffortConfig());
    expect(near.title).not.toContain("volume climbing session");
  });
});
