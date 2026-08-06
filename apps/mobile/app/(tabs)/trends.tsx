import React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts } from "@sendtally/design/tokens";
import { Logo } from "../../components/Logo";

export default function Trends(): React.ReactElement {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 12, gap: 14 }}>
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
            Trends
          </Text>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 10,
              letterSpacing: 0.8,
              color: colors.textMuted,
            }}
          >
            COMING SOON
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fonts.sans,
            fontSize: 14,
            lineHeight: 21,
            color: colors.textSecondary,
          }}
        >
          Volume, grade pyramid, hardest send, flash rate. Once a few sessions are in, the numbers
          start meaning something.
        </Text>
      </View>
    </SafeAreaView>
  );
}
