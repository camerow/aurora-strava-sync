import type { ConnectionStatus } from "@sendtally/api-client";
import type { SettingsVM } from "./types";

export function settingsVM(status: ConnectionStatus | null): SettingsVM {
  const strava = status?.strava ?? null;
  const stravaActive = strava?.status === "active";
  return {
    stravaConnected: strava !== null,
    stravaActive,
    stravaStatusLabel:
      strava === null
        ? "NOT CONNECTED"
        : `ATHLETE ${strava.athleteId} · ${strava.status.toUpperCase()}`,
    headerBadge: stravaActive ? "STRAVA CONNECTED" : "STRAVA NOT CONNECTED",
  };
}

export const DELETE_CONFIRMATION_WORD = "DELETE";

export function deleteConfirmationMatches(input: string): boolean {
  return input.trim().toUpperCase() === DELETE_CONFIRMATION_WORD;
}
