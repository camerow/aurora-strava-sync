import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ConnectionStatus, SessionRow } from "@sendtally/api-client";
import { BOARD_LABELS } from "@sendtally/features/session-detail";
import { sessionBadge } from "@sendtally/features/sessions";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { Logo } from "../../components/Logo";
import { SessionCard } from "../../features/sessions/SessionCard";
import { useApi } from "../../lib/api";

export default function Sessions(): React.ReactElement {
  const api = useApi();
  const [status, setStatus] = React.useState<ConnectionStatus | null>(null);
  const [sessions, setSessions] = React.useState<SessionRow[] | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [boardFilter, setBoardFilter] = React.useState<string | null>(null);

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

  const boardsInSessions = [
    ...new Set((sessions ?? []).map((s) => s.board).filter((b): b is string => b !== null)),
  ];
  const visible =
    sessions === null
      ? []
      : boardFilter === null
        ? sessions
        : sessions.filter((s) => s.board === boardFilter);
  const caption =
    sessions === null
      ? "LOADING…"
      : `${visible.length} ${visible.length === 1 ? "SESSION" : "SESSIONS"}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <FlatList
        data={visible}
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
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
              <View style={{ flex: 1, gap: 4 }}>
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
              <Pressable
                onPress={() => router.push("/session/new")}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 16,
                  borderRadius: radius.control,
                  backgroundColor: colors.watermelonInk,
                }}
              >
                <Text
                  style={{ fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.white }}
                >
                  Log a session
                </Text>
              </Pressable>
            </View>
            {boardsInSessions.length > 1 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[null, ...boardsInSessions].map((b) => {
                  const active = boardFilter === b;
                  return (
                    <Pressable
                      key={b ?? "all"}
                      onPress={() => setBoardFilter(b)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderColor: active ? colors.gold : "rgba(64,63,76,0.18)",
                        backgroundColor: active ? colors.gold : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.monoMedium,
                          fontSize: 10,
                          letterSpacing: 0.6,
                          color: active ? colors.gunmetal : "rgba(64,63,76,0.65)",
                        }}
                      >
                        {b === null ? "ALL BOARDS" : (BOARD_LABELS[b] ?? b).toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
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
                    color: "rgba(238,211,248,0.88)",
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
                params: { fingerprint: item.fingerprint },
              })
            }
          >
            <SessionCard
              session={item}
              boardLabel={BOARD_LABELS[item.board ?? ""] ?? "Board"}
              badge={sessionBadge(item, status)}
            />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
