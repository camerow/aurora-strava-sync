import React from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts } from "@sendtally/design/tokens";
import { Text } from "react-native";
import { Logo } from "../../components/Logo";
import { UpgradeCard } from "../../features/billing/UpgradeCard";
import { TrendsList } from "../../features/trends/TrendsList";
import { INSIGHTS_FEATURE, useHasFeature } from "../../lib/billing";

export default function Trends(): React.ReactElement {
  const canSeeInsights = useHasFeature(INSIGHTS_FEATURE);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: 24,
          gap: 14,
        }}
      >
        <Logo size={18} />
        {canSeeInsights ? (
          <TrendsList />
        ) : (
          <View style={{ gap: 14 }}>
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
            <UpgradeCard
              title="Your sessions are adding up to something."
              body="Logging stays free. Membership unlocks the screens that read your whole history back to you."
              points={[
                "Volume - how much you actually climbed, week by week",
                "RPE - how hard your sessions have been feeling",
                "Average send grade - the drift a logbook never shows",
                "Flash rate - the first thing to move when your reading improves",
              ]}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
