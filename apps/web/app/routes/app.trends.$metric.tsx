import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useParams } from "react-router";
import { useTrends, type TrendMetric } from "@sendtally/features/trends";
import { cloudflareContext } from "../lib/cloudflare-context";
import { requireApi } from "../lib/api.server";
import { useClientApi } from "../lib/useClientApi";
import { TrendBars } from "../trends/components/TrendBars";
import { TrendFilters } from "../trends/components/TrendFilters";

export async function loader(args: LoaderFunctionArgs): Promise<{ apiUrl: string }> {
  await requireApi(args);
  return { apiUrl: args.context.get(cloudflareContext).env.API_URL };
}

const METRICS: TrendMetric[] = ["volume", "pyramid", "hardest", "flash", "avggrade"];

const monoMuted: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.06em",
  color: "rgba(64,63,76,0.55)",
};

export default function TrendDetailRoute(): React.ReactElement {
  const { apiUrl } = useLoaderData<typeof loader>();
  const params = useParams();
  const api = useClientApi(apiUrl);
  const feature = useTrends(api);
  const { state } = feature;
  const metric = METRICS.includes(params.metric as TrendMetric)
    ? (params.metric as TrendMetric)
    : "volume";

  return (
    <div>
      <Link
        to="/app/trends"
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 12,
          letterSpacing: "0.04em",
          color: "var(--text-label-accent)",
          textDecoration: "none",
        }}
      >
        ← TRENDS
      </Link>
      <TrendFilters feature={feature} />
      {state.status === "loading" && (
        <span style={{ ...monoMuted, display: "block", marginTop: 22 }}>LOADING…</span>
      )}
      {state.status === "error" && (
        <span style={{ ...monoMuted, display: "block", marginTop: 22 }}>
          Could not load trends. Refresh to retry.
        </span>
      )}
      {state.status === "ready" &&
        (() => {
          const detail = state.data.details[metric];
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <h1
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 32,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {detail.title}
                </h1>
                <span style={monoMuted}>{detail.caption}</span>
              </div>
              <div
                style={{
                  background: "var(--bs-white)",
                  border: "1px solid var(--line-on-light-soft)",
                  borderRadius: "var(--radius-card)",
                  padding: "22px 20px",
                }}
              >
                <TrendBars bars={detail.bars} yTicks={detail.yTicks} height={150} showValues />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {detail.specs.map((sp) => (
                  <div
                    key={sp.k}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "150px 1fr",
                      gap: 14,
                      padding: "12px 0",
                      borderTop: "1px solid var(--line-on-light)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 500,
                        fontSize: 10,
                        letterSpacing: "0.08em",
                        color: "var(--text-label-accent)",
                        paddingTop: 2,
                      }}
                    >
                      {sp.k}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--text-on-white-secondary)" }}>
                      {sp.v}
                    </span>
                  </div>
                ))}
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "var(--text-on-white-secondary)",
                }}
              >
                {detail.insight}
              </p>
            </div>
          );
        })()}
    </div>
  );
}
