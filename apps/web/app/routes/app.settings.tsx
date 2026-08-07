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

const underlineButton: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.06em",
  color: "rgba(64,63,76,0.6)",
  background: "none",
  border: "none",
  cursor: "pointer",
  textDecoration: "underline",
  padding: 0,
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

function boardLabelOf(board: string): string {
  return BOARD_LABELS[board] ?? "Board";
}

export default function SettingsRoute(): React.ReactElement {
  const { apiUrl } = useLoaderData<typeof loader>();
  const api = useClientApi(apiUrl);
  const {
    state,
    syncingBoard,
    syncBoard,
    postingBoard,
    setPosting,
    scheduleBusy,
    setSchedule,
    message,
  } = useSyncSettings(api);

  const status = state.status === "ready" ? state.data : null;
  const boards = status?.boards ?? [];
  const activeBoards = boards.filter((b) => b.status === "active");
  const strava = status?.strava ?? null;
  const stravaActive = strava?.status === "active";
  const anyPostingOn = stravaActive && boards.some((b) => b.postingEnabled);
  const lastSync = status?.sync?.lastSyncedAt ?? null;
  const autoSync = status?.autoSync === true;

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
          {anyPostingOn ? "STRAVA + BOARD" : boards.length > 0 ? "BOARD ONLY" : "NOT CONNECTED"}
        </span>
      </div>

      <Section>
        <span style={sectionLabel}>SCHEDULE</span>
        <p style={bodyText}>
          {autoSync
            ? "Automatic daily sync is on - the server checks your boards once a day and imports anything new."
            : "Automatic sync is off. Use the per-board sync buttons below, or turn on a once-a-day automatic check."}
        </p>
        <button
          onClick={() => void setSchedule(autoSync ? "off" : "daily")}
          disabled={scheduleBusy || status === null}
          style={
            autoSync
              ? { ...underlineButton, opacity: scheduleBusy ? 0.45 : 1 }
              : { ...azureButton, opacity: scheduleBusy || status === null ? 0.45 : 1 }
          }
        >
          {autoSync ? "TURN OFF DAILY SYNC" : "Turn on daily sync"}
        </button>
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
        {activeBoards.length === 0 ? (
          <p style={bodyText}>Connect a board below and its sync button appears here.</p>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {activeBoards.map((b) => (
              <button
                key={b.board}
                onClick={() => void syncBoard(b.board)}
                disabled={syncingBoard !== null}
                style={{
                  ...azureButton,
                  opacity: syncingBoard !== null ? 0.45 : 1,
                }}
              >
                {syncingBoard === b.board ? "Syncing…" : `Sync ${boardLabelOf(b.board)}`}
              </button>
            ))}
          </div>
        )}
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
        {!stravaActive ? (
          <>
            <p style={bodyText}>
              Strava is not connected. Connect it and, when you choose, sessions post to your feed
              as Rock Climbing activities.
            </p>
            <Link to="/app/setup" style={{ ...azureButton, textDecoration: "none" }}>
              Connect Strava
            </Link>
          </>
        ) : activeBoards.length === 0 ? (
          <p style={bodyText}>Connect a board and choose per board what gets posted.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {activeBoards.map((b, i) => (
              <div
                key={b.board}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "12px 0",
                  borderTop: i > 0 ? "1px solid var(--line-on-light)" : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{boardLabelOf(b.board)}</span>
                  <span style={monoMuted}>{b.postingEnabled ? "POSTING ON" : "POSTING OFF"}</span>
                </div>
                {b.postingEnabled ? (
                  <button
                    onClick={() => void setPosting(b.board, "off")}
                    disabled={postingBoard !== null}
                    style={underlineButton}
                  >
                    TURN OFF
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => void setPosting(b.board, "new")}
                      disabled={postingBoard !== null}
                      style={azureButton}
                    >
                      Post new sessions
                    </button>
                    <button
                      onClick={() => void setPosting(b.board, "all")}
                      disabled={postingBoard !== null}
                      style={{ ...azureButton, background: "var(--bs-watermelon-ink)" }}
                    >
                      Post full history
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
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
          {boards.map((b) => (
            <div
              key={b.board}
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
                <span style={{ fontWeight: 600, fontSize: 13 }}>{boardLabelOf(b.board)}</span>
                <span style={monoMuted}>{`AURORA TOKEN · ${b.status.toUpperCase()}`}</span>
              </span>
              <Link
                to="/app/setup?add=board"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "rgba(64,63,76,0.6)",
                  textDecoration: "underline",
                }}
              >
                Re-link
              </Link>
            </div>
          ))}
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
                {boards.length === 0 ? "Board" : "Another board"}
              </span>
              <span style={monoMuted}>
                {boards.length === 0 ? "NOT LINKED" : "TENSION, KILTER, AND MORE"}
              </span>
            </span>
            <Link
              to="/app/setup?add=board"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "rgba(64,63,76,0.6)",
                textDecoration: "underline",
              }}
            >
              {boards.length === 0 ? "Link" : "Connect"}
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}
