export type TrendMetric = "volume" | "pyramid" | "hardest" | "flash" | "avggrade";

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
