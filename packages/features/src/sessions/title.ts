import type { SessionRow } from "@sendtally/api-client";
import { BOARD_LABELS } from "../session-detail/types";

export function sessionTitle(session: Pick<SessionRow, "name" | "source" | "board">): string {
  if (session.name !== null && session.name !== "") return session.name;
  if (session.source === "manual") return "Logged session";
  return BOARD_LABELS[session.board ?? ""] ?? "Board session";
}
