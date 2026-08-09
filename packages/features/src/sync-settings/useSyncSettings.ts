import React from "react";
import type {
  ConnectionStatus,
  SendtallyApi,
  StravaPostingMode,
  SyncScheduleMode,
} from "@sendtally/api-client";
import { useQuery, type QueryState } from "../lib/useQuery";
import { syncSettingsVM } from "./transforms";
import type { SyncSettingsVM } from "./types";

export type SyncSettingsFeature = {
  state: QueryState<ConnectionStatus>;
  vm: SyncSettingsVM;
  ready: boolean;
  reload: () => void;
  syncingBoard: string | null;
  syncBoard: (board: string) => Promise<void>;
  postingBoard: string | null;
  setPosting: (board: string, mode: StravaPostingMode) => Promise<void>;
  scheduleBusy: boolean;
  setSchedule: (mode: SyncScheduleMode) => Promise<void>;
  message: string | null;
  messageBoard: string | null;
};

export function useSyncSettings(api: SendtallyApi): SyncSettingsFeature {
  const load = React.useCallback(() => api.status(), [api]);
  const { state, reload } = useQuery(load);
  const [syncingBoard, setSyncingBoard] = React.useState<string | null>(null);
  const [postingBoard, setPostingBoard] = React.useState<string | null>(null);
  const [scheduleBusy, setScheduleBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [messageBoard, setMessageBoard] = React.useState<string | null>(null);

  const syncBoard = React.useCallback(
    async (board: string): Promise<void> => {
      setSyncingBoard(board);
      setMessage(null);
      setMessageBoard(board);
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
      setMessageBoard(board);
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
      setMessageBoard(null);
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

  const status = state.status === "ready" ? state.data : null;
  const vm = React.useMemo(() => syncSettingsVM(status, syncingBoard), [status, syncingBoard]);

  return {
    state,
    vm,
    ready: state.status === "ready",
    reload,
    syncingBoard,
    syncBoard,
    postingBoard,
    setPosting,
    scheduleBusy,
    setSchedule,
    message,
    messageBoard,
  };
}
