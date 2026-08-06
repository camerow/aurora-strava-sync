import type { SessionWithClimbs } from "@sendtally/api-client";
import type { TrendBarVM, TrendDetailVM, TrendMetric, TrendTileVM, TrendsVM } from "./types";

const WEEK_MS = 7 * 24 * 3_600_000;
const WEEKS = 12;
const MONTHS = 6;

type Sent = { grade: number; flash: boolean; time: number };

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

function monthKeysBack(now: Date, months: number): string[] {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1))
    .toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
}

function monthKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function trendsVM(sessions: SessionWithClimbs[], now: Date = new Date()): TrendsVM {
  const allSends = sends(sessions);
  const weekStarts: number[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    weekStarts.push(now.getTime() - (i + 1) * WEEK_MS);
  }

  const weeklyClimbs = weekStarts.map((ws) =>
    sessions
      .filter((s) => Date.parse(s.start_at) >= ws && Date.parse(s.start_at) < ws + WEEK_MS)
      .reduce((a, s) => a + s.climb_count, 0)
  );
  const weeklyAvg = weekStarts.map((ws) => {
    const g = allSends.filter((c) => c.time >= ws && c.time < ws + WEEK_MS);
    return g.length === 0 ? 0 : g.reduce((a, c) => a + c.grade, 0) / g.length;
  });

  const grades = allSends.map((s) => s.grade);
  const lo = grades.length > 0 ? Math.min(...grades) : 0;
  const hi = grades.length > 0 ? Math.max(...grades) : 0;
  const pyramid: Array<{ grade: number; count: number }> = [];
  for (let g = lo; g <= hi; g++) {
    pyramid.push({ grade: g, count: allSends.filter((s) => s.grade === g).length });
  }

  const months = monthKeysBack(now, MONTHS);
  const hardestByMonth = months.map((key) => {
    const inMonth = allSends.filter((s) => monthKeyOf(s.time) === key);
    return inMonth.length === 0 ? null : Math.max(...inMonth.map((s) => s.grade));
  });
  const flashByMonth = months.map((key) => {
    const inMonth = allSends.filter((s) => monthKeyOf(s.time) === key);
    if (inMonth.length === 0) return null;
    return Math.round((inMonth.filter((s) => s.flash).length / inMonth.length) * 100);
  });

  const totalSends = allSends.length;
  const totalClimbs = sessions.reduce((a, s) => a + s.climb_count, 0);
  const allTimeAvg = totalSends > 0 ? allSends.reduce((a, s) => a + s.grade, 0) / totalSends : 0;
  const recent = sessions.filter(
    (s) => Date.parse(s.start_at) >= now.getTime() - 30 * 24 * 3_600_000
  );
  const recentClimbs = recent.reduce((a, s) => a + s.climb_count, 0);

  const weekAxis = (i: number): string =>
    i % 3 === 0 || i === WEEKS - 1 ? weekLabel(weekStarts[i]!) : "";

  const volumeBars: TrendBarVM[] = normalize(weeklyClimbs).map((h, i) => ({
    height: h,
    peak: false,
    valueLabel: weeklyClimbs[i] === 0 ? "" : String(weeklyClimbs[i]),
    axisLabel: weekAxis(i),
  }));

  const pyramidMax = Math.max(1, ...pyramid.map((p) => p.count));
  const pyramidBars: TrendBarVM[] = pyramid.map((p) => ({
    height: p.count === 0 ? 0 : p.count / pyramidMax,
    peak: p.grade === hi && p.count > 0,
    valueLabel: String(p.count),
    axisLabel: `V${p.grade}`,
  }));

  const hardestVals = hardestByMonth.map((g) => (g === null ? 0 : g));
  const hardestBars: TrendBarVM[] = hardestByMonth.map((g, i) => {
    const prevMax = Math.max(0, ...hardestVals.slice(0, i));
    return {
      height: g === null ? 0 : hi > 0 ? g / hi : 0,
      peak: g !== null && g > prevMax && i > 0,
      valueLabel: g === null ? "-" : `V${g}`,
      axisLabel: monthLabel(months[i]!),
    };
  });

  const flashBest = Math.max(0, ...flashByMonth.map((f) => f ?? 0));
  const flashBars: TrendBarVM[] = flashByMonth.map((f, i) => ({
    height: f === null || flashBest === 0 ? 0 : f / flashBest,
    peak: f !== null && f === flashBest && flashBest > 0,
    valueLabel: f === null ? "-" : `${f}%`,
    axisLabel: monthLabel(months[i]!),
  }));

  const avgBars: TrendBarVM[] = normalize(weeklyAvg).map((h, i) => ({
    height: h,
    peak: false,
    valueLabel: weeklyAvg[i] === 0 ? "" : `V${weeklyAvg[i]!.toFixed(1)}`,
    axisLabel: weekAxis(i),
  }));

  const lastFlash = [...flashByMonth].reverse().find((f) => f !== null) ?? null;
  const biggestWeek = Math.max(0, ...weeklyClimbs);
  const biggestWeekIdx = weeklyClimbs.indexOf(biggestWeek);

  const tiles: TrendTileVM[] = [
    {
      metric: "volume",
      label: "VOLUME",
      value: `${recentClimbs} climbs`,
      caption: `${recent.length} SESSIONS · LAST 30 DAYS`,
      bars: volumeBars,
    },
    {
      metric: "pyramid",
      label: "GRADE PYRAMID",
      value: `${totalSends} sends`,
      caption: totalSends > 0 ? `ALL-TIME · V${lo}-V${hi}` : "ALL-TIME",
      bars: pyramidBars,
    },
    {
      metric: "hardest",
      label: "HARDEST SEND",
      value: totalSends > 0 ? `V${hi}` : "-",
      caption: `LAST ${MONTHS} MONTHS`,
      bars: hardestBars,
    },
    {
      metric: "flash",
      label: "FLASH RATE",
      value: lastFlash === null ? "-" : `${lastFlash}%`,
      caption: "SENDS ON THE FIRST TRY · BY MONTH",
      bars: flashBars,
    },
    {
      metric: "avggrade",
      label: "AVG GRADE",
      value: totalSends > 0 ? `V${allTimeAvg.toFixed(1)}` : "-",
      caption: "ALL-TIME · ACROSS ALL SENDS",
      bars: avgBars,
    },
  ];

  const details: Record<TrendMetric, TrendDetailVM> = {
    volume: {
      metric: "volume",
      title: "Volume",
      caption: `CLIMBS PER WEEK · ${WEEKS} WEEKS`,
      bars: volumeBars,
      specs: [
        { k: "SESSIONS", v: `${sessions.length} all-time` },
        { k: "CLIMBS", v: String(totalClimbs) },
        {
          k: "BIGGEST WEEK",
          v:
            biggestWeek > 0
              ? `${biggestWeek} · w/c ${weekLabel(weekStarts[biggestWeekIdx]!)}`
              : "-",
        },
      ],
      insight:
        biggestWeek > 0
          ? `${totalClimbs} climbs across ${sessions.length} sessions, peaking at ${biggestWeek} in a week.`
          : "Log a few sessions and the weekly rhythm shows up here.",
    },
    pyramid: {
      metric: "pyramid",
      title: "Grade pyramid",
      caption: "ALL-TIME SENDS BY GRADE",
      bars: pyramidBars,
      specs: [
        {
          k: "BASE",
          v:
            pyramid.length > 0
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
        { k: "ALL-TIME", v: `${totalSends} sends` },
      ],
      insight:
        totalSends > 0
          ? `A V${pyramid.reduce((a, b) => (b.count > a.count ? b : a)).grade} base carrying V${hi} on top.`
          : "Sends stack up here by grade.",
    },
    hardest: {
      metric: "hardest",
      title: "Hardest send",
      caption: `MAX GRADE PER MONTH · LAST ${MONTHS}`,
      bars: hardestBars,
      specs: [
        { k: "CURRENT MAX", v: totalSends > 0 ? `V${hi}` : "-" },
        {
          k: "THIS MONTH",
          v:
            hardestByMonth[hardestByMonth.length - 1] === null
              ? "-"
              : `V${hardestByMonth[hardestByMonth.length - 1]}`,
        },
        { k: "SENDS AT MAX", v: String(allSends.filter((s) => s.grade === hi).length) },
      ],
      insight:
        totalSends > 0
          ? `Top grade V${hi}, with ${allSends.filter((s) => s.grade === hi).length} send${
              allSends.filter((s) => s.grade === hi).length === 1 ? "" : "s"
            } there so far.`
          : "Your monthly max grade charts here.",
    },
    flash: {
      metric: "flash",
      title: "Flash rate",
      caption: "FLASHES AS % OF SENDS · BY MONTH",
      bars: flashBars,
      specs: [
        {
          k: "FLASH CEILING",
          v: allSends.some((s) => s.flash)
            ? `V${Math.max(...allSends.filter((s) => s.flash).map((s) => s.grade))} - hardest flash`
            : "-",
        },
        { k: "BEST MONTH", v: flashBest > 0 ? `${flashBest}%` : "-" },
        {
          k: "ALL-TIME",
          v:
            totalSends > 0
              ? `${allSends.filter((s) => s.flash).length} of ${totalSends} flashed`
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
      caption: `AVG SEND GRADE PER WEEK · ${WEEKS} WEEKS`,
      bars: avgBars,
      specs: [
        { k: "ALL-TIME AVG", v: totalSends > 0 ? `V${allTimeAvg.toFixed(1)}` : "-" },
        {
          k: "CURRENT WEEK",
          v:
            weeklyAvg[weeklyAvg.length - 1] === 0
              ? "-"
              : `V${weeklyAvg[weeklyAvg.length - 1]!.toFixed(1)}`,
        },
        { k: "SENDS COUNTED", v: String(totalSends) },
      ],
      insight:
        totalSends > 0
          ? "Average send grade drifts slowly - steady beats spiky."
          : "Average send grade per week lands here.",
    },
  };

  return {
    caption: `LAST ${WEEKS} WEEKS`,
    tiles,
    details,
  };
}
