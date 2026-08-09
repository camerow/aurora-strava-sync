import React from "react";
import { Link } from "react-router";
import type { StravaPostingMode } from "@sendtally/api-client";
import type { BoardCardVM } from "@sendtally/features/sync-settings";
import {
  azureButton,
  bodyText,
  linkAction,
  messageText,
  monoMuted,
  rowDivider,
  underlineButton,
} from "./styles";

export type BoardCardProps = {
  board: BoardCardVM;
  stravaActive: boolean;
  postingBusy: boolean;
  message: string | null;
  onSync: () => void;
  onPosting: (mode: StravaPostingMode) => void;
};

export function BoardCard({
  board,
  stravaActive,
  postingBusy,
  message,
  onSync,
  onPosting,
}: BoardCardProps): React.ReactElement {
  return (
    <div
      style={{
        ...rowDivider,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "14px 0",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{board.label}</span>
          <span style={monoMuted}>{board.statusLabel}</span>
        </span>
        <Link to="/app/setup?add=board" style={linkAction}>
          Re-link
        </Link>
      </div>

      {board.isActive && (
        <button
          onClick={onSync}
          disabled={board.syncDisabled}
          style={{ ...azureButton, opacity: board.syncDisabled ? 0.45 : 1 }}
        >
          {board.syncing ? "Syncing…" : "Sync now"}
        </button>
      )}

      {board.isActive &&
        (stravaActive ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={monoMuted}>{board.postingLabel}</span>
            {board.postingEnabled ? (
              <button
                onClick={() => onPosting("off")}
                disabled={postingBusy}
                style={underlineButton}
              >
                TURN OFF STRAVA POSTING
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => onPosting("new")} disabled={postingBusy} style={azureButton}>
                  Post new sessions
                </button>
                <button
                  onClick={() => onPosting("all")}
                  disabled={postingBusy}
                  style={{ ...azureButton, background: "var(--bs-watermelon-ink)" }}
                >
                  Post full history
                </button>
              </div>
            )}
          </div>
        ) : (
          <p style={bodyText}>
            Connect Strava below to post this board&rsquo;s sessions to your feed.
          </p>
        ))}

      {message !== null && <span style={messageText}>{message}</span>}
    </div>
  );
}
