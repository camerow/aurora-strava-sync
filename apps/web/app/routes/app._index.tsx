import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData, useRevalidator } from "react-router";
import type { ConnectionStatus, SessionRow } from "@sendtally/api-client";
import { requireApi } from "../lib/api.server";
import { SessionRowItem } from "../sessions/components/SessionRowItem";

type LoaderData = {
  status: ConnectionStatus;
  sessions: SessionRow[];
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const api = await requireApi(args);
  const status = await api.status();
  if (status.board?.status !== "active") {
    throw redirect("/app/setup");
  }
  const { sessions } = await api.sessions();
  return { status, sessions };
}

export async function action(args: LoaderFunctionArgs): Promise<{ queued: boolean }> {
  const api = await requireApi(args);
  return api.syncNow();
}

const BOARD_LABELS: Record<string, string> = {
  tension: "Tension Board",
  kilter: "Kilter Board",
  grasshopper: "Grasshopper Board",
  decoy: "Decoy Board",
  touchstone: "Touchstone Board",
  soill: "So iLL Board",
  aurora: "Aurora Board",
};

export default function Sessions(): React.ReactElement {
  const { status, sessions } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const boardLabel = BOARD_LABELS[status.board?.board ?? ""] ?? "Board";
  const [syncRequested, setSyncRequested] = React.useState(false);

  async function syncNow(): Promise<void> {
    setSyncRequested(true);
    await fetch("/app?index", { method: "POST" });
    setTimeout(() => revalidator.revalidate(), 4000);
  }

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
          {sessions.length === 1 ? "1 SESSION" : `${sessions.length} SESSIONS`} ·{" "}
          {boardLabel.toUpperCase()}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => void syncNow()}
          disabled={syncRequested}
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 13,
            color: "rgba(64,63,76,0.72)",
            background: "none",
            border: "1px solid rgba(64,63,76,0.25)",
            borderRadius: "var(--radius-control)",
            padding: "8px 14px",
            cursor: "pointer",
            opacity: syncRequested ? 0.45 : 1,
          }}
        >
          {syncRequested ? "Sync queued…" : "Sync now"}
        </button>
      </div>
      {status.strava?.status !== "active" && (
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
            Sessions are recorded here but not posted anywhere. Connect Strava and each one becomes
            a Rock Climbing activity on your feed.
          </span>
          <a
            href="/app/setup"
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
            Connect Strava
          </a>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {sessions.map((s) => (
          <SessionRowItem key={s.fingerprint} session={s} boardLabel={boardLabel} />
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
          No sessions yet. Climb, log it in the board app, and it shows up here within a couple of
          hours - or hit Sync now.
        </div>
      )}
    </div>
  );
}
