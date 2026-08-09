import type { ConnectionStatus } from "@sendtally/api-client";
import { BOARD_LABELS } from "../session-detail/types";
import type { BoardCardVM, SyncSettingsVM } from "./types";

export function boardLabelOf(board: string): string {
  return BOARD_LABELS[board] ?? "Board";
}

function lastSyncLabelOf(lastSyncedAt: string | null): string {
  if (lastSyncedAt === null) return "FIRST IMPORT PENDING";
  const stamp = new Date(lastSyncedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `LAST SYNC ${stamp.toUpperCase()}`;
}

export function syncSettingsVM(
  status: ConnectionStatus | null,
  syncingBoard: string | null
): SyncSettingsVM {
  const rows = status?.boards ?? [];
  const strava = status?.strava ?? null;
  const stravaActive = strava?.status === "active";
  const boards: BoardCardVM[] = rows.map((b) => ({
    board: b.board,
    label: boardLabelOf(b.board),
    statusLabel: `AURORA TOKEN · ${b.status.toUpperCase()}`,
    isActive: b.status === "active",
    postingEnabled: b.postingEnabled,
    postingLabel: b.postingEnabled ? "POSTING ON" : "POSTING OFF",
    syncing: syncingBoard === b.board,
    syncDisabled: syncingBoard !== null,
  }));
  const anyPostingOn = stravaActive && rows.some((b) => b.postingEnabled);
  return {
    boards,
    hasBoards: boards.length > 0,
    stravaConnected: strava !== null,
    stravaActive,
    stravaStatusLabel:
      strava === null
        ? "NOT CONNECTED"
        : `ATHLETE ${strava.athleteId} · ${strava.status.toUpperCase()}`,
    headerBadge: anyPostingOn
      ? "STRAVA + BOARD"
      : boards.length > 0
        ? "BOARD ONLY"
        : "NOT CONNECTED",
    autoSync: status?.autoSync === true,
    lastSyncLabel: lastSyncLabelOf(status?.sync?.lastSyncedAt ?? null),
  };
}
