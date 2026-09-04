import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useSearchParams } from "react-router";
import type { ConnectionStatus, SessionRow } from "@sendtally/api-client";
import {
  resolveSessionMonth,
  sessionBadge,
  sessionMonths,
  sessionTitle,
} from "@sendtally/features/sessions";
import { requireApi } from "../lib/api.server";
import { MonthPicker } from "../sessions/components/MonthPicker";
import { SessionRowItem } from "../sessions/components/SessionRowItem";

type LoaderData = {
  status: ConnectionStatus;
  sessions: SessionRow[];
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const api = await requireApi(args);
  const status = await api.status();
  const { sessions } = await api.sessions();
  return { status, sessions };
}

const bannerButton: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 13,
  color: "var(--bs-white)",
  background: "var(--bs-azure-ink)",
  border: "none",
  borderRadius: "var(--radius-control)",
  padding: "9px 16px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export default function Sessions(): React.ReactElement {
  const { status, sessions } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const stravaConnected = status.strava?.status === "active";
  const months = React.useMemo(() => sessionMonths(sessions), [sessions]);
  const selected = resolveSessionMonth(months, searchParams.get("month"));

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
          Sessions
        </h1>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 11,
            color: "rgba(64,63,76,0.55)",
            letterSpacing: "0.06em",
          }}
        >
          {sessions.length === 1 ? "1 SESSION" : `${sessions.length} SESSIONS`}
        </span>
        <div style={{ flex: 1 }} />
        <Link
          to="/app/sessions/new"
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 13,
            color: "var(--bs-white)",
            background: "var(--bs-azure-ink)",
            borderRadius: "var(--radius-control)",
            padding: "9px 16px",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Log a session
        </Link>
      </div>
      {!stravaConnected && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            background: "var(--surface-accent-pink)",
            borderRadius: "var(--radius-card)",
            padding: "16px 20px",
            marginTop: 22,
          }}
        >
          <span style={{ flex: 1, fontSize: 14, lineHeight: 1.5, color: "var(--text-on-light)" }}>
            Your logbook lives here either way. Connect Strava and your sessions can post to your
            feed as Rock Climbing activities.
          </span>
          <Link to="/app/setup" style={{ ...bannerButton, textDecoration: "none" }}>
            Connect Strava
          </Link>
        </div>
      )}
      {selected !== null && (
        <>
          <div style={{ marginTop: 26 }}>
            <MonthPicker months={months} selected={selected} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
            {selected.sessions.map((s) => (
              <SessionRowItem
                key={s.fingerprint}
                session={s}
                title={sessionTitle(s)}
                badge={sessionBadge(s)}
              />
            ))}
          </div>
        </>
      )}
      {sessions.length === 0 && (
        <div
          style={{
            padding: 36,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "rgba(64,63,76,0.55)",
          }}
        >
          No sessions yet. Hit Log a session and your first one takes about a minute.
        </div>
      )}
    </div>
  );
}
