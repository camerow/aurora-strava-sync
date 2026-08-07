import type { SessionWithClimbs } from "@sendtally/api-client";
import type {
  TrendBarVM,
  TrendDetailVM,
  TrendMetric,
  TrendRange,
  TrendTileVM,
  TrendsVM,
} from "./types";

const WEEK_MS = 7 * 24 * 3_600_000;

type Sent = { grade: number; flash: boolean; time: number };

type Bucket = { start: number; end: number; label: string };

const RANGE_LABELS: Record<TrendRange, string> = {
  "1m": "LAST MONTH",
  "3m": "LAST 3 MONTHS",
  "6m": "LAST 6 MONTHS",
  ytd: "YEAR TO DATE",
  "1y": "LAST 12 MONTHS",
  all: "ALL TIME",
};

function sends(sessions: SessionWithClimbs[]): Sent[] {
  const out: Sent[] = [];
  for (const s of sessions) {
    for (const c of s.climbs) {
      if (c.kind === "send" && c.vGrade >= 0) {
        out.push({ grade: c.vGrade, flash: c.tries <= 1, time: Date.parse(c.time) });
      }
    }
  }
  return out;
}

function normalize(values: number[]): number[] {
  const max = Math.max(1, ...values);
  return values.map((v) => (v === 0 ? 0 : v / max));
}

function weekLabel(msStart: number): string {
  return new Date(msStart).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function monthStartUtc(year: number, month: number): number {
  return Date.UTC(year, month, 1);
}

function monthLabelOf(ms: number): string {
  return new Date(ms)
    .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
}

function trailingWeeks(now: Date, weeks: number): Bucket[] {
  const out: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = now.getTime() - (i + 1) * WEEK_MS;
    out.push({ start, end: start + WEEK_MS, label: weekLabel(start) });
  }
  return out;
}

