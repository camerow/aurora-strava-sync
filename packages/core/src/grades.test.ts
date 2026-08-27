import { describe, expect, it } from "vitest";
import { fontFromV, v, vFromDisplay, vFromFont } from "./grades";

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

describe("vFromFont", () => {
  const cases: Array<[font: string, want: number | undefined]> = [
    ["4", 0],
    ["5", 1],
    ["5+", 2],
    ["6A", 3],
    ["6a+", 3],
    ["6B+", 4],
    ["6C", 5],
    ["7A", 6],
    ["7a+", 7],
    ["7B", 8],
    ["7C+", 10],
    ["8A", 11],
    ["8b+", 14],
    ["9A", 17],
    [" 6b ", 4],
    ["6D", undefined],
    ["V5", undefined],
    ["", undefined],
  ];

  it.each(cases)("vFromFont(%j) = %s", (font, want) => {
    expect(vFromFont(font)).toBe(want);
  });
});

describe("fontFromV", () => {
  it("round-trips through vFromFont for every V grade", () => {
    for (let grade = 0; grade <= 17; grade++) {
      const font = fontFromV(grade);
      expect(font).toBeDefined();
      expect(vFromFont(font!)).toBe(grade);
    }
  });

  it("is undefined outside the boulder range", () => {
    expect(fontFromV(-1)).toBeUndefined();
    expect(fontFromV(18)).toBeUndefined();
  });
});
