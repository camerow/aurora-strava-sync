import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { useTrends } from "@sendtally/features/trends";
import { cloudflareContext } from "../lib/cloudflare-context";
import { requireApi } from "../lib/api.server";
import { useClientApi } from "../lib/useClientApi";
import { TrendBars } from "../trends/components/TrendBars";

export async function loader(args: LoaderFunctionArgs): Promise<{ apiUrl: string }> {
  await requireApi(args);
  return { apiUrl: args.context.get(cloudflareContext).env.API_URL };
}

const monoMuted: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.06em",
  color: "rgba(64,63,76,0.55)",
};

export default function TrendsRoute(): React.ReactElement {
  const { apiUrl } = useLoaderData<typeof loader>();
  const api = useClientApi(apiUrl);
  const { state } = useTrends(api);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: "-0.03em",
          }}
        >
          Trends
        </h1>
        {state.status === "ready" && <span style={monoMuted}>{state.data.caption}</span>}
      </div>
      {state.status === "loading" && (
        <span style={{ ...monoMuted, display: "block", marginTop: 22 }}>LOADING…</span>
      )}
      {state.status === "error" && (
        <span style={{ ...monoMuted, display: "block", marginTop: 22 }}>
          Could not load trends. Refresh to retry.
        </span>
      )}
      {state.status === "ready" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 24 }}>
          {state.data.tiles.map((tile) => (
            <Link
              key={tile.metric}
              to={`/app/trends/${tile.metric}`}
              style={{
                background: "var(--bs-white)",
                border: "1px solid var(--line-on-light-soft)",
                borderRadius: "var(--radius-card)",
                padding: 26,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                textDecoration: "none",
                color: "var(--bs-gunmetal)",
              }}
            >
              <span
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: "var(--text-label-accent)",
                  }}
                >
                  {tile.label}
                </span>
                <span
                  style={{
                    ...monoMuted,
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    color: "rgba(64,63,76,0.72)",
                  }}
                >
                  DETAILS →
                </span>
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 30,
                  letterSpacing: "-0.02em",
                }}
              >
                {tile.value}
              </span>
              <span style={{ ...monoMuted, color: "rgba(64,63,76,0.72)" }}>{tile.caption}</span>
              <div style={{ marginTop: 4 }}>
                <TrendBars bars={tile.bars} height={44} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
