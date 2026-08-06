import { describe, expect, it } from "vitest";
import { buildSessions, defaultSessionConfig, type Climb } from "./session";

function at(hour: number, minute: number): Date {
  return new Date(2026, 7, 1, hour, minute);
}

describe("buildSessions", () => {
  it("splits on gaps and applies warmup/cooldown buffers", () => {
    const climbs: Climb[] = [
      { time: at(10, 0), vGrade: 4, name: "", kind: "send", tries: 1 },
      { time: at(10, 30), vGrade: 5, name: "", kind: "send", tries: 2 },
      { time: at(13, 0), vGrade: 6, name: "", kind: "attempt", tries: 3 },
    ];
    const got = buildSessions(climbs, defaultSessionConfig(), at(23, 0));
    expect(got).toHaveLength(2);
    expect(got[0]?.climbs).toHaveLength(2);
    expect(got[1]?.climbs).toHaveLength(1);
    expect(got[0]?.start).toEqual(at(9, 50));
    expect(got[0]?.end).toEqual(at(10, 35));
  });

  it("sorts input by time", () => {
    const climbs: Climb[] = [
      { time: at(10, 30), vGrade: 5, name: "", kind: "send", tries: 1 },
      { time: at(10, 0), vGrade: 4, name: "", kind: "send", tries: 1 },
    ];
    const got = buildSessions(climbs, defaultSessionConfig(), at(23, 0));
    expect(got).toHaveLength(1);
    expect(got[0]?.climbs[0]?.time).toEqual(at(10, 0));
  });

  it("skips sessions still inside the in-progress window", () => {
    const climbs: Climb[] = [{ time: at(10, 0), vGrade: 4, name: "", kind: "send", tries: 1 }];
    expect(buildSessions(climbs, defaultSessionConfig(), at(11, 0))).toHaveLength(0);
    expect(buildSessions(climbs, defaultSessionConfig(), at(12, 30))).toHaveLength(1);
  });

  it("returns nothing for empty input", () => {
    expect(buildSessions([], defaultSessionConfig(), new Date())).toHaveLength(0);
  });
});
