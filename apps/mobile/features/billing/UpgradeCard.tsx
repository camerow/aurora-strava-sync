import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { MEMBERSHIP_URL } from "../../lib/billing";

export type UpgradeCardProps = {
  title: string;
  body: string;
  points?: string[];
};

export function UpgradeCard({ title, body, points = [] }: UpgradeCardProps): React.ReactElement {
  return (
    <View
      style={{
        backgroundColor: colors.petalTint,
        borderRadius: radius.card,
        padding: 20,
        gap: 12,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 10,
          letterSpacing: 0.8,
          color: colors.watermelonInk,
        }}
      >
        MEMBERS
      </Text>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 24,
          lineHeight: 28,
          letterSpacing: -0.6,
          color: colors.gunmetal,
        }}
      >
        {title}
      </Text>
      <Text
        style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.gunmetal }}
      >
        {body}
      </Text>
      {points.map((point) => (
        <Text
          key={point}
          style={{ fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.gunmetal }}
        >
          {`·  ${point}`}
        </Text>
      ))}
      <Pressable
        onPress={() => void Linking.openURL(MEMBERSHIP_URL)}
        style={{
          backgroundColor: colors.watermelonInk,
          borderRadius: radius.control,
          paddingVertical: 14,
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.white }}>
          See membership
        </Text>
      </Pressable>
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 11,
          lineHeight: 17,
          color: colors.textSecondary,
        }}
      >
        Subscriptions are managed on sendtally.com.
      </Text>
    </View>
  );
}
