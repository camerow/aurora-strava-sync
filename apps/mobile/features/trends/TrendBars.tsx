import React from "react";
import { Text, View } from "react-native";
import type { TrendBarVM } from "@sendtally/features/trends";
import { colors, fonts } from "@sendtally/design/tokens";

const BAR_GAP = 4;
const VALUE_BAND = 12;
const AXIS_BAND = 14;
const Y_AXIS_WIDTH = 30;

const labelStyle = {
  fontFamily: fonts.monoMedium,
  fontSize: 8,
  lineHeight: 10,
  color: colors.textSecondary,
} as const;

function tickTop(height: number, i: number, count: number): number {
  return VALUE_BAND + (height * i) / Math.max(1, count - 1);
}

export function TrendBars({
  bars,
  height,
  showValues = false,
  yTicks = [],
}: {
  bars: TrendBarVM[];
  height: number;
  showValues?: boolean;
  yTicks?: string[];
}): React.ReactElement {
  const valueBand = showValues ? VALUE_BAND : 0;

  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {showValues && (
        <View style={{ width: Y_AXIS_WIDTH, height: height + VALUE_BAND + AXIS_BAND }}>
          {yTicks.map((t, i) => (
            <Text
              key={i}
              style={[
                labelStyle,
                {
                  position: "absolute",
                  right: 0,
                  top: tickTop(height, i, yTicks.length) - 5,
                  textAlign: "right",
                },
              ]}
            >
              {t}
            </Text>
          ))}
        </View>
      )}

      <View style={{ flex: 1 }}>
        <View style={{ height: height + valueBand }}>
          {showValues &&
            yTicks.map((_, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: tickTop(height, i, yTicks.length),
                  borderTopWidth: 1,
                  borderTopColor: colors.dataBarEmpty,
                }}
              />
            ))}
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "flex-end",
              gap: BAR_GAP,
            }}
          >
            {bars.map((b, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
                {showValues && (
                  <Text numberOfLines={1} style={[labelStyle, { height: VALUE_BAND }]}>
                    {b.valueLabel}
                  </Text>
                )}
                <View
                  style={{
                    width: "100%",
                    height: b.height === 0 ? 4 : Math.max(6, Math.round(b.height * height)),
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
              </View>
            ))}
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: BAR_GAP,
            height: AXIS_BAND,
            borderTopWidth: 1,
            borderTopColor: colors.dataBarEmpty,
            paddingTop: 2,
          }}
        >
          {bars.map((b, i) => (
            <Text key={i} numberOfLines={1} style={[labelStyle, { flex: 1, textAlign: "center" }]}>
              {b.axisLabel}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}
