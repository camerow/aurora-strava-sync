import React from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData, useRevalidator } from "react-router";
import type { ConnectionStatus, SessionRow } from "@sendtally/api-client";
import { requireApi } from "../lib/api.server";
import { SessionRowItem, type SessionBadge } from "../sessions/components/SessionRowItem";

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

export async function action(args: ActionFunctionArgs): Promise<{ ok: boolean }> {
  const api = await requireApi(args);
  const form = await args.request.formData();
  const intent = form.get("intent");
  if (intent === "posting-new") await api.setStravaPosting("new");
  else if (intent === "posting-all") await api.setStravaPosting("all");
  else if (intent === "posting-off") await api.setStravaPosting("off");
  else await api.syncNow();
  return { ok: true };
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

function badgeFor(session: SessionRow, status: ConnectionStatus): SessionBadge {
  if (session.strava_activity_id !== null) return "synced";
  const strava = status.strava;
  if (strava === null || strava.status !== "active" || !strava.postingEnabled) return "logged";
  if (strava.postSince !== null) {
    const cutoff = new Date(`${strava.postSince.slice(0, 10)}T00:00:00Z`);
    if (new Date(session.start_at) < cutoff) return "logged";
  }
  return "pending";
}

export default function Sessions(): React.ReactElement {
  const { status, sessions } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const boardLabel = BOARD_LABELS[status.board?.board ?? ""] ?? "Board";
  const [syncRequested, setSyncRequested] = React.useState(false);
  const importing = status.sync?.lastSyncedAt == null;
  const stravaConnected = status.strava?.status === "active";
  const postingOn = stravaConnected && status.strava?.postingEnabled === true;

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
          {sessions.length === 1 ? "1 SESSION" : `${sessions.length} SESSIONS`} ·{" "}
          {boardLabel.toUpperCase()}
        </span>
        <div style={{ flex: 1 }} />
        {postingOn && (
          <Form method="post">
            <input type="hidden" name="intent" value="posting-off" />
            <button
              type="submit"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.06em",
                color: "rgba(64,63,76,0.6)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              STRAVA POSTING ON · TURN OFF
            </button>
          </Form>
        )}
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
          {syncRequested ? "Sync queued…" : "Sync sessions"}
        </button>
      </div>
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
      {stravaConnected && !postingOn && (
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
            Strava is connected but nothing posts until you say so. Choose what to share - each
            session becomes one Rock Climbing activity.
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <Form method="post">
              <input type="hidden" name="intent" value="posting-new" />
              <button type="submit" style={bannerButton}>
                Post new sessions
              </button>
            </Form>
            <Form method="post">
              <input type="hidden" name="intent" value="posting-all" />
              <button
                type="submit"
                style={{ ...bannerButton, background: "var(--bs-watermelon-ink)" }}
              >
                Post full history
              </button>
            </Form>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
        {sessions.map((s) => (
          <SessionRowItem
            key={s.fingerprint}
            session={s}
            boardLabel={boardLabel}
            badge={badgeFor(s, status)}
          />
        ))}
      </div>
      {sessions.length === 0 && !importing && (
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
          hours - or hit Sync sessions.
        </div>
      )}
    </div>
  );
}
