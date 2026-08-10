import type { ConnectionStatus } from "@sendtally/api-client";
import { BOARD_LABELS } from "../session-detail/types";
import type { BoardCardVM, SyncSettingsVM } from "./types";

export function boardLabelOf(board: string): string {
  return BOARD_LABELS[board] ?? "Board";
}

const CATALOGUE_PENDING_ERROR = "waiting for board catalogue";

function lastSyncLabelOf(
  sync: { lastSyncedAt: string | null; lastError: string | null } | null
): string {
  if (sync === null || sync.lastSyncedAt === null) return "FIRST IMPORT PENDING";
  if (sync.lastError === CATALOGUE_PENDING_ERROR) return "CATALOGUE SYNCING";
  const stamp = new Date(sync.lastSyncedAt).toLocaleString("en-US", {
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
    lastSyncLabel: lastSyncLabelOf(status?.sync ?? null),
  };
}
