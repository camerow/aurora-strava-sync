import { router } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTrends } from "@sendtally/features/trends";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { useApi } from "../../lib/api";
import { TrendBars } from "./TrendBars";
import { TrendFilters } from "./TrendFilters";

export function TrendsList(): React.ReactElement {
  const api = useApi();
  const feature = useTrends(api);
  const { state } = feature;

  return (
    <>
      <View style={{ gap: 4 }}>
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: 32,
            letterSpacing: -1,
            color: colors.gunmetal,
          }}
        >
          Trends
        </Text>
        {state.status === "ready" && (
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 10,
              letterSpacing: 0.8,
              color: colors.textMuted,
            }}
          >
            {state.data.caption}
          </Text>
        )}
      </View>
      <TrendFilters feature={feature} />
      {state.status === "loading" && <ActivityIndicator color={colors.gunmetal} />}
      {state.status === "error" && (
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.watermelonInk }}>
          Could not load trends. Pull to retry.
        </Text>
      )}
      {state.status === "ready" &&
        state.data.tiles.map((t) => (
          <Pressable
            key={t.metric}
            onPress={() => router.push(`/trend/${t.metric}`)}
            style={{
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.lineOnLightSoft,
              borderRadius: radius.card,
              paddingVertical: 18,
              paddingHorizontal: 20,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
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
                {t.label}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.monoMedium,
                  fontSize: 9,
                  letterSpacing: 0.7,
                  color: colors.textSecondary,
                }}
              >
                DETAILS →
              </Text>
            </View>
            <Text
              style={{
                fontFamily: fonts.display,
                fontSize: 26,
                letterSpacing: -0.5,
                color: colors.gunmetal,
              }}
            >
              {t.value}
            </Text>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 10,
                letterSpacing: 0.5,
                color: colors.textSecondary,
              }}
            >
              {t.caption}
            </Text>
            <View style={{ marginTop: 2 }}>
              <TrendBars bars={t.bars} height={38} />
            </View>
          </Pressable>
        ))}
    </>
  );
}
