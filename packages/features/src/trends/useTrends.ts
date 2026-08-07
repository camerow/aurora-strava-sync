import React from "react";
import type { SendtallyApi, SessionWithClimbs } from "@sendtally/api-client";
import { useQuery, type QueryState } from "../lib/useQuery";
import { trendsVM } from "./transforms";
import type { TrendRange, TrendsVM } from "./types";

export type TrendsFeature = {
  state: QueryState<TrendsVM>;
  reload: () => void;
  range: TrendRange;
  setRange: (range: TrendRange) => void;
  board: string | null;
  setBoard: (board: string | null) => void;
  boards: string[];
};

export function useTrends(api: SendtallyApi): TrendsFeature {
  const [range, setRange] = React.useState<TrendRange>("3m");
  const [board, setBoard] = React.useState<string | null>(null);

  const load = React.useCallback(async (): Promise<SessionWithClimbs[]> => {
    const { sessions } = await api.sessionsWithClimbs();
    return sessions;
  }, [api]);

  const { state: raw, reload } = useQuery(load);

  const boards = React.useMemo((): string[] => {
    if (raw.status !== "ready") return [];
    return [...new Set(raw.data.map((s) => s.board).filter((b): b is string => b !== null))];
  }, [raw]);

  const state = React.useMemo((): QueryState<TrendsVM> => {
    if (raw.status !== "ready") return raw;
    const filtered = board === null ? raw.data : raw.data.filter((s) => s.board === board);
    return { status: "ready", data: trendsVM(filtered, range) };
  }, [raw, range, board]);

  return { state, reload, range, setRange, board, setBoard, boards };
}
