import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSyncSettings } from "@sendtally/features/sync-settings";
import { BOARD_LABELS } from "@sendtally/features/session-detail";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { Logo } from "../../components/Logo";
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

export default function Sync(): React.ReactElement {
  const api = useApi();
  const clerk = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const {
    state,
    syncingBoard,
    syncBoard,
    postingBoard,
    setPosting,
    scheduleBusy,
    setSchedule,
    message,
  } = useSyncSettings(api);

  const status = state.status === "ready" ? state.data : null;
  const boards = status?.boards ?? [];
  const activeBoards = boards.filter((b) => b.status === "active");
  const stravaActive = status?.strava?.status === "active";
  const anyPostingOn = stravaActive && boards.some((b) => b.postingEnabled);
  const autoSync = status?.autoSync === true;
  const lastSync = status?.sync?.lastSyncedAt;

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
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 10,
              letterSpacing: 0.8,
              color: colors.textMuted,
            }}
          >
            {anyPostingOn ? "STRAVA + BOARD" : boards.length > 0 ? "BOARD ONLY" : "NOT CONNECTED"}
          </Text>
        </View>

        <SectionCard>
          <SectionLabel>SCHEDULE</SectionLabel>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 13,
              lineHeight: 20,
              color: colors.textSecondary,
            }}
          >
            {autoSync
              ? "Automatic daily sync is on - the server checks your boards once a day and imports anything new."
              : "Automatic sync is off. Sync each board below when you want, or turn on a once-a-day automatic check."}
          </Text>
          <Pressable
            onPress={() => void setSchedule(autoSync ? "off" : "daily")}
            disabled={scheduleBusy || status === null}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                letterSpacing: 0.6,
                color: autoSync ? "rgba(64,63,76,0.6)" : colors.azureInk,
                textDecorationLine: "underline",
              }}
            >
              {autoSync ? "TURN OFF DAILY SYNC" : "TURN ON DAILY SYNC"}
            </Text>
          </Pressable>
          <Text
            style={{
              fontFamily: fonts.monoMedium,
              fontSize: 10,
              letterSpacing: 0.6,
              color: colors.textMuted,
            }}
          >
            {lastSync != null
              ? `LAST SYNC ${new Date(lastSync).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).toUpperCase()}`
              : "FIRST IMPORT PENDING"}
          </Text>
        </SectionCard>

        <SectionCard>
          <SectionLabel>MANUAL SYNC</SectionLabel>
          {activeBoards.length === 0 ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                lineHeight: 20,
                color: colors.textSecondary,
              }}
            >
              Connect a board on the web at sendtally.com and its sync button appears here.
            </Text>
          ) : (
            activeBoards.map((b) => (
              <Pressable
                key={b.board}
                onPress={() => void syncBoard(b.board)}
                disabled={syncingBoard !== null}
                style={{
                  backgroundColor: colors.azureInk,
                  borderRadius: radius.control,
                  paddingVertical: 14,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: syncingBoard !== null ? 0.45 : 1,
                }}
              >
                <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.white }}>
                  {syncingBoard === b.board
                    ? "Syncing…"
                    : `Sync ${BOARD_LABELS[b.board] ?? "board"}`}
                </Text>
              </Pressable>
            ))
          )}
          {message !== null && (
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
          <SectionLabel>STRAVA POSTING</SectionLabel>
          {!stravaActive ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                lineHeight: 20,
                color: colors.textSecondary,
              }}
            >
              Strava is not connected. Connect it on the web at sendtally.com, then choose here per
              board what gets posted.
            </Text>
          ) : activeBoards.length === 0 ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                lineHeight: 20,
                color: colors.textSecondary,
              }}
            >
              Connect a board and choose per board what gets posted.
            </Text>
          ) : (
            activeBoards.map((b) => (
              <View key={b.board} style={{ gap: 8 }}>
                <View
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
                    {BOARD_LABELS[b.board] ?? b.board}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.monoMedium,
                      fontSize: 9,
                      letterSpacing: 0.7,
                      color: colors.textMuted,
                    }}
                  >
                    {b.postingEnabled ? "POSTING ON" : "POSTING OFF"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {b.postingEnabled ? (
                    <Pressable
                      onPress={() => void setPosting(b.board, "off")}
                      disabled={postingBoard !== null}
                      style={{ minHeight: 44, justifyContent: "center" }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.mono,
                          fontSize: 11,
                          letterSpacing: 0.6,
                          color: "rgba(64,63,76,0.6)",
                          textDecorationLine: "underline",
                        }}
                      >
                        TURN OFF
                      </Text>
                    </Pressable>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => void setPosting(b.board, "new")}
                        disabled={postingBoard !== null}
                        style={{
                          backgroundColor: colors.azureInk,
                          borderRadius: radius.control,
                          paddingHorizontal: 14,
                          minHeight: 44,
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.sansSemiBold,
                            fontSize: 13,
                            color: colors.white,
                          }}
                        >
                          Post new sessions
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void setPosting(b.board, "all")}
                        disabled={postingBoard !== null}
                        style={{
                          backgroundColor: colors.watermelonInk,
                          borderRadius: radius.control,
                          paddingHorizontal: 14,
                          minHeight: 44,
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.sansSemiBold,
                            fontSize: 13,
                            color: colors.white,
                          }}
                        >
                          Post full history
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            ))
          )}
        </SectionCard>

        <SectionCard>
          <SectionLabel>ACCOUNT</SectionLabel>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>
            {user?.primaryEmailAddress?.emailAddress ?? ""}
          </Text>
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 13,
              lineHeight: 20,
              color: colors.textSecondary,
            }}
          >
            Board and Strava connections are managed on the web at sendtally.com.
          </Text>
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
