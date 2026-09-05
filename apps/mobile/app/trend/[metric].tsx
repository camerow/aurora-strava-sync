import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTrends, type TrendMetric } from "@sendtally/features/trends";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { TrendBars } from "../../features/trends/TrendBars";
import { TrendFilters } from "../../features/trends/TrendFilters";
import { useApi } from "../../lib/api";
import { INSIGHTS_FEATURE, useHasFeature } from "../../lib/billing";
import { UpgradeCard } from "../../features/billing/UpgradeCard";

const METRICS: TrendMetric[] = ["volume", "pyramid", "hardest", "flash", "avggrade"];

export default function TrendDetailScreen(): React.ReactElement {
  const canSeeInsights = useHasFeature(INSIGHTS_FEATURE);
  return canSeeInsights ? <TrendDetail /> : <TrendDetailLocked />;
}

function TrendDetailLocked(): React.ReactElement {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, gap: 12 }}>
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
            ← TRENDS
          </Text>
        </Pressable>
        <UpgradeCard
          title="This one is for members."
          body="Membership unlocks volume, RPE, average send grade and flash rate across your whole history."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function TrendDetail(): React.ReactElement {
  const { metric: metricParam } = useLocalSearchParams<{ metric: string }>();
  const api = useApi();
  const feature = useTrends(api);
  const { state } = feature;
  const metric = METRICS.includes(metricParam as TrendMetric)
    ? (metricParam as TrendMetric)
    : "volume";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 12 }}
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
            ← TRENDS
          </Text>
        </Pressable>
        <TrendFilters feature={feature} />
        {state.status === "loading" && <ActivityIndicator color={colors.gunmetal} />}
        {state.status === "error" && (
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.watermelonInk }}>
            Could not load trends.
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
                {state.data.details[metric].title}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: 10,
                  letterSpacing: 0.6,
                  color: colors.textMuted,
                }}
              >
                {state.data.details[metric].caption}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.white,
                borderWidth: 1,
                borderColor: colors.lineOnLightSoft,
                borderRadius: radius.card,
                paddingVertical: 18,
                paddingHorizontal: 16,
              }}
            >
              <TrendBars
                bars={state.data.details[metric].bars}
                yTicks={state.data.details[metric].yTicks}
                height={140}
                showValues
              />
            </View>
            <View>
              {state.data.details[metric].specs.map((sp) => (
                <View
                  key={sp.k}
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    paddingVertical: 11,
                    borderTopWidth: 1,
                    borderTopColor: colors.lineOnLight,
                  }}
                >
                  <Text
                    style={{
                      width: 120,
                      fontFamily: fonts.monoMedium,
                      fontSize: 10,
                      letterSpacing: 0.7,
                      color: colors.watermelonInk,
                      paddingTop: 1,
                    }}
                  >
                    {sp.k}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: fonts.sans,
                      fontSize: 13,
                      color: colors.textSecondary,
                    }}
                  >
                    {sp.v}
                  </Text>
                </View>
              ))}
            </View>
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 14,
                lineHeight: 21,
                color: colors.textSecondary,
              }}
            >
              {state.data.details[metric].insight}
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
