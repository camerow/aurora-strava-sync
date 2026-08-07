import React from "react";
import { Text, View } from "react-native";
import type { TrendBarVM } from "@sendtally/features/trends";
import { colors, fonts } from "@sendtally/design/tokens";

export function TrendBars({
  bars,
  height,
  showValues = false,
}: {
  bars: TrendBarVM[];
  height: number;
  showValues?: boolean;
}): React.ReactElement {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
      {bars.map((b, i) => (
        <View key={i} style={{ flex: 1, alignItems: "center", gap: 3 }}>
          {showValues && (
            <Text
              style={{ fontFamily: fonts.monoMedium, fontSize: 8, color: colors.textSecondary }}
            >
              {b.valueLabel}
            </Text>
          )}
          <View
            style={{
              width: "100%",
              height: b.height === 0 ? 4 : Math.max(6, Math.round(b.height * height)),
              backgroundColor:
                b.height === 0 ? colors.dataBarEmpty : b.peak ? colors.watermelon : colors.azure,
              borderTopLeftRadius: 3,
              borderTopRightRadius: 3,
            }}
          />
          {showValues && (
            <Text
              style={{ fontFamily: fonts.monoMedium, fontSize: 8, color: colors.textSecondary }}
            >
              {b.axisLabel}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
