import type { SessionRow } from "@sendtally/api-client";

export type SessionGradeLabel = { kind: "sent" | "tried"; label: string };

export function sessionGradeLabels(session: SessionRow): SessionGradeLabel[] {
  const out: SessionGradeLabel[] = [];
  if (session.top_send_grade >= 0) {
    out.push({ kind: "sent", label: `SENT V${session.top_send_grade}` });
  }
  if (session.top_grade >= 0 && session.top_grade > session.top_send_grade) {
    out.push({ kind: "tried", label: `TRIED V${session.top_grade}` });
  }
  return out;
}
