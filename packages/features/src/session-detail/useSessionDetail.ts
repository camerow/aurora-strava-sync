import React from "react";
import type { SendtallyApi, SessionDetail } from "@sendtally/api-client";
import { useQuery, type QueryState } from "../lib/useQuery";
import { climbVMs, filterAndSortClimbs, sessionDetailVM } from "./transforms";
import type { ClimbFilter, ClimbSort, ClimbVM, SessionDetailVM } from "./types";

export type SessionDetailFeature = {
  state: QueryState<{ vm: SessionDetailVM; climbs: ClimbVM[] }>;
  filter: ClimbFilter;
  setFilter: (f: ClimbFilter) => void;
  sort: ClimbSort;
  setSort: (s: ClimbSort) => void;
  reload: () => void;
};

export function useSessionDetail(api: SendtallyApi, fingerprint: string): SessionDetailFeature {
  const [filter, setFilter] = React.useState<ClimbFilter>("all");
  const [sort, setSort] = React.useState<ClimbSort>("order");

  const load = React.useCallback(async (): Promise<SessionDetail> => {
    const { session } = await api.session(fingerprint);
    return session;
  }, [api, fingerprint]);

  const { state: raw, reload } = useQuery(load);

  const state = React.useMemo((): SessionDetailFeature["state"] => {
    if (raw.status !== "ready") return raw;
    const all = climbVMs(raw.data.climbs);
    return {
      status: "ready",
      data: {
        vm: sessionDetailVM(raw.data),
        climbs: filterAndSortClimbs(all, filter, sort),
      },
    };
  }, [raw, filter, sort]);

  return { state, filter, setFilter, sort, setSort, reload };
}
