import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { useSyncSettings } from "@sendtally/features/sync-settings";
import { BOARD_LABELS } from "@sendtally/features/session-detail";
import { cloudflareContext } from "../lib/cloudflare-context";
import { requireApi } from "../lib/api.server";
import { useClientApi } from "../lib/useClientApi";

export async function loader(args: LoaderFunctionArgs): Promise<{ apiUrl: string }> {
  await requireApi(args);
  return { apiUrl: args.context.get(cloudflareContext).env.API_URL };
}

const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--text-label-accent)",
};

const bodyText: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--text-on-white-secondary)",
  margin: 0,
};

const monoMuted: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: "0.06em",
  color: "rgba(64,63,76,0.55)",
};

const azureButton: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 14,
  color: "var(--bs-white)",
  background: "var(--bs-azure-ink)",
  border: "none",
  borderRadius: "var(--radius-control)",
  padding: "12px 18px",
  cursor: "pointer",
  alignSelf: "flex-start",
};

function Section({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        background: "#F7F6F3",
        border: "1px solid var(--line-on-light-soft)",
        borderRadius: "var(--radius-card)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

export default function SettingsRoute(): React.ReactElement {
  const { apiUrl } = useLoaderData<typeof loader>();
  const api = useClientApi(apiUrl);
  const { state, syncRequested, syncSessions, postingBusy, setPosting, message } =
    useSyncSettings(api);

  const status = state.status === "ready" ? state.data : null;
  const board = status?.board ?? null;
  const strava = status?.strava ?? null;
  const postingOn = strava?.status === "active" && strava.postingEnabled;
  const lastSync = status?.sync?.lastSyncedAt ?? null;

  return (
    <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: "-0.03em",
          }}
        >
          Sync & accounts
        </h1>
        <span style={monoMuted}>
          {postingOn ? "STRAVA + BOARD" : board !== null ? "BOARD ONLY" : "NOT CONNECTED"}
        </span>
      </div>

      <Section>
        <span style={sectionLabel}>SCHEDULE</span>
        <p style={bodyText}>
          Automatic. The server checks your board every 15 minutes and imports anything new -
          nothing to keep open.
        </p>
        <span style={monoMuted}>
          {lastSync !== null
            ? `LAST SYNC ${new Date(lastSync)
                .toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
                .toUpperCase()}`
            : "FIRST IMPORT PENDING"}
        </span>
      </Section>

      <Section>
        <span style={sectionLabel}>MANUAL SYNC</span>
        <button
          onClick={() => void syncSessions()}
          disabled={syncRequested}
          style={{ ...azureButton, opacity: syncRequested ? 0.45 : 1 }}
        >
          {syncRequested ? "Syncing…" : "Sync sessions"}
        </button>
        {message !== null && (
          <span
            style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(64,63,76,0.6)" }}
          >
            {message}
          </span>
        )}
      </Section>

      <Section>
        <span style={sectionLabel}>STRAVA POSTING</span>
        {strava === null || strava.status !== "active" ? (
          <>
            <p style={bodyText}>
              Strava is not connected. Connect it and, when you choose, sessions post to your feed
              as Rock Climbing activities.
            </p>
            <Link to="/app/setup" style={{ ...azureButton, textDecoration: "none" }}>
              Connect Strava
            </Link>
          </>
        ) : (
          <>
            <p style={bodyText}>
              {postingOn
                ? "Posting is on - each session becomes one Rock Climbing activity."
                : "Connected, but nothing posts until you say so."}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {postingOn ? (
                <button
                  onClick={() => void setPosting("off")}
                  disabled={postingBusy}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.06em",
                    color: "rgba(64,63,76,0.6)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  TURN OFF
                </button>
              ) : (
                <>
                  <button
                    onClick={() => void setPosting("new")}
                    disabled={postingBusy}
                    style={azureButton}
                  >
                    Post new sessions
                  </button>
                  <button
                    onClick={() => void setPosting("all")}
                    disabled={postingBusy}
                    style={{ ...azureButton, background: "var(--bs-watermelon-ink)" }}
                  >
                    Post full history
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </Section>

      <Section>
        <span style={sectionLabel}>CONNECTED ACCOUNTS</span>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderTop: "1px solid var(--line-on-light)",
            }}
          >
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>Strava</span>
              <span style={monoMuted}>
                {strava === null
                  ? "NOT CONNECTED"
                  : `ATHLETE ${strava.athleteId} · ${strava.status.toUpperCase()}`}
              </span>
            </span>
            <Link
              to="/app/setup"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "rgba(64,63,76,0.6)",
                textDecoration: "underline",
              }}
            >
              {strava === null ? "Connect" : "Re-link"}
            </Link>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderTop: "1px solid var(--line-on-light)",
            }}
          >
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {board !== null ? (BOARD_LABELS[board.board] ?? "Board") : "Board"}
              </span>
              <span style={monoMuted}>
                {board === null ? "NOT LINKED" : `AURORA TOKEN · ${board.status.toUpperCase()}`}
              </span>
            </span>
            <Link
              to="/app/setup"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "rgba(64,63,76,0.6)",
                textDecoration: "underline",
              }}
            >
              {board === null ? "Link" : "Re-link"}
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}
