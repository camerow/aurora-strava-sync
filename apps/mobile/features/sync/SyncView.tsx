import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { StravaPostingMode, SyncScheduleMode } from "@sendtally/api-client";
import type { SyncSettingsVM } from "@sendtally/features/sync-settings";
import { colors, fonts } from "@sendtally/design/tokens";
import { Logo } from "../../components/Logo";
import { BoardCard } from "./BoardCard";
import {
  bodyText,
  boardName,
  messageText,
  monoMuted,
  sectionCard,
  sectionLabel,
  underlineLabel,
  underlinePress,
} from "./styles";

export type SyncViewProps = {
  vm: SyncSettingsVM;
  ready: boolean;
  scheduleBusy: boolean;
  postingBusy: boolean;
  message: string | null;
  messageBoard: string | null;
  email: string;
  onSchedule: (mode: SyncScheduleMode) => void;
  onSync: (board: string) => void;
  onPosting: (board: string, mode: StravaPostingMode) => void;
  onSignOut: () => void;
};

export function SyncView({
  vm,
  ready,
  scheduleBusy,
  postingBusy,
  message,
  messageBoard,
  email,
  onSchedule,
  onSync,
  onPosting,
  onSignOut,
}: SyncViewProps): React.ReactElement {
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
            Sync
          </Text>
          <Text style={monoMuted}>{vm.headerBadge}</Text>
        </View>

        <View style={sectionCard}>
          <Text style={sectionLabel}>SCHEDULED SYNC</Text>
          <Text style={bodyText}>
            {vm.autoSync
              ? "Automatic daily sync is on - the server checks your boards once a day and imports anything new."
              : "Automatic sync is off. Sync each board by hand below, or turn on a once-a-day automatic check."}
          </Text>
          <Pressable
            onPress={() => onSchedule(vm.autoSync ? "off" : "daily")}
            disabled={scheduleBusy || !ready}
            style={underlinePress}
          >
            <Text
              style={{
                ...underlineLabel,
                fontSize: 12,
                color: vm.autoSync ? "rgba(64,63,76,0.6)" : colors.azureInk,
              }}
            >
              {vm.autoSync ? "TURN OFF DAILY SYNC" : "TURN ON DAILY SYNC"}
            </Text>
          </Pressable>
          {vm.hasBoards ? (
            vm.boards.map((b) => (
              <View
                key={b.board}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Text style={boardName}>{b.label}</Text>
                <Text style={monoMuted}>{b.statusLabel}</Text>
              </View>
            ))
          ) : (
            <Text style={bodyText}>
              Connect a board on the web at sendtally.com and the daily sync covers it.
            </Text>
          )}
          <Text style={monoMuted}>{vm.lastSyncLabel}</Text>
          {messageBoard === null && message !== null && <Text style={messageText}>{message}</Text>}
        </View>

        <View style={sectionCard}>
          <Text style={sectionLabel}>CONNECTED BOARDS</Text>
          {vm.hasBoards ? (
            vm.boards.map((b) => (
              <BoardCard
                key={b.board}
                board={b}
                stravaActive={vm.stravaActive}
                postingBusy={postingBusy}
                message={messageBoard === b.board ? message : null}
                onSync={() => onSync(b.board)}
                onPosting={(mode) => onPosting(b.board, mode)}
              />
            ))
          ) : (
            <Text style={bodyText}>
              Connect a board on the web at sendtally.com and it appears here.
            </Text>
          )}
        </View>

        <View style={sectionCard}>
          <Text style={sectionLabel}>STRAVA</Text>
          <Text style={monoMuted}>{vm.stravaStatusLabel}</Text>
          <Text style={bodyText}>
            {vm.stravaActive
              ? "Choose per board above which sessions post to your Strava feed."
              : "Connect Strava on the web at sendtally.com, then choose per board what gets posted."}
          </Text>
        </View>

        <View style={sectionCard}>
          <Text style={sectionLabel}>ACCOUNT</Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>
            {email}
          </Text>
          <Text style={bodyText}>
            Board and Strava connections are managed on the web at sendtally.com.
          </Text>
          <Pressable onPress={onSignOut} style={underlinePress}>
            <Text style={{ ...underlineLabel, fontSize: 12 }}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
