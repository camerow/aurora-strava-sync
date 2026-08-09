import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSyncSettings } from "@sendtally/features/sync-settings";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { Logo } from "../../components/Logo";
import { BoardCard } from "../../features/sync/BoardCard";
import { useApi } from "../../lib/api";

function SectionCard({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceSoft,
        borderWidth: 1,
        borderColor: colors.lineOnLightSoft,
        borderRadius: radius.card,
        padding: 18,
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}

function SectionLabel({ children }: { children: string }): React.ReactElement {
  return (
    <Text
      style={{
        fontFamily: fonts.monoMedium,
        fontSize: 10,
        letterSpacing: 0.8,
        color: colors.watermelonInk,
      }}
    >
      {children}
    </Text>
  );
}

function BodyText({ children }: { children: string }): React.ReactElement {
  return (
    <Text
      style={{
        fontFamily: fonts.sans,
        fontSize: 13,
        lineHeight: 20,
        color: colors.textSecondary,
      }}
    >
      {children}
    </Text>
  );
}

function MonoMuted({ children }: { children: string }): React.ReactElement {
  return (
    <Text
      style={{
        fontFamily: fonts.monoMedium,
        fontSize: 10,
        letterSpacing: 0.6,
        color: colors.textMuted,
      }}
    >
      {children}
    </Text>
  );
}

export default function Sync(): React.ReactElement {
  const api = useApi();
  const clerk = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const {
    vm,
    ready,
    syncBoard,
    postingBoard,
    setPosting,
    scheduleBusy,
    setSchedule,
    message,
    messageBoard,
  } = useSyncSettings(api);

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
          <MonoMuted>{vm.headerBadge}</MonoMuted>
        </View>

        <SectionCard>
          <SectionLabel>SCHEDULED SYNC</SectionLabel>
          <BodyText>
            {vm.autoSync
              ? "Automatic daily sync is on - the server checks your boards once a day and imports anything new."
              : "Automatic sync is off. Sync each board by hand below, or turn on a once-a-day automatic check."}
          </BodyText>
          <Pressable
            onPress={() => void setSchedule(vm.autoSync ? "off" : "daily")}
            disabled={scheduleBusy || !ready}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                letterSpacing: 0.6,
                color: vm.autoSync ? "rgba(64,63,76,0.6)" : colors.azureInk,
                textDecorationLine: "underline",
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
                <Text
                  style={{ fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.gunmetal }}
                >
                  {b.label}
                </Text>
                <MonoMuted>{b.statusLabel}</MonoMuted>
              </View>
            ))
          ) : (
            <BodyText>
              Connect a board on the web at sendtally.com and the daily sync covers it.
            </BodyText>
          )}
          <MonoMuted>{vm.lastSyncLabel}</MonoMuted>
          {messageBoard === null && message !== null && (
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                lineHeight: 17,
                color: colors.textSecondary,
              }}
            >
              {message}
            </Text>
          )}
        </SectionCard>

        <SectionCard>
          <SectionLabel>CONNECTED BOARDS</SectionLabel>
          {vm.hasBoards ? (
            vm.boards.map((b) => (
              <BoardCard
                key={b.board}
                board={b}
                stravaActive={vm.stravaActive}
                postingBusy={postingBoard !== null}
                message={messageBoard === b.board ? message : null}
                onSync={() => void syncBoard(b.board)}
                onPosting={(mode) => void setPosting(b.board, mode)}
              />
            ))
          ) : (
            <BodyText>Connect a board on the web at sendtally.com and it appears here.</BodyText>
          )}
        </SectionCard>

        <SectionCard>
          <SectionLabel>STRAVA</SectionLabel>
          <MonoMuted>{vm.stravaStatusLabel}</MonoMuted>
          <BodyText>
            {vm.stravaActive
              ? "Choose per board above which sessions post to your Strava feed."
              : "Connect Strava on the web at sendtally.com, then choose per board what gets posted."}
          </BodyText>
        </SectionCard>

        <SectionCard>
          <SectionLabel>ACCOUNT</SectionLabel>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>
            {user?.primaryEmailAddress?.emailAddress ?? ""}
          </Text>
          <BodyText>Board and Strava connections are managed on the web at sendtally.com.</BodyText>
          <Pressable
            onPress={() => {
              void clerk.signOut().then(() => router.replace("/sign-in"));
            }}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                color: "rgba(64,63,76,0.6)",
                textDecorationLine: "underline",
              }}
            >
              Sign out
            </Text>
          </Pressable>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
