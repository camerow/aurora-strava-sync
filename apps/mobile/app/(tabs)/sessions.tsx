import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ConnectionStatus, SessionRow } from "@sendtally/api-client";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { Logo } from "../../components/Logo";
import { SessionCard, type SessionBadge } from "../../features/sessions/SessionCard";
import { useApi } from "../../lib/api";

const BOARD_LABELS: Record<string, string> = {
  tension: "Tension Board",
  kilter: "Kilter Board",
  grasshopper: "Grasshopper Board",
  decoy: "Decoy Board",
  touchstone: "Touchstone Board",
  soill: "So iLL Board",
  aurora: "Aurora Board",
};

function badgeFor(session: SessionRow, status: ConnectionStatus | null): SessionBadge {
  if (session.strava_activity_id !== null) return "synced";
  const strava = status?.strava;
  if (strava == null || strava.status !== "active" || !strava.postingEnabled) return "logged";
  if (strava.postSince !== null) {
    const cutoff = new Date(`${strava.postSince.slice(0, 10)}T00:00:00Z`);
    if (new Date(session.start_at) < cutoff) return "logged";
  }
  return "pending";
}

export default function Sessions(): React.ReactElement {
  const api = useApi();
  const [status, setStatus] = React.useState<ConnectionStatus | null>(null);
  const [sessions, setSessions] = React.useState<SessionRow[] | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const [s, list] = await Promise.all([api.status(), api.sessions()]);
      setStatus(s);
      setSessions(list.sessions);
      setError(null);
    } catch {
      setError("Could not reach sendtally. Pull to retry.");
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const importing = status !== null && status.sync?.lastSyncedAt == null;

  React.useEffect(() => {
    if (!importing) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [importing, load]);

  const boardLabel = BOARD_LABELS[status?.board?.board ?? ""] ?? "Board";
  const caption =
    sessions === null
      ? "LOADING…"
      : `${sessions.length} ${sessions.length === 1 ? "SESSION" : "SESSIONS"} · ${boardLabel.toUpperCase()}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <FlatList
        data={sessions ?? []}
        keyExtractor={(s) => s.fingerprint}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24, gap: 9 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            tintColor={colors.gunmetal}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 14, paddingTop: 12, paddingBottom: 5 }}>
            <Logo size={18} />
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  fontFamily: fonts.display,
                  fontSize: 32,
                  letterSpacing: -1,
                  color: colors.gunmetal,
                }}
              >
                Sessions
              </Text>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: 10,
                  letterSpacing: 0.8,
                  color: colors.textMuted,
                }}
              >
                {caption}
              </Text>
            </View>
            {importing && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: colors.gunmetalDeep,
                  borderRadius: radius.card,
                  padding: 14,
                }}
              >
                <ActivityIndicator size="small" color={colors.gold} />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fonts.monoMedium,
                    fontSize: 11,
                    letterSpacing: 0.6,
                    lineHeight: 17,
                    color: "rgba(239,188,213,0.88)",
                  }}
                >
                  READING YOUR LOGBOOK - the first import can take a few minutes.
                </Text>
              </View>
            )}
            {error !== null && (
              <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.watermelonInk }}>
                {error}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          sessions !== null && !importing ? (
            <Text
              style={{
                padding: 28,
                textAlign: "center",
                fontFamily: fonts.mono,
                fontSize: 13,
                lineHeight: 20,
                color: colors.textMuted,
              }}
            >
              No sessions yet. Climb, log it in the board app, and it shows up here within a couple
              of hours.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/session/[fingerprint]",
                params: { fingerprint: item.fingerprint, board: status?.board?.board ?? "" },
              })
            }
          >
            <SessionCard session={item} boardLabel={boardLabel} badge={badgeFor(item, status)} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
