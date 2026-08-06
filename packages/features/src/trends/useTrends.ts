import React from "react";
import type { SendtallyApi, SessionWithClimbs } from "@sendtally/api-client";
import { useQuery, type QueryState } from "../lib/useQuery";
import { trendsVM } from "./transforms";
import type { TrendsVM } from "./types";

export type TrendsFeature = {
  state: QueryState<TrendsVM>;
  reload: () => void;
};

export function useTrends(api: SendtallyApi): TrendsFeature {
  const load = React.useCallback(async (): Promise<SessionWithClimbs[]> => {
    const { sessions } = await api.sessionsWithClimbs();
    return sessions;
  }, [api]);

  const { state: raw, reload } = useQuery(load);

  const state = React.useMemo((): QueryState<TrendsVM> => {
    if (raw.status !== "ready") return raw;
    return { status: "ready", data: trendsVM(raw.data) };
  }, [raw]);

  return { state, reload };
}
