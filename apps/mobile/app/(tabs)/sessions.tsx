import { router } from "expo-router";
import React from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SessionRow } from "@sendtally/api-client";
import {
  resolveSessionMonth,
  sessionBadge,
  sessionMonths,
  sessionTitle,
} from "@sendtally/features/sessions";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { Logo } from "../../components/Logo";
import { MonthPicker } from "../../features/sessions/MonthPicker";
import { SessionCard } from "../../features/sessions/SessionCard";
import { useApi } from "../../lib/api";

export default function Sessions(): React.ReactElement {
  const api = useApi();
  const [sessions, setSessions] = React.useState<SessionRow[] | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [monthKey, setMonthKey] = React.useState<string | null>(null);
  const months = React.useMemo(() => sessionMonths(sessions ?? []), [sessions]);
  const selected = resolveSessionMonth(months, monthKey);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const list = await api.sessions();
      setSessions(list.sessions);
      setError(null);
    } catch {
      setError("Could not reach sendtally. Pull to retry.");
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const caption =
    sessions === null
      ? "LOADING…"
      : `${sessions.length} ${sessions.length === 1 ? "SESSION" : "SESSIONS"}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <FlatList
        data={selected?.sessions ?? []}
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
                  backgroundColor: colors.azureInk,
                }}
              >
                <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.white }}>
                  Log a session
                </Text>
              </Pressable>
            </View>
            {error !== null && (
              <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.watermelonInk }}>
                {error}
              </Text>
            )}
            {selected !== null && (
              <View style={{ paddingTop: 8, paddingBottom: 4 }}>
                <MonthPicker months={months} selected={selected} onSelect={setMonthKey} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          sessions !== null ? (
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
              No sessions yet. Hit Log a session and your first one takes about a minute.
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
            <SessionCard session={item} title={sessionTitle(item)} badge={sessionBadge(item)} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
