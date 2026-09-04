import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  MONTH_SHORT_NAMES,
  adjacentSessionMonths,
  monthsOfYear,
  sessionYears,
  type SessionMonth,
} from "@sendtally/features/sessions";
import { colors, fonts, radius } from "@sendtally/design/tokens";

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: (() => void) | null;
}): React.ReactElement {
  const empty = onPress === null;
  return (
    <Pressable
      disabled={empty}
      onPress={onPress ?? undefined}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: empty }}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.gold : empty ? colors.lineOnLightSoft : "rgba(64,63,76,0.18)",
        backgroundColor: active ? colors.gold : "transparent",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 11,
          letterSpacing: 0.7,
          color: active ? colors.gunmetal : empty ? "rgba(64,63,76,0.28)" : "rgba(64,63,76,0.65)",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Arrow({
  target,
  label,
  glyph,
  onSelect,
}: {
  target: SessionMonth | null;
  label: string;
  glyph: string;
  onSelect: (key: string) => void;
}): React.ReactElement {
  const enabled = target !== null;
  return (
    <Pressable
      disabled={!enabled}
      onPress={() => target !== null && onSelect(target.key)}
      accessibilityRole="button"
      accessibilityLabel={target === null ? label : `${label}: ${target.label}`}
      hitSlop={8}
      style={{
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: "rgba(64,63,76,0.18)",
        backgroundColor: enabled ? colors.surfaceSoft : "transparent",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.monoSemiBold,
          fontSize: 16,
          color: enabled ? colors.gunmetal : "rgba(64,63,76,0.25)",
        }}
      >
        {glyph}
      </Text>
    </Pressable>
  );
}

export function MonthPicker({
  months,
  selected,
  onSelect,
}: {
  months: SessionMonth[];
  selected: SessionMonth;
  onSelect: (key: string) => void;
}): React.ReactElement {
  const { newer, older } = adjacentSessionMonths(months, selected.key);
  const years = sessionYears(months);
  const count = selected.sessions.length;

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Arrow target={older} label="Older month" glyph="‹" onSelect={onSelect} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 20,
              letterSpacing: -0.4,
              color: colors.gunmetal,
            }}
          >
            {selected.label}
          </Text>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 10,
              letterSpacing: 0.8,
              color: colors.textMuted,
            }}
          >
            {count === 1 ? "1 SESSION" : `${count} SESSIONS`}
          </Text>
        </View>
        <Arrow target={newer} label="Newer month" glyph="›" onSelect={onSelect} />
      </View>
      {years.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {years.map((year) => {
            const active = year === selected.year;
            const first = months.find((m) => m.year === year);
            return first === undefined ? null : (
              <Chip
                key={year}
                label={String(year)}
                active={active}
                onPress={() => onSelect(active ? selected.key : first.key)}
              />
            );
          })}
        </ScrollView>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {monthsOfYear(months, selected.year).map((month, i) => (
          <Chip
            key={i}
            label={MONTH_SHORT_NAMES[i] ?? ""}
            active={month !== null && month.key === selected.key}
            onPress={month === null ? null : () => onSelect(month.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
