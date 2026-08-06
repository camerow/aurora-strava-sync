import React from "react";
import type { SessionRow } from "@sendtally/api-client";

function durationLabel(startAt: string, endAt: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export type SessionBadge = "synced" | "pending" | "logged";

const BADGE_STYLES: Record<SessionBadge, { label: string; border: string; color: string }> = {
  synced: {
    label: "SYNCED",
    border: "1px solid rgba(27,98,206,0.4)",
    color: "var(--bs-azure-ink)",
  },
  pending: {
    label: "PENDING",
    border: "1px solid rgba(64,63,76,0.25)",
    color: "rgba(64,63,76,0.6)",
  },
  logged: {
    label: "LOGGED",
    border: "1px solid rgba(64,63,76,0.18)",
    color: "rgba(64,63,76,0.45)",
  },
};

export function SessionRowItem({
  session,
  boardLabel,
  badge,
}: {
  session: SessionRow;
  boardLabel: string;
  badge: SessionBadge;
}): React.ReactElement {
  const start = new Date(session.start_at);
  const badgeStyle = BADGE_STYLES[badge];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1.1fr 1.5fr auto",
        gap: 18,
        alignItems: "center",
        background: "#F7F6F3",
        borderRadius: "var(--radius-card)",
        padding: "16px 20px",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: 10,
            color: "rgba(64,63,76,0.55)",
            letterSpacing: "0.08em",
          }}
        >
          {start.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }).toUpperCase()}
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 16 }}>
          {start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
        </span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{boardLabel}</span>
        <span
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(64,63,76,0.55)" }}
        >
          {durationLabel(session.start_at, session.end_at)} · RPE {session.rpe}/10
        </span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(64,63,76,0.72)" }}
        >
          {session.climb_count} climbs
        </span>
        {session.top_grade >= 0 && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              fontSize: 12,
              color: "var(--text-label-accent)",
              letterSpacing: "0.04em",
            }}
          >
            TOP V{session.top_grade}
          </span>
        )}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 10,
          letterSpacing: "0.08em",
          borderRadius: "var(--radius-pill)",
          padding: "3px 9px",
          border: badgeStyle.border,
          color: badgeStyle.color,
        }}
      >
        {badgeStyle.label}
      </span>
    </div>
  );
}
