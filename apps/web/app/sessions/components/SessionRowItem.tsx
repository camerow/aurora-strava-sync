import React from "react";
import { Link } from "react-router";
import type { SessionRow } from "@sendtally/api-client";
import { SESSION_BADGE_LABELS, type SessionBadge } from "@sendtally/features/sessions";

function durationLabel(startAt: string, endAt: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const BADGE_STYLES: Record<SessionBadge, { border: string; color: string }> = {
  on_strava: {
    border: "1px solid rgba(27,98,206,0.4)",
    color: "var(--bs-azure-ink)",
  },
  will_post: {
    border: "1px solid rgba(64,63,76,0.25)",
    color: "rgba(64,63,76,0.6)",
  },
  not_posted: {
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
    <Link
      to={`/app/sessions/${encodeURIComponent(session.fingerprint)}`}
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1.1fr 1.5fr auto 14px",
        gap: 18,
        alignItems: "center",
        background: "#F7F6F3",
        borderRadius: "var(--radius-card)",
        padding: "16px 20px",
        textDecoration: "none",
        color: "var(--bs-gunmetal)",
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
        {SESSION_BADGE_LABELS[badge]}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          fontSize: 16,
          color: "rgba(64,63,76,0.35)",
        }}
      >
        ›
      </span>
    </Link>
  );
}