function monthsBetween(firstMs: number, now: Date): Bucket[] {
  const first = new Date(firstMs);
  const out: Bucket[] = [];
  let y = first.getUTCFullYear();
  let m = first.getUTCMonth();
  while (y < now.getUTCFullYear() || (y === now.getUTCFullYear() && m <= now.getUTCMonth())) {
    const start = monthStartUtc(y, m);
    const end = monthStartUtc(y, m + 1);
    out.push({ start, end, label: monthLabelOf(start) });
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

function trailingMonths(now: Date, months: number): Bucket[] {
  const first = monthStartUtc(now.getUTCFullYear(), now.getUTCMonth() - (months - 1));
  return monthsBetween(first, now);
}

function yearsBetween(firstMs: number, now: Date): Bucket[] {
  const out: Bucket[] = [];
  for (let y = new Date(firstMs).getUTCFullYear(); y <= now.getUTCFullYear(); y++) {
    out.push({ start: Date.UTC(y, 0, 1), end: Date.UTC(y + 1, 0, 1), label: String(y) });
  }
  return out;
}

export function bucketsFor(range: TrendRange, now: Date, firstSessionMs: number | null): Bucket[] {
  switch (range) {
    case "1m":
      return trailingWeeks(now, 4);
    case "3m":
      return trailingWeeks(now, 13);
    case "6m":
      return trailingMonths(now, 6);
    case "ytd":
      return trailingMonths(now, now.getUTCMonth() + 1);
    case "1y":
      return trailingMonths(now, 12);
    case "all": {
      const first = firstSessionMs ?? now.getTime();
      const months = monthsBetween(first, now);
      return months.length > 24 ? yearsBetween(first, now) : months;
    }
  }
}

function thinAxis(buckets: Bucket[]): (i: number) => string {
  const every = Math.max(1, Math.ceil(buckets.length / 6));
  return (i) => (i % every === 0 || i === buckets.length - 1 ? buckets[i]!.label : "");
}

export function trendsVM(
  sessions: SessionWithClimbs[],
  range: TrendRange = "3m",
  now: Date = new Date()
): TrendsVM {
  const rangeLabel = RANGE_LABELS[range];
  const sessionTimes = sessions.map((s) => Date.parse(s.start_at));
  const firstSessionMs = sessionTimes.length > 0 ? Math.min(...sessionTimes) : null;
  const buckets = bucketsFor(range, now, firstSessionMs);
  const windowStart = buckets[0]?.start ?? 0;

  const inRange = sessions.filter((s) => Date.parse(s.start_at) >= windowStart);
  const rangeSends = sends(inRange).filter((c) => c.time >= windowStart);

  const bucketClimbs = buckets.map((b) =>
    inRange
      .filter((s) => Date.parse(s.start_at) >= b.start && Date.parse(s.start_at) < b.end)
      .reduce((a, s) => a + s.climb_count, 0)
  );
  const bucketSends = buckets.map((b) =>
    rangeSends.filter((c) => c.time >= b.start && c.time < b.end)
  );
  const bucketAvg = bucketSends.map((g) =>
    g.length === 0 ? 0 : g.reduce((a, c) => a + c.grade, 0) / g.length
  );
  const bucketHardest = bucketSends.map((g) =>
    g.length === 0 ? null : Math.max(...g.map((c) => c.grade))
  );
  const bucketFlash = bucketSends.map((g) => {
    if (g.length === 0) return null;
    return Math.round((g.filter((c) => c.flash).length / g.length) * 100);
  });

  const grades = rangeSends.map((s) => s.grade);
  const lo = grades.length > 0 ? Math.min(...grades) : 0;
  const hi = grades.length > 0 ? Math.max(...grades) : 0;
  const pyramid: Array<{ grade: number; count: number }> = [];
  for (let g = lo; g <= hi; g++) {
    pyramid.push({ grade: g, count: rangeSends.filter((s) => s.grade === g).length });
  }

  const totalSends = rangeSends.length;
  const totalClimbs = inRange.reduce((a, s) => a + s.climb_count, 0);
  const avgGrade = totalSends > 0 ? rangeSends.reduce((a, s) => a + s.grade, 0) / totalSends : 0;

  const axis = thinAxis(buckets);

  const volumeBars: TrendBarVM[] = normalize(bucketClimbs).map((h, i) => ({
    height: h,
    peak: false,
    valueLabel: bucketClimbs[i] === 0 ? "" : String(bucketClimbs[i]),
    axisLabel: axis(i),
  }));

  const pyramidMax = Math.max(1, ...pyramid.map((p) => p.count));
  const pyramidBars: TrendBarVM[] = pyramid.map((p) => ({
    height: p.count === 0 ? 0 : p.count / pyramidMax,
    peak: p.grade === hi && p.count > 0,
    valueLabel: String(p.count),
    axisLabel: `V${p.grade}`,
  }));

  const hardestVals = bucketHardest.map((g) => (g === null ? 0 : g));
  const hardestBars: TrendBarVM[] = bucketHardest.map((g, i) => {
    const prevMax = Math.max(0, ...hardestVals.slice(0, i));
    return {
      height: g === null ? 0 : hi > 0 ? g / hi : 0,
      peak: g !== null && g > prevMax && i > 0,
      valueLabel: g === null ? "-" : `V${g}`,
      axisLabel: axis(i),
    };
  });

  const flashBest = Math.max(0, ...bucketFlash.map((f) => f ?? 0));
  const flashBars: TrendBarVM[] = bucketFlash.map((f, i) => ({
    height: f === null || flashBest === 0 ? 0 : f / flashBest,
    peak: f !== null && f === flashBest && flashBest > 0,
    valueLabel: f === null ? "-" : `${f}%`,
    axisLabel: axis(i),
  }));

  const avgBars: TrendBarVM[] = normalize(bucketAvg).map((h, i) => ({
    height: h,
    peak: false,
    valueLabel: bucketAvg[i] === 0 ? "" : `V${bucketAvg[i]!.toFixed(1)}`,
    axisLabel: axis(i),
  }));

  const lastFlash = [...bucketFlash].reverse().find((f) => f !== null) ?? null;
  const biggestBucket = Math.max(0, ...bucketClimbs);
  const biggestBucketIdx = bucketClimbs.indexOf(biggestBucket);

  const tiles: TrendTileVM[] = [
    {
      metric: "volume",
      label: "VOLUME",
      value: `${totalClimbs} climbs`,
      caption: `${inRange.length} SESSIONS · ${rangeLabel}`,
      bars: volumeBars,
    },
    {
      metric: "pyramid",
      label: "GRADE PYRAMID",
      value: `${totalSends} sends`,
      caption: totalSends > 0 ? `${rangeLabel} · V${lo}-V${hi}` : rangeLabel,
      bars: pyramidBars,
    },
    {
      metric: "hardest",
      label: "HARDEST SEND",
      value: totalSends > 0 ? `V${hi}` : "-",
      caption: rangeLabel,
      bars: hardestBars,
    },
    {
      metric: "flash",
      label: "FLASH RATE",
      value: lastFlash === null ? "-" : `${lastFlash}%`,
      caption: `SENDS ON THE FIRST TRY · ${rangeLabel}`,
      bars: flashBars,
    },
    {
      metric: "avggrade",
      label: "AVG GRADE",
      value: totalSends > 0 ? `V${avgGrade.toFixed(1)}` : "-",
      caption: rangeLabel,
      bars: avgBars,
    },
  ];

  const details: Record<TrendMetric, TrendDetailVM> = {
    volume: {
      metric: "volume",
      title: "Volume",
      caption: `CLIMBS OVER TIME · ${rangeLabel}`,
      bars: volumeBars,
      specs: [
        { k: "SESSIONS", v: String(inRange.length) },
        { k: "CLIMBS", v: String(totalClimbs) },
        {
          k: "BIGGEST",
          v: biggestBucket > 0 ? `${biggestBucket} · ${buckets[biggestBucketIdx]!.label}` : "-",
        },
      ],
      insight:
        biggestBucket > 0
          ? `${totalClimbs} climbs across ${inRange.length} sessions, peaking at ${biggestBucket}.`
          : "Log a few sessions and the rhythm shows up here.",
    },
    pyramid: {
      metric: "pyramid",
      title: "Grade pyramid",
      caption: `SENDS BY GRADE · ${rangeLabel}`,
      bars: pyramidBars,
      specs: [
        {
          k: "BASE",
          v:
            totalSends > 0
              ? `V${pyramid.reduce((a, b) => (b.count > a.count ? b : a)).grade} · ${Math.max(
                  ...pyramid.map((p) => p.count)
                )} sends`
              : "-",
        },
        {
          k: "TOP",
          v:
            totalSends > 0
              ? `V${hi} · ${pyramid.find((p) => p.grade === hi)?.count ?? 0} sends`
              : "-",
        },
        { k: "TOTAL", v: `${totalSends} sends` },
      ],
      insight:
        totalSends > 0
          ? `A V${pyramid.reduce((a, b) => (b.count > a.count ? b : a)).grade} base carrying V${hi} on top.`
          : "Sends stack up here by grade.",
    },
    hardest: {
      metric: "hardest",
      title: "Hardest send",
      caption: `MAX GRADE OVER TIME · ${rangeLabel}`,
      bars: hardestBars,
      specs: [
        { k: "MAX", v: totalSends > 0 ? `V${hi}` : "-" },
        {
          k: "LATEST",
          v:
            bucketHardest[bucketHardest.length - 1] === null
              ? "-"
              : `V${bucketHardest[bucketHardest.length - 1]}`,
        },
        { k: "SENDS AT MAX", v: String(rangeSends.filter((s) => s.grade === hi).length) },
      ],
      insight:
        totalSends > 0
          ? `Top grade V${hi}, with ${rangeSends.filter((s) => s.grade === hi).length} send${
              rangeSends.filter((s) => s.grade === hi).length === 1 ? "" : "s"
            } there so far.`
          : "Your max grade charts here.",
    },
    flash: {
      metric: "flash",
      title: "Flash rate",
      caption: `FLASHES AS % OF SENDS · ${rangeLabel}`,
      bars: flashBars,
      specs: [
        {
          k: "FLASH CEILING",
          v: rangeSends.some((s) => s.flash)
            ? `V${Math.max(...rangeSends.filter((s) => s.flash).map((s) => s.grade))} - hardest flash`
            : "-",
        },
        { k: "BEST", v: flashBest > 0 ? `${flashBest}%` : "-" },
        {
          k: "TOTAL",
          v:
            totalSends > 0
              ? `${rangeSends.filter((s) => s.flash).length} of ${totalSends} flashed`
              : "-",
        },
      ],
      insight:
        totalSends > 0
          ? "Flash rate tracks how well you read a board before pulling on."
          : "First-try sends chart here.",
    },
    avggrade: {
      metric: "avggrade",
      title: "Avg grade",
      caption: `AVG SEND GRADE OVER TIME · ${rangeLabel}`,
      bars: avgBars,
      specs: [
        { k: "AVG", v: totalSends > 0 ? `V${avgGrade.toFixed(1)}` : "-" },
        {
          k: "LATEST",
          v:
            bucketAvg[bucketAvg.length - 1] === 0
              ? "-"
              : `V${bucketAvg[bucketAvg.length - 1]!.toFixed(1)}`,
        },
        { k: "SENDS COUNTED", v: String(totalSends) },
      ],
      insight:
        totalSends > 0
          ? "Average send grade drifts slowly - steady beats spiky."
          : "Average send grade lands here.",
    },
  };

  return {
    caption: rangeLabel,
    tiles,
    details,
  };
}
