import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors, fonts } from "@sendtally/design/tokens";

export function LogoMark({ size = 24 }: { size?: number }): React.ReactElement {
  return (
    <Svg viewBox="0 0 32 32" width={size} height={size}>
      <Rect width={32} height={32} rx={8} fill={colors.gold} />
      <Path
        d="M9.5 22.5 16 16l6.5-6.5"
        fill="none"
        stroke={colors.gunmetal}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={9.5} cy={22.5} r={3.1} fill={colors.gunmetal} />
      <Circle cx={16} cy={16} r={3.1} fill={colors.gunmetal} />
      <Circle cx={22.5} cy={9.5} r={3.1} fill={colors.gunmetal} />
    </Svg>
  );
}

export function Logo({ size = 24 }: { size?: number }): React.ReactElement {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: Math.round(size * 0.375) }}>
      <LogoMark size={size} />
      <Text
        style={{
          fontFamily: fonts.monoSemiBold,
          fontSize: Math.round(size * 0.59375),
          letterSpacing: -0.3,
          color: colors.gunmetal,
        }}
      >
        sendtally
      </Text>
    </View>
  );
}
