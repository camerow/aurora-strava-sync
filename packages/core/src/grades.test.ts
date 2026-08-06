import { describe, expect, it } from "vitest";
import { v, vFromDisplay } from "./grades";

describe("v", () => {
  const cases: Array<[difficulty: number, want: number | undefined]> = [
    [1, 0],
    [12, 0],
    [13, 1],
    [15, 2],
    [18, 4],
    [22, 6],
    [23, 7],
    [27, 10],
    [39, 22],
    [0, undefined],
    [40, undefined],
  ];

  it.each(cases)("v(%i) = %s", (difficulty, want) => {
    expect(v(difficulty)).toBe(want);
  });
});

describe("vFromDisplay", () => {
  it("truncates within a grade band", () => {
    expect(vFromDisplay(18.4)).toBe(4);
  });

  it("rounds up across a band boundary", () => {
    expect(vFromDisplay(22.6)).toBe(7);
  });
});
