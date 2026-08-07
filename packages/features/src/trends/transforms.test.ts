import { describe, expect, it } from "vitest";
import type { SessionClimb, SessionWithClimbs } from "@sendtally/api-client";
import { trendsVM } from "./transforms";

const NOW = new Date("2026-08-06T12:00:00.000Z");

function session(
  startIso: string,
  climbs: Array<Partial<SessionClimb> & { vGrade: number }>
): SessionWithClimbs {
  return {
    fingerprint: `fp-${startIso}`,
    start_at: startIso,
    end_at: startIso,
    climb_count: climbs.length,
    top_grade: Math.max(...climbs.map((c) => c.vGrade)),
    rpe: 6,
    title: "",
    strava_activity_id: null,
    posted_at: null,
    climbs: climbs.map((c, i) => ({
      time: startIso,
      name: `c${i}`,
      kind: "send",
      tries: 1,
      angle: 40,
      ...c,
    })),
  };
}

const sessions: SessionWithClimbs[] = [
  session("2026-08-01T18:00:00.000Z", [{ vGrade: 4 }, { vGrade: 5, tries: 3 }, { vGrade: 7 }]),
  session("2026-07-20T18:00:00.000Z", [{ vGrade: 5 }, { vGrade: 6, tries: 2 }]),
  session("2026-05-10T18:00:00.000Z", [{ vGrade: 4 }, { vGrade: 5 }]),
];

describe("trendsVM", () => {
  it("computes the pyramid with the top grade as peak", () => {
    const vm = trendsVM(sessions, NOW);
    const pyramid = vm.details.pyramid;
    expect(pyramid.bars.map((b) => b.axisLabel)).toEqual(["V4", "V5", "V6", "V7"]);
    expect(pyramid.bars.map((b) => b.valueLabel)).toEqual(["2", "3", "1", "1"]);
    expect(pyramid.bars[3]?.peak).toBe(true);
    expect(pyramid.bars[1]?.height).toBe(1);
  });

  it("computes flash rate per month from first-try sends", () => {
    const vm = trendsVM(sessions, NOW);
    const flash = vm.details.flash;
    const aug = flash.bars[flash.bars.length - 1];
    expect(aug?.valueLabel).toBe("67%");
    const may = flash.bars[flash.bars.length - 4];
    expect(may?.valueLabel).toBe("100%");
  });

  it("tracks hardest send by month and marks improvements", () => {
    const vm = trendsVM(sessions, NOW);
    const hardest = vm.details.hardest;
    const labels = hardest.bars.map((b) => b.valueLabel);
    expect(labels[labels.length - 1]).toBe("V7");
    expect(labels[labels.length - 2]).toBe("V6");
    expect(labels[labels.length - 4]).toBe("V5");
    expect(hardest.bars[hardest.bars.length - 1]?.peak).toBe(true);
  });

  it("counts recent volume in the tile", () => {
    const vm = trendsVM(sessions, NOW);
    const volume = vm.tiles.find((t) => t.metric === "volume");
    expect(volume?.value).toBe("5 climbs");
    expect(volume?.caption).toContain("2 SESSIONS");
  });

  it("handles an empty logbook", () => {
    const vm = trendsVM([], NOW);
    expect(vm.tiles.find((t) => t.metric === "hardest")?.value).toBe("-");
    expect(vm.details.pyramid.specs[2]?.v).toBe("0 sends");
  });
});
