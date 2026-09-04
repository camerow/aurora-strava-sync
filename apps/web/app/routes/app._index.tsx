import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import type { ConnectionStatus, SessionRow } from "@sendtally/api-client";
import { sessionBadge, sessionTitle } from "@sendtally/features/sessions";
import { STRAVA_SYNC_FEATURE } from "../billing/features";
import { requireApi } from "../lib/api.server";
import { hasFeature } from "../lib/billing.server";
import { SessionRowItem } from "../sessions/components/SessionRowItem";

type LoaderData = {
  status: ConnectionStatus;
  sessions: SessionRow[];
  canSyncStrava: boolean;
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const api = await requireApi(args);
  const status = await api.status();
  const { sessions } = await api.sessions();
  return { status, sessions, canSyncStrava: await hasFeature(args, STRAVA_SYNC_FEATURE) };
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
  const { status, sessions, canSyncStrava } = useLoaderData<typeof loader>();
  const stravaConnected = status.strava?.status === "active";

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
            background: "var(--bs-watermelon-ink)",
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
            {canSyncStrava
              ? "Your logbook lives here either way. Connect Strava and your sessions can post to your feed as Rock Climbing activities."
              : "Your logbook lives here either way. Members get trend screens for the whole history, and Strava sync so board training counts toward your training load."}
          </span>
          <Link
            to={canSyncStrava ? "/app/setup" : "/app/membership"}
            style={{ ...bannerButton, textDecoration: "none" }}
          >
            {canSyncStrava ? "Connect Strava" : "See membership"}
          </Link>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {sessions.map((s) => (
          <SessionRowItem
            key={s.fingerprint}
            session={s}
            title={sessionTitle(s)}
            badge={sessionBadge(s)}
          />
        ))}
      </div>
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
