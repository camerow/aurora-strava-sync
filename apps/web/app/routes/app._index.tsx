import React from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, redirect, useLoaderData, useRevalidator } from "react-router";
import type { ConnectionStatus, SessionRow } from "@sendtally/api-client";
import { BOARD_LABELS } from "@sendtally/features/session-detail";
import { sessionBadge } from "@sendtally/features/sessions";
import { requireApi } from "../lib/api.server";
import { SessionRowItem } from "../sessions/components/SessionRowItem";

type LoaderData = {
  status: ConnectionStatus;
  sessions: SessionRow[];
};

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  const api = await requireApi(args);
  const status = await api.status();
  const { sessions } = await api.sessions();
  if (!status.boards.some((b) => b.status === "active") && sessions.length === 0) {
    throw redirect("/app/setup");
  }
  return { status, sessions };
}

export async function action(args: ActionFunctionArgs): Promise<{ ok: boolean }> {
  const api = await requireApi(args);
  const form = await args.request.formData();
  const board = form.get("board");
  await api.syncNow(typeof board === "string" && board !== "" ? board : undefined);
  return { ok: true };
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

export default function Sessions(): React.ReactElement {
  const { status, sessions } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [syncRequested, setSyncRequested] = React.useState(false);
  const [boardFilter, setBoardFilter] = React.useState<string | null>(null);
  const importing = status.sync?.lastSyncedAt == null;
  const stravaConnected = status.strava?.status === "active";
  const anyPostingOn = stravaConnected && status.boards.some((b) => b.postingEnabled);

  const boardsInSessions = [
    ...new Set(sessions.map((s) => s.board).filter((b): b is string => b !== null)),
  ];
  const visible = boardFilter === null ? sessions : sessions.filter((s) => s.board === boardFilter);

  React.useEffect(() => {
    if (!importing) return;
    const timer = setInterval(() => revalidator.revalidate(), 4000);
    return () => clearInterval(timer);
  }, [importing, revalidator]);

  async function syncNow(): Promise<void> {
    setSyncRequested(true);
    const form = new FormData();
    form.set("intent", "sync");
    await fetch("/app?index", { method: "POST", body: form });
    setTimeout(() => {
      revalidator.revalidate();
      setSyncRequested(false);
    }, 5000);
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
          {visible.length === 1 ? "1 SESSION" : `${visible.length} SESSIONS`}
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
          {syncRequested ? "Sync queued…" : "Sync all boards"}
        </button>
      </div>
      {boardsInSessions.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18 }}>
          <button onClick={() => setBoardFilter(null)} style={chipStyle(boardFilter === null)}>
            ALL BOARDS
          </button>
          {boardsInSessions.map((b) => (
            <button key={b} onClick={() => setBoardFilter(b)} style={chipStyle(boardFilter === b)}>
              {(BOARD_LABELS[b] ?? b).toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {importing && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--bs-gunmetal-deep)",
            borderRadius: "var(--radius-card)",
            padding: "16px 20px",
            marginTop: 22,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              flex: "none",
              border: "2px solid rgba(249,220,92,0.35)",
              borderTopColor: "var(--bs-gold)",
              borderRadius: "50%",
              animation: "st-spin 0.7s linear infinite",
            }}
          />
          <style>{"@keyframes st-spin{to{transform:rotate(360deg)}}"}</style>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 12,
              letterSpacing: "0.06em",
              color: "rgba(238,211,248,0.88)",
            }}
          >
            READING YOUR LOGBOOK - the first import can take a few minutes. This page refreshes
            itself.
          </span>
        </div>
      )}
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
            Your logbook lives here either way. Connect Strava and, when you choose, sessions can
            post to your feed as Rock Climbing activities.
          </span>
          <a href="/app/setup" style={{ ...bannerButton, textDecoration: "none" }}>
            Connect Strava
          </a>
        </div>
      )}
      {stravaConnected && !anyPostingOn && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            background: "var(--surface-accent-pink)",
            borderRadius: "var(--radius-card)",
            padding: "16px 20px",
            marginTop: 22,
          }}
        >
          <span
            style={{
              flex: 1,
              minWidth: 260,
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--text-on-light)",
            }}
          >
            Strava is connected but nothing posts until you say so. Choose per board what to share -
            each session becomes one Rock Climbing activity.
          </span>
          <Link to="/app/settings" style={{ ...bannerButton, textDecoration: "none" }}>
            Choose what posts
          </Link>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {visible.map((s) => (
          <SessionRowItem
            key={s.fingerprint}
            session={s}
            boardLabel={BOARD_LABELS[s.board ?? ""] ?? "Board"}
            badge={sessionBadge(s, status)}
          />
        ))}
      </div>
      {visible.length === 0 && !importing && (
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
          hours - or hit Sync all boards.
        </div>
      )}
    </div>
  );
}
