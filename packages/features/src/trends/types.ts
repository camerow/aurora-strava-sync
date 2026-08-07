export type TrendMetric = "volume" | "pyramid" | "hardest" | "flash" | "avggrade";

export type TrendRange = "1m" | "3m" | "6m" | "ytd" | "1y" | "all";

export const TREND_RANGES: Array<{ value: TrendRange; label: string }> = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "ALL" },
];

export type TrendBarVM = {
  height: number;
  peak: boolean;
  valueLabel: string;
  axisLabel: string;
};

export type TrendTileVM = {
  metric: TrendMetric;
  label: string;
  value: string;
  caption: string;
  bars: TrendBarVM[];
};

export type TrendSpecVM = { k: string; v: string };

export type TrendDetailVM = {
  metric: TrendMetric;
  title: string;
  caption: string;
  bars: TrendBarVM[];
  specs: TrendSpecVM[];
  insight: string;
};

export type TrendsVM = {
  caption: string;
  tiles: TrendTileVM[];
  details: Record<TrendMetric, TrendDetailVM>;
};
