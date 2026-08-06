import React from "react";
import type { ConnectionStatus, SendtallyApi, StravaPostingMode } from "@sendtally/api-client";
import { useQuery, type QueryState } from "../lib/useQuery";

export type SyncSettingsFeature = {
  state: QueryState<ConnectionStatus>;
  reload: () => void;
  syncRequested: boolean;
  syncSessions: () => Promise<void>;
  postingBusy: boolean;
  setPosting: (mode: StravaPostingMode) => Promise<void>;
  message: string | null;
};

export function useSyncSettings(api: SendtallyApi): SyncSettingsFeature {
  const load = React.useCallback(() => api.status(), [api]);
  const { state, reload } = useQuery(load);
  const [syncRequested, setSyncRequested] = React.useState(false);
  const [postingBusy, setPostingBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const syncSessions = React.useCallback(async (): Promise<void> => {
    setSyncRequested(true);
    setMessage(null);
    try {
      await api.syncNow();
      setMessage("Sync queued - new sessions land in about a minute.");
    } catch {
      setMessage("Could not queue a sync. Try again.");
    }
    setTimeout(() => {
      setSyncRequested(false);
      reload();
    }, 6000);
  }, [api, reload]);

  const setPosting = React.useCallback(
    async (mode: StravaPostingMode): Promise<void> => {
      setPostingBusy(true);
      setMessage(null);
      try {
        await api.setStravaPosting(mode);
        reload();
      } catch {
        setMessage("Could not update Strava posting.");
      }
      setPostingBusy(false);
    },
    [api, reload]
  );

  return { state, reload, syncRequested, syncSessions, postingBusy, setPosting, message };
}
