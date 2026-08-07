import type { SessionClimb, SessionDetail } from "@sendtally/api-client";
import type {
  ClimbFilter,
  ClimbResult,
  ClimbSort,
  ClimbVM,
  GradeBarVM,
  SessionDetailVM,
  StatVM,
} from "./types";
import { BOARD_LABELS } from "./types";

export function durationLabel(startAt: string, endAt: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function gradeLabel(vGrade: number): string {
  return vGrade >= 0 ? `V${vGrade}` : "V?";
}

function resultOf(c: SessionClimb): ClimbResult {
  if (c.kind === "attempt") return "project";
  return c.tries <= 1 ? "flash" : "sent";
}

function restLabel(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "-";
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function topSendGrade(climbs: SessionClimb[]): number {
  let hi = -1;
  for (const c of climbs) {
    if (c.kind === "send" && c.vGrade > hi) hi = c.vGrade;
  }
  return hi;
}

export function climbVMs(climbs: SessionClimb[]): ClimbVM[] {
  const ordered = [...climbs].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const top = topSendGrade(ordered);
  return ordered.map((c, i) => {
    const prev = ordered[i - 1];
    const rest =
      prev === undefined ? null : Math.round((Date.parse(c.time) - Date.parse(prev.time)) / 60_000);
    return {
      n: i + 1,
      name: c.name !== "" ? c.name : "Unknown climb",
      gradeLabel: gradeLabel(c.vGrade),
      grade: c.vGrade,
      isTopSend: c.kind === "send" && c.vGrade >= 0 && c.vGrade === top,
      angleLabel: c.angle !== null ? `${c.angle}°` : "-",
      burns: c.tries,
      restLabel: restLabel(rest),
      result: resultOf(c),
    };
  });
}

const FILTERS: Record<ClimbFilter, (c: ClimbVM) => boolean> = {
  all: () => true,
  sent: (c) => c.result === "flash" || c.result === "sent",
  flash: (c) => c.result === "flash",
  project: (c) => c.result === "project",
};

const SORTS: Record<ClimbSort, (a: ClimbVM, b: ClimbVM) => number> = {
  order: (a, b) => a.n - b.n,
  gradeDesc: (a, b) => b.grade - a.grade || a.n - b.n,
  gradeAsc: (a, b) => a.grade - b.grade || a.n - b.n,
  burns: (a, b) => b.burns - a.burns || a.n - b.n,
};

export function filterAndSortClimbs(
  climbs: ClimbVM[],
  filter: ClimbFilter,
  sort: ClimbSort
): ClimbVM[] {
  return climbs.filter(FILTERS[filter]).sort(SORTS[sort]);
}

export function sessionDetailVM(session: SessionDetail, board: string | null): SessionDetailVM {
  const climbs = climbVMs(session.climbs);
  const start = new Date(session.start_at);
  const sends = climbs.filter((c) => c.result !== "project");
  const flashes = climbs.filter((c) => c.result === "flash");
  const graded = session.climbs.filter((c) => c.vGrade >= 0);
  const avg = graded.length > 0 ? graded.reduce((a, c) => a + c.vGrade, 0) / graded.length : null;
  const top = topSendGrade(session.climbs);

  const boardLabel = BOARD_LABELS[board ?? ""] ?? "Board";
  const dateLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const weekday = start
    .toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
    .toUpperCase();
  const time = start
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .toUpperCase();

  const stats: StatVM[] = [
    { label: "TIME", value: durationLabel(session.start_at, session.end_at), accent: false },
    { label: "CLIMBS", value: String(climbs.length), accent: false },
    { label: "SENDS", value: String(sends.length), accent: false },
    { label: "AVG GRADE", value: avg === null ? "-" : `V${avg.toFixed(1)}`, accent: false },
    { label: "FLASHES", value: String(flashes.length), accent: false },
    { label: "RPE", value: `${session.rpe}/10`, accent: false },
    { label: "TOP", value: gradeLabel(top >= 0 ? top : session.top_grade), accent: true },
  ];

  const grades = session.climbs.filter((c) => c.vGrade >= 0).map((c) => c.vGrade);
  const lo = grades.length > 0 ? Math.min(...grades) : 0;
  const hi = grades.length > 0 ? Math.max(...grades) : 0;
  const bars: GradeBarVM[] = [];
  if (grades.length > 0) {
    const counts = new Map<number, number>();
    for (const c of session.climbs) {
      if (c.kind === "send" && c.vGrade >= 0) counts.set(c.vGrade, (counts.get(c.vGrade) ?? 0) + 1);
    }
    const max = Math.max(1, ...counts.values());
    for (let g = lo; g <= hi; g++) {
      const count = counts.get(g) ?? 0;
      bars.push({
        gradeLabel: `V${g}`,
        count,
        height: count === 0 ? 0 : count / max,
        peak: g === top && count > 0,
      });
    }
  }

  const filterCounts: SessionDetailVM["filterCounts"] = {
    all: climbs.length,
    sent: climbs.filter(FILTERS.sent).length,
    flash: climbs.filter(FILTERS.flash).length,
    project: climbs.filter(FILTERS.project).length,
  };

  return {
    title: `${boardLabel} - ${dateLabel}`,
    meta: `${weekday} ${dateLabel.toUpperCase()} · ${time} · ${durationLabel(session.start_at, session.end_at)} · RPE ${session.rpe}/10`,
    stats,
    bars,
    filterCounts,
    syncLine:
      session.strava_activity_id !== null
        ? `SYNCED TO STRAVA · ${dateLabel.toUpperCase()}`
        : "NOT POSTED TO STRAVA",
    stravaUrl:
      session.strava_activity_id !== null
        ? `https://www.strava.com/activities/${session.strava_activity_id}`
        : null,
  };
}
