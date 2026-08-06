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
