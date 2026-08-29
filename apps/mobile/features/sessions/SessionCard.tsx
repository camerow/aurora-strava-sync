import React from "react";
import { Text, View } from "react-native";
import type { SessionRow } from "@sendtally/api-client";
import { SESSION_BADGE_LABELS, type SessionBadge } from "@sendtally/features/sessions";
import { colors, fonts, radius } from "@sendtally/design/tokens";

function durationLabel(startAt: string, endAt: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endAt) - Date.parse(startAt)) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const BADGES: Record<SessionBadge, { color: string; border: string }> = {
  in_progress: { color: colors.watermelonInk, border: "rgba(196,48,61,0.4)" },
  on_strava: { color: colors.azureInk, border: "rgba(27,98,206,0.4)" },
};

export function SessionCard({
  session,
  title,
  badge,
}: {
  session: SessionRow;
  title: string;
  badge: SessionBadge | null;
}): React.ReactElement {
  const start = new Date(session.start_at);
  const dateLine = `${start
    .toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
    .toUpperCase()} ${start
    .toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase()} · ${durationLabel(session.start_at, session.end_at)}`;
  const b = badge === null ? null : BADGES[badge];

  return (
    <View
      style={{
        backgroundColor: colors.surfaceSoft,
        borderRadius: radius.card,
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 8,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: 10,
            letterSpacing: 0.8,
            color: colors.textMuted,
            flexShrink: 1,
          }}
        >
          {dateLine}
        </Text>
        {badge !== null && b !== null && (
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 9,
              letterSpacing: 0.7,
              borderRadius: radius.pill,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderWidth: 1,
              borderColor: b.border,
              color: b.color,
              overflow: "hidden",
            }}
          >
            {SESSION_BADGE_LABELS[badge]}
          </Text>
        )}
      </View>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.gunmetal }}>
          {title}
        </Text>
        {session.top_grade >= 0 && (
          <Text
            style={{
              fontFamily: fonts.monoSemiBold,
              fontSize: 12,
              letterSpacing: 0.5,
              color: colors.watermelonInk,
            }}
          >
            TOP V{session.top_grade}
          </Text>
        )}
      </View>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary }}>
        {session.climb_count} CLIMBS · RPE {session.rpe}/10
      </Text>
    </View>
  );
}
