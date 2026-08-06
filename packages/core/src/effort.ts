import type { Climb, Session } from "./session";

export type EffortConfig = {
  bidWeight: number;
  densityHigh: number;
  densityLow: number;
  windowMs: number;
  minHistory: number;
};

export type EffortResult = {
  rpe: number;
  title: string;
  summary: string;
};

const HOUR = 3_600_000;

export function defaultEffortConfig(): EffortConfig {
  return {
    bidWeight: 0.4,
    densityHigh: 12,
    densityLow: 5,
    windowMs: 8 * 7 * 24 * HOUR,
    minHistory: 3,
  };
}

export function points(vGrade: number): number {
  const grade = vGrade < 0 ? 1 : vGrade;
  return Math.pow(2, grade / 2);
}

export function sessionPoints(s: Session, cfg: EffortConfig): number {
  let pts = 0;
  for (const c of s.climbs) {
    const p = points(c.vGrade);
    pts += c.kind === "attempt" ? p * cfg.bidWeight : p;
  }
  return pts;
}

export function score(target: Session, history: Session[], cfg: EffortConfig): EffortResult {
  const pts = sessionPoints(target, cfg);

  let ref = history.filter(
    (h) =>
      h.end.getTime() < target.start.getTime() &&
      target.start.getTime() - h.end.getTime() <= cfg.windowMs
  );
  if (ref.length < cfg.minHistory) ref = history;

  let base = 6;
  if (ref.length > 0) {
    const med = median(ref.map((h) => sessionPoints(h, cfg)));
    if (med > 0) base = 6 * Math.sqrt(pts / med);
  }

  let nudge = 0;
  if (target.climbs.length > 1) {
    const first = target.climbs[0]!;
    const last = target.climbs[target.climbs.length - 1]!;
    const span = Math.max((last.time.getTime() - first.time.getTime()) / HOUR, 0.5);
    const density = target.climbs.length / span;
    if (density >= cfg.densityHigh) nudge++;
    else if (density <= cfg.densityLow) nudge--;
  }

  let rollingMax = 0;
  for (const h of ref) {
    for (const c of h.climbs) {
      if (c.kind === "send" && c.vGrade > rollingMax) rollingMax = c.vGrade;
    }
  }
  if (rollingMax > 0 && target.climbs.some((c) => c.vGrade > rollingMax)) nudge++;

  const rpe = Math.min(10, Math.max(1, Math.round(base + nudge)));

  return {
    rpe,
    title: title(rpe, target, volumeDriven(target, rollingMax)),
    summary: summary(rpe, target),
  };
}

function volumeDriven(s: Session, rollingMax: number): boolean {
  const { hi } = gradeRange(s);
  return rollingMax > 0 && hi >= 0 && hi <= rollingMax - 2;
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

function adjective(rpe: number): string {
  if (rpe <= 3) return "Easy climbing session";
  if (rpe <= 5) return "Casual climbing session";
  if (rpe <= 7) return "Solid climbing session";
  if (rpe <= 9) return "Hard climbing session";
  return "Max effort climbing session";
}

function gradeRange(s: Session): { lo: number; hi: number } {
  let lo = -1;
  let hi = -1;
  for (const c of s.climbs) {
    if (c.vGrade < 0) continue;
    if (lo === -1 || c.vGrade < lo) lo = c.vGrade;
    if (c.vGrade > hi) hi = c.vGrade;
  }
  return { lo, hi };
}

function title(rpe: number, s: Session, volume: boolean): string {
  let adj = adjective(rpe);
  if (volume && rpe >= 8) {
    adj = rpe === 10 ? "Max volume climbing session" : "High volume climbing session";
  }
  const { hi } = gradeRange(s);
  const climbs = plural(s.climbs.length, "climb");
  if (hi < 0) return `${adj} · ${climbs}`;
  return `${adj} · ${climbs}, top V${hi}`;
}

function plural(n: number, word: string): string {
  return n === 1 ? `${n} ${word}` : `${n} ${word}s`;
}

function summary(rpe: number, s: Session): string {
  let sends = 0;
  let attempts = 0;
  let gradeSum = 0;
  let graded = 0;
  for (const c of s.climbs) {
    if (c.kind === "send") sends++;
    else attempts++;
    if (c.vGrade >= 0) {
      gradeSum += c.vGrade;
      graded++;
    }
  }
  const { lo, hi } = gradeRange(s);
  const grades = lo >= 0 ? ` · V${lo}-V${hi} · avg V${(gradeSum / graded).toFixed(1)}` : "";

  const lines = [
    `RPE ${rpe}/10 · ${plural(sends, "send")}, ${plural(attempts, "attempt")}${grades}`,
    ...s.climbs.map(climbLine),
    "synced by boardsync",
  ];
  return lines.join("\n");
}

function climbLine(c: Climb): string {
  const mark = c.kind === "attempt" ? "✗" : "✓";
  const grade = c.vGrade >= 0 ? `V${c.vGrade}` : "V?";
  let line = `${mark} ${grade}`;
  if (c.name !== "") line += ` ${c.name}`;
  if (c.tries > 1) line += ` (${c.tries} tries)`;
  return line;
}
