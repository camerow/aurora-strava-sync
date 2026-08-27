import { FONT_GRADES, fontFromV, vFromFont } from "@sendtally/core";
import type { LogClimbInput, LogSessionInput } from "@sendtally/api-client";
import type { ClimbDraft, GradeScale, LogSessionDraft } from "./types";

export const V_GRADE_OPTIONS: readonly string[] = Array.from({ length: 18 }, (_, i) => `V${i}`);

export const FONT_GRADE_OPTIONS: readonly string[] = FONT_GRADES.filter(
  (g) => !["1", "2", "3"].includes(g)
);

export function gradeOptions(scale: GradeScale): readonly string[] {
  return scale === "v" ? V_GRADE_OPTIONS : FONT_GRADE_OPTIONS;
}

export function vGradeOf(grade: string, scale: GradeScale): number | undefined {
  if (scale === "font") return vFromFont(grade);
  const n = Number(grade.replace(/^V/i, ""));
  return Number.isInteger(n) && n >= 0 && n <= 17 ? n : undefined;
}

export function convertGrade(grade: string, from: GradeScale, to: GradeScale): string {
  if (from === to) return grade;
  const v = vGradeOf(grade, from);
  if (v === undefined) return grade;
  return to === "v" ? `V${v}` : (fontFromV(v) ?? grade);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function emptyDraft(now: Date): LogSessionDraft {
  const roundedNow = new Date(Math.floor(now.getTime() / (5 * 60_000)) * 5 * 60_000);
  const start = new Date(roundedNow.getTime() - 90 * 60_000);
  return {
    name: "",
    date: `${roundedNow.getFullYear()}-${pad(roundedNow.getMonth() + 1)}-${pad(roundedNow.getDate())}`,
    startTime: hhmm(start),
    endTime: hhmm(roundedNow),
    location: "indoor",
    scale: "v",
    rpe: null,
    climbs: [newClimb("climb-1", "v")],
  };
}

export function newClimb(key: string, scale: GradeScale): ClimbDraft {
  return { key, grade: scale === "v" ? "V3" : "6A", name: "", kind: "send", tries: 1 };
}

export function withScale(draft: LogSessionDraft, scale: GradeScale): LogSessionDraft {
  return {
    ...draft,
    scale,
    climbs: draft.climbs.map((c) => ({ ...c, grade: convertGrade(c.grade, draft.scale, scale) })),
  };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutesOf(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

export function durationMinutes(startTime: string, endTime: string): number | undefined {
  if (!TIME.test(startTime) || !TIME.test(endTime)) return undefined;
  const diff = minutesOf(endTime) - minutesOf(startTime);
  return diff > 0 ? diff : diff + 24 * 60;
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}M`;
  return m === 0 ? `${h}H` : `${h}H ${pad(m)}M`;
}

export function draftSummary(draft: LogSessionDraft): string {
  const sends = draft.climbs.filter((c) => c.kind === "send").length;
  const attempts = draft.climbs.length - sends;
  const grades = draft.climbs
    .map((c) => vGradeOf(c.grade, draft.scale))
    .filter((v): v is number => v !== undefined);
  const top = grades.length === 0 ? undefined : Math.max(...grades);
  const parts = [
    `${draft.climbs.length} ${draft.climbs.length === 1 ? "CLIMB" : "CLIMBS"}`,
    `${sends} ${sends === 1 ? "SEND" : "SENDS"}, ${attempts} ${attempts === 1 ? "ATTEMPT" : "ATTEMPTS"}`,
  ];
  if (top !== undefined) {
    parts.push(`TOP ${draft.scale === "v" ? `V${top}` : (fontFromV(top) ?? `V${top}`)}`);
  }
  const minutes = durationMinutes(draft.startTime, draft.endTime);
  if (minutes !== undefined) parts.push(durationLabel(minutes));
  return parts.join(" · ");
}

export function draftProblem(draft: LogSessionDraft): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return "Pick a date.";
  if (!TIME.test(draft.startTime) || !TIME.test(draft.endTime)) {
    return "Set a start and end time.";
  }
  const minutes = durationMinutes(draft.startTime, draft.endTime);
  if (minutes === undefined || minutes > 720) {
    return "Sessions longer than 12 hours can't be logged.";
  }
  if (draft.climbs.length === 0) return "Add at least one climb.";
  if (draft.climbs.some((c) => vGradeOf(c.grade, draft.scale) === undefined)) {
    return "Every climb needs a grade.";
  }
  return null;
}

export function toLogSessionInput(draft: LogSessionDraft): LogSessionInput {
  const climbs: LogClimbInput[] = draft.climbs.map((c) => ({
    ...(c.name.trim() === "" ? {} : { name: c.name.trim() }),
    grade:
      draft.scale === "v"
        ? { scale: "v", value: vGradeOf(c.grade, "v") ?? 0 }
        : { scale: "font", value: c.grade },
    kind: c.kind,
    tries: c.tries,
  }));
  return {
    ...(draft.name.trim() === "" ? {} : { name: draft.name.trim() }),
    date: draft.date,
    startTime: draft.startTime,
    endTime: draft.endTime,
    ...(draft.rpe === null ? {} : { rpe: draft.rpe }),
    location: draft.location,
    climbs,
  };
}
