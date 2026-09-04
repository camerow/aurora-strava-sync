import { describe, expect, it } from "vitest";
import type { SessionDetail } from "@sendtally/api-client";
import { climbVMs, filterAndSortClimbs, sessionDetailVM } from "./transforms";

const detail: SessionDetail = {
  fingerprint: "42-1",
  board: "tension",
  source: "board",
  location: null,
  name: null,
  start_at: "2026-07-01T17:50:00.000Z",
  end_at: "2026-07-01T19:25:00.000Z",
  climb_count: 4,
  top_grade: 7,
  top_send_grade: 7,
  rpe: 7,
  title: "Solid climbing session · 4 climbs, top V7",
  strava_activity_id: 555,
  posted_at: "2026-07-02T00:00:00.000Z",
  inProgress: false,
  climbs: [
    {
      time: "2026-07-01T18:00:00.000Z",
      name: "Jug Life",
      vGrade: 4,
      kind: "send",
      tries: 1,
      angle: 40,
    },
    {
      time: "2026-07-01T18:20:00.000Z",
      name: "Crimp Reaper",
      vGrade: 7,
      kind: "send",
      tries: 3,
      angle: 40,
    },
    {
      time: "2026-07-01T18:50:00.000Z",
      name: "Mind Meld",
      vGrade: 8,
      kind: "attempt",
      tries: 4,
      angle: 45,
    },
    { time: "2026-07-01T19:20:00.000Z", name: "", vGrade: -1, kind: "send", tries: 1, angle: null },
  ],
};

describe("climbVMs", () => {
  it("derives result, rest, and top-send flags in climb order", () => {
    const vms = climbVMs(detail.climbs);
    expect(vms.map((c) => c.result)).toEqual(["flash", "sent", "project", "flash"]);
    expect(vms.map((c) => c.restLabel)).toEqual(["-", "20m", "30m", "30m"]);
    expect(vms[1]?.isTopSend).toBe(true);
    expect(vms[2]?.isTopSend).toBe(false);
    expect(vms[3]?.name).toBe("Unknown climb");
    expect(vms[3]?.gradeLabel).toBe("V?");
    expect(vms[2]?.angleLabel).toBe("45°");
  });
});

describe("filterAndSortClimbs", () => {
  it("filters by result and sorts by grade", () => {
    const vms = climbVMs(detail.climbs);
    expect(filterAndSortClimbs(vms, "flash", "order").map((c) => c.n)).toEqual([1, 4]);
    expect(filterAndSortClimbs(vms, "all", "gradeDesc").map((c) => c.gradeLabel)).toEqual([
      "V8",
      "V7",
      "V4",
      "V?",
    ]);
    expect(filterAndSortClimbs(vms, "all", "burns")[0]?.burns).toBe(4);
  });
});

describe("sessionDetailVM", () => {
  it("builds the stats grid and grade bars", () => {
    const vm = sessionDetailVM(detail);
    const byLabel = Object.fromEntries(vm.stats.map((s) => [s.label, s.value]));
    expect(byLabel["TIME"]).toBe("1h 35m");
    expect(byLabel["CLIMBS"]).toBe("4");
    expect(byLabel["SENDS"]).toBe("3");
    expect(byLabel["FLASHES"]).toBe("2");
    expect(byLabel["TOP"]).toBe("V7");
    expect(vm.title).toContain("Tension Board");
    expect(vm.stravaUrl).toBe("https://www.strava.com/activities/555");
    expect(vm.syncLine).toBe("ON STRAVA · POSTED JUL 2");

    const v7 = vm.bars.find((b) => b.gradeLabel === "V7");
    expect(v7?.peak).toBe(true);
    const v8 = vm.bars.find((b) => b.gradeLabel === "V8");
    expect(v8?.count).toBe(0);
    expect(vm.filterCounts).toEqual({ all: 4, sent: 3, flash: 2, project: 1 });
  });

  it("shows the in-progress sync line even when not yet posted", () => {
    const vm = sessionDetailVM({
      ...detail,
      inProgress: true,
      strava_activity_id: null,
      posted_at: null,
    });
    expect(vm.syncLine).toBe("IN PROGRESS · POSTS WHEN THE SESSION SETTLES");
  });

  it("prefers the in-progress sync line over an already-posted session", () => {
    const vm = sessionDetailVM({ ...detail, inProgress: true });
    expect(vm.syncLine).toBe("IN PROGRESS · POSTS WHEN THE SESSION SETTLES");
  });

  it("shows NOT POSTED TO STRAVA for a settled, unposted session", () => {
    const vm = sessionDetailVM({
      ...detail,
      inProgress: false,
      strava_activity_id: null,
      posted_at: null,
    });
    expect(vm.syncLine).toBe("NOT POSTED TO STRAVA");
  });

  it("still shows ON STRAVA for a settled, posted session", () => {
    const vm = sessionDetailVM({ ...detail, inProgress: false });
    expect(vm.syncLine).toBe("ON STRAVA · POSTED JUL 2");
  });

  it("titles a manual session by its name and shows its location", () => {
    const vm = sessionDetailVM({
      ...detail,
      source: "manual",
      board: null,
      name: "Tuesday board night",
      location: "indoor",
      strava_activity_id: null,
      posted_at: null,
    });
    expect(vm.title).toContain("Tuesday board night");
    expect(vm.meta).toContain("· INDOOR ·");
    expect(vm.syncLine).toBe("LOGGED MANUALLY");
  });

  it("falls back to a generic title for an unnamed manual session", () => {
    const vm = sessionDetailVM({ ...detail, source: "manual", board: null, name: null });
    expect(vm.title).toContain("Logged session");
  });
});
