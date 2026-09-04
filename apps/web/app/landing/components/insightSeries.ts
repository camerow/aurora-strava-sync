import type { MiniBar } from "./MiniBars";

const MONTHS = ["MAR", "APR", "MAY", "JUN", "JUL", "AUG"];

export type InsightSeries = {
  metric: string;
  eyebrow: string;
  headline: string;
  meta: string;
  bars: MiniBar[];
  body: string;
  memberLine: string;
};

const VOLUME: MiniBar[] = [24, 29, 11, 27, 31, 41, 28, 0, 25, 27, 31, 32].map((v, i) => ({
  key: `w${i}`,
  value: v,
}));

const PYRAMID: MiniBar[] = [
  { key: "V2", label: "V2", value: 7 },
  { key: "V3", label: "V3", value: 18 },
  { key: "V4", label: "V4", value: 31 },
  { key: "V5", label: "V5", value: 28 },
  { key: "V6", label: "V6", value: 15 },
  { key: "V7", label: "V7", value: 2, peak: true },
  { key: "V8", label: "V8", value: 0 },
];

const FLASH: MiniBar[] = [22, 26, 25, 31, 33, 36].map((v, i) => ({
  key: MONTHS[i] ?? `m${i}`,
  label: MONTHS[i] ?? "",
  value: v,
  peak: i === 5,
}));

const HARDEST: MiniBar[] = [20, 20, 35, 35, 52, 52].map((v, i) => ({
  key: MONTHS[i] ?? `m${i}`,
  label: MONTHS[i] ?? "",
  value: v,
  peak: i === 2 || i === 4,
}));

const AVG_GRADE: MiniBar[] = [
  ["5/18", "V4.2", 42],
  ["5/25", "V4.3", 43],
  ["6/1", "V4.1", 41],
  ["6/8", "V4.4", 44],
  ["6/15", "V4.5", 45],
  ["6/22", "V4.6", 46],
  ["6/29", "V4.4", 44],
  ["7/6", "n/a", 0],
  ["7/13", "V4.6", 46],
  ["7/20", "V4.7", 47],
  ["7/27", "V4.8", 48],
  ["8/3", "V4.9", 49],
].map(([week, grade, value]) => ({
  key: String(week),
  label: String(week),
  topLabel: String(grade),
  value: Number(value),
  peak: week === "8/3",
}));

export const INSIGHT_SERIES: InsightSeries[] = [
  {
    metric: "volume",
    eyebrow: "VOLUME",
    headline: "328 climbs",
    meta: "22 SESSIONS · LAST 12 WEEKS",
    bars: VOLUME,
    body: "One empty week in July was travel, not a slump. Volume has held near thirty climbs a week since May.",
    memberLine: "Climbs and sessions per week, month or year - and the weeks you missed.",
  },
  {
    metric: "pyramid",
    eyebrow: "GRADE PYRAMID",
    headline: "111 sends",
    meta: "ALL-TIME · BY GRADE",
    bars: PYRAMID,
    body: "A V4 base with 28 V5s behind it and two V7s on top. The shape says V6 volume is what feeds the next grade.",
    memberLine:
      "Every send stacked by grade, so you can see which grade is holding the next one up.",
  },
  {
    metric: "flash",
    eyebrow: "FLASH RATE",
    headline: "36%",
    meta: "UP FROM 22% IN MARCH",
    bars: FLASH,
    body: "Reading a problem is trainable. Six months of mileage shows up here before it shows up in the grades.",
    memberLine:
      "The share you get first go, tracked over time - movement skill before grades move.",
  },
  {
    metric: "hardest",
    eyebrow: "HARDEST SEND",
    headline: "V7",
    meta: "JUL 30 · THREAD THE NEEDLE",
    bars: HARDEST,
    body: "Twelve weeks from the first V6 to the first V7, and both V7s came inside three weeks of each other.",
    memberLine: "Your ceiling by period, with the climb and the date that set it.",
  },
  {
    metric: "avggrade",
    eyebrow: "AVG SEND GRADE",
    headline: "V4.9 this week",
    meta: "+0.7 SINCE MID-MAY",
    bars: AVG_GRADE,
    body: "Average send grade has drifted up about V0.7 over twelve weeks - steady, not a spike, which tracks with the volume behind it. A logbook can tell you what you climbed on Tuesday; it can't tell you this.",
    memberLine:
      "The slow line through everything you send - the one number a logbook can never show you.",
  },
];
