import { defaultEffortConfig, score, vFromFont, type Climb, type Session } from "@sendtally/core";
import { z } from "zod";
import type { ManualSessionInput, SessionRow } from "./repo";

const gradeSchema = z.union([
  z.object({ scale: z.literal("v"), value: z.number().int().min(0).max(17) }),
  z.object({
    scale: z.literal("font"),
    value: z.string().refine((g) => vFromFont(g) !== undefined, "unknown Font grade"),
  }),
]);

const climbSchema = z.object({
  name: z.string().max(200).default(""),
  grade: gradeSchema,
  kind: z.enum(["send", "attempt"]).default("send"),
  tries: z.number().int().min(1).max(99).default(1),
});

const manualSessionShape = z.object({
  name: z.string().min(1).max(120).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => {
      const t = Date.parse(`${d}T00:00:00Z`);
      return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
    }, "invalid date"),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  rpe: z.number().int().min(1).max(10).optional(),
  location: z.enum(["indoor", "outdoor"]),
  climbs: z.array(climbSchema).min(1).max(300),
});

export const manualSessionBody = manualSessionShape.superRefine((body, ctx) => {
  if (sessionMinutes(body) > 720) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endTime"], message: "session too long" });
  }
});

export type ManualSessionBody = z.infer<typeof manualSessionShape>;

const DEFAULT_START = "12:00";
const DEFAULT_DURATION_MINUTES = 90;

function minutesOf(hhmm: string): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

function sessionMinutes(body: {
  startTime?: string | undefined;
  endTime?: string | undefined;
}): number {
  if (body.endTime === undefined) return DEFAULT_DURATION_MINUTES;
  const diff = minutesOf(body.endTime) - minutesOf(body.startTime ?? DEFAULT_START);
  return diff > 0 ? diff : diff + 24 * 60;
}

type ManualGrade = z.infer<typeof gradeSchema>;

function toVGrade(grade: ManualGrade): number {
  return grade.scale === "v" ? grade.value : (vFromFont(grade.value) ?? -1);
}

function toSession(body: ManualSessionBody): Session {
  const start = new Date(`${body.date}T${body.startTime ?? DEFAULT_START}:00Z`);
  const durationMs = sessionMinutes(body) * 60_000;
  const end = new Date(start.getTime() + durationMs);
  const step = durationMs / Math.max(body.climbs.length - 1, 1);
  const climbs: Climb[] = body.climbs.map((c, i) => ({
    time: new Date(start.getTime() + Math.round(step * i)),
    vGrade: toVGrade(c.grade),
    name: c.name,
    kind: c.kind,
    tries: c.tries,
  }));
  return { start, end, climbs, inProgress: false };
}

export function historySession(row: SessionRow & { climbs_json?: string | null }): Session | null {
  if (row.climbs_json == null) return null;
  const raw = JSON.parse(row.climbs_json) as Array<{
    time: string;
    name: string;
    vGrade: number;
    kind: "send" | "attempt";
    tries: number;
  }>;
  return {
    start: new Date(row.start_at),
    end: new Date(row.end_at),
    climbs: raw.map((c) => ({
      time: new Date(c.time),
      vGrade: c.vGrade,
      name: c.name,
      kind: c.kind,
      tries: c.tries,
    })),
    inProgress: false,
  };
}

export function buildManualSession(
  fingerprint: string,
  body: ManualSessionBody,
  history: Session[]
): ManualSessionInput {
  const session = toSession(body);
  const result = score(session, history, defaultEffortConfig(), body.rpe);
  const topGrade = session.climbs.reduce((hi, c) => (c.vGrade > hi ? c.vGrade : hi), -1);
  return {
    fingerprint,
    location: body.location,
    name: body.name ?? null,
    start_at: session.start.toISOString(),
    end_at: session.end.toISOString(),
    climb_count: session.climbs.length,
    top_grade: topGrade,
    rpe: result.rpe,
    title: body.name ?? result.title,
    summary: result.summary,
    climbs_json: JSON.stringify(
      session.climbs.map((c, i) => ({
        time: c.time.toISOString(),
        name: c.name,
        vGrade: c.vGrade,
        kind: c.kind,
        tries: c.tries,
        angle: null,
        grade: body.climbs[i]!.grade,
      }))
    ),
  };
}
