const V_BY_DIFFICULTY: ReadonlyMap<number, number> = new Map([
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
  [5, 0],
  [6, 0],
  [7, 0],
  [8, 0],
  [9, 0],
  [10, 0],
  [11, 0],
  [12, 0],
  [13, 1],
  [14, 1],
  [15, 2],
  [16, 3],
  [17, 3],
  [18, 4],
  [19, 4],
  [20, 5],
  [21, 5],
  [22, 6],
  [23, 7],
  [24, 8],
  [25, 8],
  [26, 9],
  [27, 10],
  [28, 11],
  [29, 12],
  [30, 13],
  [31, 14],
  [32, 15],
  [33, 16],
  [34, 17],
  [35, 18],
  [36, 19],
  [37, 20],
  [38, 21],
  [39, 22],
]);

export function v(difficulty: number): number | undefined {
  return V_BY_DIFFICULTY.get(difficulty);
}

export function vFromDisplay(display: number): number | undefined {
  return v(Math.round(display));
}

const V_BY_FONT: ReadonlyMap<string, number> = new Map([
  ["1", 0],
  ["2", 0],
  ["3", 0],
  ["4", 0],
  ["4+", 0],
  ["5", 1],
  ["5+", 2],
  ["6A", 3],
  ["6A+", 3],
  ["6B", 4],
  ["6B+", 4],
  ["6C", 5],
  ["6C+", 5],
  ["7A", 6],
  ["7A+", 7],
  ["7B", 8],
  ["7B+", 8],
  ["7C", 9],
  ["7C+", 10],
  ["8A", 11],
  ["8A+", 12],
  ["8B", 13],
  ["8B+", 14],
  ["8C", 15],
  ["8C+", 16],
  ["9A", 17],
]);

export const FONT_GRADES: readonly string[] = [...V_BY_FONT.keys()];

export function vFromFont(font: string): number | undefined {
  return V_BY_FONT.get(font.trim().toUpperCase());
}

const FONT_BY_V: readonly string[] = [
  "4",
  "5",
  "5+",
  "6A",
  "6B",
  "6C",
  "7A",
  "7A+",
  "7B",
  "7C",
  "7C+",
  "8A",
  "8A+",
  "8B",
  "8B+",
  "8C",
  "8C+",
  "9A",
];

export function fontFromV(vGrade: number): string | undefined {
  return FONT_BY_V[vGrade];
}
