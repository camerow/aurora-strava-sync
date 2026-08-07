import React from "react";
import { Pressable, Text, View } from "react-native";
import { TREND_RANGES, type TrendsFeature } from "@sendtally/features/trends";
import { BOARD_LABELS } from "@sendtally/features/session-detail";
import { colors, fonts, radius } from "@sendtally/design/tokens";

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
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.gold : "rgba(64,63,76,0.18)",
        backgroundColor: active ? colors.gold : "transparent",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 10,
          letterSpacing: 0.6,
          color: active ? colors.gunmetal : "rgba(64,63,76,0.65)",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function TrendFilters({ feature }: { feature: TrendsFeature }): React.ReactElement {
  const { range, setRange, board, setBoard, boards } = feature;
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {TREND_RANGES.map((r) => (
          <Chip
            key={r.value}
            label={r.label}
            active={range === r.value}
            onPress={() => setRange(r.value)}
          />
        ))}
      </View>
      {boards.length > 1 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip label="ALL BOARDS" active={board === null} onPress={() => setBoard(null)} />
          {boards.map((b) => (
            <Chip
              key={b}
              label={(BOARD_LABELS[b] ?? b).toUpperCase()}
              active={board === b}
              onPress={() => setBoard(b)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
