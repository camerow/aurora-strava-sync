import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { SettingsVM } from "@sendtally/features/settings";
import { colors, fonts } from "@sendtally/design/tokens";
import { Logo } from "../../components/Logo";
import {
  bodyText,
  monoMuted,
  sectionCard,
  sectionLabel,
  underlineLabel,
  underlinePress,
} from "./styles";

export type SettingsViewProps = {
  vm: SettingsVM;
  email: string;
  onSignOut: () => void;
};

export function SettingsView({ vm, email, onSignOut }: SettingsViewProps): React.ReactElement {
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
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 32,
              letterSpacing: -1,
              color: colors.gunmetal,
            }}
          >
            Settings
          </Text>
          <Text style={monoMuted}>{vm.headerBadge}</Text>
        </View>

        <View style={sectionCard}>
          <Text style={sectionLabel}>STRAVA</Text>
          <Text style={monoMuted}>{vm.stravaStatusLabel}</Text>
          <Text style={bodyText}>
            {vm.stravaActive
              ? "Strava is linked. Sessions you log can post to your feed as Rock Climbing activities."
              : vm.stravaConnected
                ? "Strava access has lapsed. Re-link it on the web at sendtally.com."
                : "Connect Strava on the web at sendtally.com and your logged sessions can post to your feed."}
          </Text>
        </View>

        <View style={sectionCard}>
          <Text style={sectionLabel}>ACCOUNT</Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>
            {email}
          </Text>
          <Pressable onPress={onSignOut} style={underlinePress}>
            <Text style={{ ...underlineLabel, fontSize: 12 }}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
