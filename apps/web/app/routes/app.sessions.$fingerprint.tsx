import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useParams } from "react-router";
import {
  CLIMB_SORTS,
  useSessionDetail,
  type ClimbFilter,
  type ClimbVM,
} from "@sendtally/features/session-detail";
import { cloudflareContext } from "../lib/cloudflare-context";
import { requireApi } from "../lib/api.server";
import { useClientApi } from "../lib/useClientApi";

export async function loader(args: LoaderFunctionArgs): Promise<{ apiUrl: string }> {
  await requireApi(args);
  return { apiUrl: args.context.get(cloudflareContext).env.API_URL };
}

const monoLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--text-label-accent)",
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.06em",
  padding: "7px 12px",
  borderRadius: "var(--radius-pill)",
  cursor: "pointer",
  background: active ? "var(--bs-gold)" : "transparent",
  color: active ? "var(--bs-gunmetal)" : "rgba(64,63,76,0.65)",
  border: active ? "1px solid var(--bs-gold)" : "1px solid rgba(64,63,76,0.18)",
});

const RESULT_BADGES: Record<
  ClimbVM["result"],
  { label: string; bg: string; border: string; color: string }
> = {
  flash: {
    label: "FLASH",
    bg: "var(--bs-gold)",
    border: "var(--bs-gold)",
    color: "var(--bs-gunmetal)",
  },
  sent: {
    label: "SENT",
    bg: "transparent",
    border: "rgba(64,63,76,0.25)",
    color: "rgba(64,63,76,0.72)",
  },
  project: {
    label: "PROJECT",
    bg: "transparent",
    border: "rgba(64,63,76,0.15)",
    color: "rgba(64,63,76,0.5)",
  },
};

const GRID = "34px 1.9fr 62px 62px 62px 70px 92px";

export default function SessionDetailRoute(): React.ReactElement {
  const { apiUrl } = useLoaderData<typeof loader>();
  const params = useParams();
  const api = useClientApi(apiUrl);
  const feature = useSessionDetail(api, params.fingerprint ?? "");
  const { state, filter, setFilter, sort, setSort } = feature;

  if (state.status === "loading") {
    return <span style={{ ...monoLabel, color: "rgba(64,63,76,0.55)" }}>LOADING…</span>;
  }
  if (state.status === "error") {
    return (
      <span style={{ ...monoLabel }}>
        Could not load this session. <Link to="/app">Back to sessions</Link>
      </span>
    );
  }
  const { vm, climbs } = state.data;

  const filters: Array<[ClimbFilter, string]> = [
    ["all", `ALL ${vm.filterCounts.all}`],
    ["sent", `SENT ${vm.filterCounts.sent}`],
    ["flash", `FLASHED ${vm.filterCounts.flash}`],
    ["project", `PROJECTS ${vm.filterCounts.project}`],
  ];

  return (
    <div>
      <Link
        to="/app"
        style={{ ...monoLabel, fontSize: 12, letterSpacing: "0.04em", textDecoration: "none" }}
      >
        ← SESSIONS
      </Link>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 18,
          flexWrap: "wrap",
          marginTop: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: "-0.03em",
            }}
          >
            {vm.title}
          </h1>
          <span
            style={{
              ...monoLabel,
              fontSize: 11,
              color: "rgba(64,63,76,0.55)",
              letterSpacing: "0.06em",
            }}
          >
            {vm.meta}
          </span>
        </div>
        {vm.stravaUrl !== null && (
          <a
            href={vm.stravaUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: 13,
              color: "rgba(64,63,76,0.72)",
              border: "1px solid rgba(64,63,76,0.25)",
              borderRadius: "var(--radius-control)",
              padding: "8px 14px",
              textDecoration: "none",
            }}
          >
            View on Strava ↗
          </a>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
          gap: 1,
          background: "var(--line-on-light)",
          borderRadius: 12,
          overflow: "hidden",
          marginTop: 22,
        }}
      >
        {vm.stats.map((st) => (
          <span
            key={st.label}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              background: "#F7F6F3",
              padding: "13px 16px",
            }}
          >
            <span style={{ ...monoLabel, color: "rgba(64,63,76,0.55)" }}>{st.label}</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: 17,
                color: st.accent ? "var(--text-label-accent)" : "var(--bs-gunmetal)",
              }}
            >
              {st.value}
            </span>
          </span>
        ))}
      </div>

      {vm.bars.length > 0 && (
        <div
          style={{
            background: "var(--bs-white)",
            border: "1px solid var(--line-on-light-soft)",
            borderRadius: "var(--radius-card)",
            padding: "22px 26px",
            marginTop: 22,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <span style={{ ...monoLabel, fontSize: 11 }}>SENDS BY GRADE</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 84 }}>
            {vm.bars.map((b) => (
              <div
                key={b.gradeLabel}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  alignSelf: "flex-end",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: b.height === 0 ? 4 : Math.max(9, Math.round(b.height * 66)),
                    background:
                      b.height === 0
                        ? "var(--data-bar-empty)"
                        : b.peak
                          ? "var(--data-bar-peak)"
                          : "var(--data-bar)",
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                    fontSize: 10,
                    color: "rgba(64,63,76,0.72)",
                  }}
                >
                  {b.gradeLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          margin: "22px 0 4px",
        }}
      >
        {filters.map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} style={chipStyle(filter === value)}>
            {label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 12,
            color: "var(--bs-gunmetal)",
            background: "#F7F6F3",
            border: "1px solid rgba(64,63,76,0.15)",
            borderRadius: "var(--radius-control)",
            padding: "9px 12px",
            cursor: "pointer",
          }}
        >
          {CLIMB_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 640 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID,
              gap: 12,
              padding: "12px 4px 9px",
              alignItems: "center",
            }}
          >
            {["#", "PROBLEM", "GRADE", "ANGLE", "BURNS", "REST", "RESULT"].map((h) => (
              <span key={h} style={monoLabel}>
                {h}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {climbs.map((c) => {
              const badge = RESULT_BADGES[c.result]!;
              return (
                <div
                  key={c.n}
                  style={{
                    display: "grid",
                    gridTemplateColumns: GRID,
                    gap: 12,
                    padding: "12px 4px",
                    alignItems: "center",
                    borderTop: "1px solid var(--line-on-light)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "rgba(64,63,76,0.5)",
                    }}
                  >
                    {c.n}
                  </span>
                  <span
                    style={{
                      fontWeight: 500,
                      fontSize: 15,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      fontSize: 14,
                      color: c.isTopSend ? "var(--text-label-accent)" : "var(--bs-gunmetal)",
                    }}
                  >
                    {c.gradeLabel}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "rgba(64,63,76,0.72)",
                    }}
                  >
                    {c.angleLabel}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "rgba(64,63,76,0.72)",
                    }}
                  >
                    {c.burns}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "rgba(64,63,76,0.72)",
                    }}
                  >
                    {c.restLabel}
                  </span>
                  <span
                    style={{
                      justifySelf: "start",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      borderRadius: "var(--radius-pill)",
                      padding: "3px 9px",
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: "1px solid var(--line-on-light)",
        }}
      >
        <span
          style={{
            ...monoLabel,
            fontSize: 11,
            color: "rgba(64,63,76,0.55)",
            letterSpacing: "0.06em",
          }}
        >
          {vm.syncLine}
        </span>
      </div>
    </div>
  );
}
