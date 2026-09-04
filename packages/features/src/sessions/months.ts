import type { SessionRow } from "@sendtally/api-client";

export type SessionMonth = {
  key: string;
  year: number;
  month: number;
  label: string;
  sessions: SessionRow[];
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_SHORT_NAMES = MONTH_NAMES.map((m) => m.slice(0, 3).toUpperCase());

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function sessionMonths(sessions: SessionRow[]): SessionMonth[] {
  const byKey = new Map<string, SessionMonth>();
  for (const session of sessions) {
    const start = new Date(session.start_at);
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + 1;
    const key = monthKey(year, month);
    const existing = byKey.get(key);
    if (existing) existing.sessions.push(session);
    else byKey.set(key, { key, year, month, label: monthLabel(year, month), sessions: [session] });
  }
  return [...byKey.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function resolveSessionMonth(
  months: SessionMonth[],
  key: string | null
): SessionMonth | null {
  if (months.length === 0) return null;
  return months.find((m) => m.key === key) ?? months[0] ?? null;
}

export function adjacentSessionMonths(
  months: SessionMonth[],
  key: string
): { newer: SessionMonth | null; older: SessionMonth | null } {
  const index = months.findIndex((m) => m.key === key);
  if (index < 0) return { newer: null, older: null };
  return { newer: months[index - 1] ?? null, older: months[index + 1] ?? null };
}

export function sessionYears(months: SessionMonth[]): number[] {
  return [...new Set(months.map((m) => m.year))].sort((a, b) => b - a);
}

export function monthsOfYear(months: SessionMonth[], year: number): Array<SessionMonth | null> {
  return MONTH_NAMES.map(
    (_, i) => months.find((m) => m.year === year && m.month === i + 1) ?? null
  );
}
