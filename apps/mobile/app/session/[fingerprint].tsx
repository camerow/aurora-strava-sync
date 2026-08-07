import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CLIMB_SORTS,
  useSessionDetail,
  type ClimbFilter,
  type ClimbSort,
  type ClimbVM,
} from "@sendtally/features/session-detail";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { useApi } from "../../lib/api";

const RESULT_BADGES: Record<
  ClimbVM["result"],
  { label: string; bg: string; border: string; color: string }
> = {
  flash: { label: "FLASH", bg: colors.gold, border: colors.gold, color: colors.gunmetal },
  sent: {
    label: "SENT",
    bg: "transparent",
    border: "rgba(64,63,76,0.25)",
    color: colors.textSecondary,
  },
  project: {
    label: "PROJECT",
    bg: "transparent",
    border: "rgba(64,63,76,0.15)",
    color: colors.textFaint,
  },
};

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        minHeight: 40,
        justifyContent: "center",
        borderRadius: 22,
        backgroundColor: active ? colors.gold : "transparent",
        borderWidth: 1,
        borderColor: active ? colors.gold : "rgba(64,63,76,0.18)",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 11,
          letterSpacing: 0.6,
          color: active ? colors.gunmetal : "rgba(64,63,76,0.65)",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function SessionDetailScreen(): React.ReactElement {
  const { fingerprint } = useLocalSearchParams<{ fingerprint: string }>();
  const api = useApi();
  const { state, filter, setFilter, sort, setSort } = useSessionDetail(api, fingerprint ?? "");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 12 }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: 44,
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 12,
                letterSpacing: 0.5,
                color: colors.watermelonInk,
              }}
            >
              ← SESSIONS
            </Text>
          </Pressable>
          {state.status === "ready" && state.data.vm.stravaUrl !== null && (
            <Pressable
              onPress={() => void Linking.openURL(state.data.vm.stravaUrl ?? "")}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: 12,
                  letterSpacing: 0.5,
                  color: colors.watermelonInk,
                }}
              >
                STRAVA ↗
              </Text>
            </Pressable>
          )}
        </View>

        {state.status === "loading" && <ActivityIndicator color={colors.gunmetal} />}
        {state.status === "error" && (
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.watermelonInk }}>
            Could not load this session.
          </Text>
        )}
        {state.status === "ready" && (
          <>
            <View style={{ gap: 5 }}>
              <Text
                style={{
                  fontFamily: fonts.sansSemiBold,
                  fontSize: 20,
                  letterSpacing: -0.2,
                  color: colors.gunmetal,
                }}
              >
                {state.data.vm.title}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: 10,
                  letterSpacing: 0.6,
                  color: colors.textMuted,
                }}
              >
                {state.data.vm.meta}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 1,
                backgroundColor: colors.lineOnLight,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {state.data.vm.stats.map((st) => (
                <View
                  key={st.label}
                  style={{
                    width: "33%",
                    flexGrow: 1,
                    gap: 4,
                    backgroundColor: colors.surfaceSoft,
                    paddingVertical: 11,
                    paddingHorizontal: 13,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.monoMedium,
                      fontSize: 9,
                      letterSpacing: 0.7,
                      color: colors.textMuted,
                    }}
                  >
                    {st.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.monoSemiBold,
                      fontSize: 16,
                      color: st.accent ? colors.watermelonInk : colors.gunmetal,
                    }}
                  >
                    {st.value}
                  </Text>
                </View>
              ))}
            </View>

            {state.data.vm.bars.length > 0 && (
              <View
                style={{
                  backgroundColor: colors.white,
                  borderWidth: 1,
                  borderColor: colors.lineOnLightSoft,
                  borderRadius: radius.card,
                  padding: 16,
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.monoMedium,
                    fontSize: 10,
                    letterSpacing: 0.7,
                    color: colors.watermelonInk,
                  }}
                >
                  SENDS BY GRADE
                </Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5 }}>
                  {state.data.vm.bars.map((b) => (
                    <View key={b.gradeLabel} style={{ flex: 1, alignItems: "center", gap: 5 }}>
                      <View
                        style={{
                          width: "100%",
                          height: b.height === 0 ? 4 : Math.max(9, Math.round(b.height * 56)),
                          backgroundColor:
                            b.height === 0
                              ? colors.dataBarEmpty
                              : b.peak
                                ? colors.watermelon
                                : colors.azure,
                          borderTopLeftRadius: 3,
                          borderTopRightRadius: 3,
                        }}
                      />
                      <Text
                        style={{
                          fontFamily: fonts.monoMedium,
                          fontSize: 10,
                          color: colors.textSecondary,
                        }}
                      >
                        {b.gradeLabel}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {(
                [
                  ["all", `ALL ${state.data.vm.filterCounts.all}`],
                  ["sent", `SENT ${state.data.vm.filterCounts.sent}`],
                  ["flash", `FLASHED ${state.data.vm.filterCounts.flash}`],
                  ["project", `PROJECTS ${state.data.vm.filterCounts.project}`],
                ] as Array<[ClimbFilter, string]>
              ).map(([value, label]) => (
                <Chip
                  key={value}
                  label={label}
                  active={filter === value}
                  onPress={() => setFilter(value)}
                />
              ))}
            </ScrollView>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {CLIMB_SORTS.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label.toUpperCase()}
                  active={sort === s.value}
                  onPress={() => setSort(s.value as ClimbSort)}
                />
              ))}
            </ScrollView>

            <View>
              {state.data.climbs.map((c) => {
                const badge = RESULT_BADGES[c.result];
                return (
                  <View
                    key={c.n}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.lineOnLight,
                    }}
                  >
                    <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: fonts.sansMedium,
                          fontSize: 15,
                          color: colors.gunmetal,
                        }}
                      >
                        {c.name}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.mono,
                          fontSize: 11,
                          color: "rgba(64,63,76,0.6)",
                        }}
                      >
                        {c.angleLabel} · {c.burns} {c.burns === 1 ? "BURN" : "BURNS"} · REST{" "}
                        {c.restLabel}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 5 }}>
                      <Text
                        style={{
                          fontFamily: fonts.monoSemiBold,
                          fontSize: 14,
                          color: c.isTopSend ? colors.watermelonInk : colors.gunmetal,
                        }}
                      >
                        {c.gradeLabel}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.monoMedium,
                          fontSize: 9,
                          letterSpacing: 0.7,
                          borderRadius: radius.pill,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          overflow: "hidden",
                          backgroundColor: badge.bg,
                          borderWidth: 1,
                          borderColor: badge.border,
                          color: badge.color,
                        }}
                      >
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 9,
                letterSpacing: 0.7,
                color: colors.textMuted,
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: colors.lineOnLight,
              }}
            >
              {state.data.vm.syncLine}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
