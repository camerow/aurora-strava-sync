import React from "react";
import type {
  ConnectionStatus,
  SendtallyApi,
  StravaPostingMode,
  SyncScheduleMode,
} from "@sendtally/api-client";
import { useQuery, type QueryState } from "../lib/useQuery";

export type SyncSettingsFeature = {
  state: QueryState<ConnectionStatus>;
  reload: () => void;
  syncingBoard: string | null;
  syncBoard: (board: string) => Promise<void>;
  postingBoard: string | null;
  setPosting: (board: string, mode: StravaPostingMode) => Promise<void>;
  scheduleBusy: boolean;
  setSchedule: (mode: SyncScheduleMode) => Promise<void>;
  message: string | null;
};

export function useSyncSettings(api: SendtallyApi): SyncSettingsFeature {
  const load = React.useCallback(() => api.status(), [api]);
  const { state, reload } = useQuery(load);
  const [syncingBoard, setSyncingBoard] = React.useState<string | null>(null);
  const [postingBoard, setPostingBoard] = React.useState<string | null>(null);
  const [scheduleBusy, setScheduleBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const syncBoard = React.useCallback(
    async (board: string): Promise<void> => {
      setSyncingBoard(board);
      setMessage(null);
      try {
        await api.syncNow(board);
        setMessage("Sync queued - new sessions land in about a minute.");
      } catch {
        setMessage("Could not queue a sync. Try again.");
      }
      setTimeout(() => {
        setSyncingBoard(null);
        reload();
      }, 6000);
    },
    [api, reload]
  );

  const setPosting = React.useCallback(
    async (board: string, mode: StravaPostingMode): Promise<void> => {
      setPostingBoard(board);
      setMessage(null);
      try {
        await api.setStravaPosting(board, mode);
        reload();
      } catch {
        setMessage("Could not update Strava posting.");
      }
      setPostingBoard(null);
    },
    [api, reload]
  );

  const setSchedule = React.useCallback(
    async (mode: SyncScheduleMode): Promise<void> => {
      setScheduleBusy(true);
      setMessage(null);
      try {
        await api.setSyncSchedule(mode);
        reload();
      } catch {
        setMessage("Could not update the sync schedule.");
      }
      setScheduleBusy(false);
    },
    [api, reload]
  );

  return {
    state,
    reload,
    syncingBoard,
    syncBoard,
    postingBoard,
    setPosting,
    scheduleBusy,
    setSchedule,
    message,
  };
}
