import React from "react";
import type { ConnectionStatus, SendtallyApi } from "@sendtally/api-client";
import { useQuery, type QueryState } from "../lib/useQuery";
import { settingsVM } from "./transforms";
import type { SettingsVM } from "./types";

export type SettingsFeature = {
  state: QueryState<ConnectionStatus>;
  vm: SettingsVM;
  ready: boolean;
  reload: () => void;
};

export function useSettings(api: SendtallyApi): SettingsFeature {
  const load = React.useCallback(() => api.status(), [api]);
  const { state, reload } = useQuery(load);
  const status = state.status === "ready" ? state.data : null;
  const vm = React.useMemo(() => settingsVM(status), [status]);
  return { state, vm, ready: state.status === "ready", reload };
}
