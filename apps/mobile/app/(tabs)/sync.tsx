import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ConnectionStatus } from "@sendtally/api-client";
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
  const [status, setStatus] = React.useState<ConnectionStatus | null>(null);
  const [syncState, setSyncState] = React.useState<"idle" | "queued">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      setStatus(await api.status());
    } catch {
      setMessage("Could not reach sendtally.");
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function syncNow(): Promise<void> {
    setSyncState("queued");
    setMessage(null);
    try {
      await api.syncNow();
      setMessage("Sync queued - new sessions land in about a minute.");
    } catch {
      setMessage("Could not queue a sync. Try again.");
    }
    setTimeout(() => {
      setSyncState("idle");
      void load();
    }, 6000);
  }

  async function setPosting(mode: "off" | "new" | "all"): Promise<void> {
    try {
      await api.setStravaPosting(mode);
      await load();
    } catch {
      setMessage("Could not update Strava posting.");
    }
  }

  const boardName = status?.board?.board;
  const postingOn = status?.strava?.status === "active" && status.strava.postingEnabled;
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
            {postingOn
              ? "STRAVA + BOARD"
              : boardName !== undefined
                ? "BOARD ONLY"
                : "NOT CONNECTED"}
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
            Automatic. The server checks your board every 15 minutes and imports anything new -
            nothing to keep open on your phone.
          </Text>
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
          <Pressable
            onPress={() => void syncNow()}
            disabled={syncState === "queued"}
            style={{
              backgroundColor: colors.azureInk,
              borderRadius: radius.control,
              paddingVertical: 14,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              opacity: syncState === "queued" ? 0.45 : 1,
            }}
          >
            <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.white }}>
              {syncState === "queued" ? "Syncing…" : "Sync now"}
            </Text>
          </Pressable>
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
          {status?.strava == null || status.strava.status !== "active" ? (
            <Text
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                lineHeight: 20,
                color: colors.textSecondary,
              }}
            >
              Strava is not connected. Connect it on the web at sendtally.com, then choose here what
              gets posted.
            </Text>
          ) : (
            <>
              <Text
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  lineHeight: 20,
                  color: colors.textSecondary,
                }}
              >
                {postingOn
                  ? "Posting is on - each session becomes one Rock Climbing activity."
                  : "Connected, but nothing posts until you say so."}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {postingOn ? (
                  <Pressable
                    onPress={() => void setPosting("off")}
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
                      onPress={() => void setPosting("new")}
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
                      onPress={() => void setPosting("all")}
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
            </>
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
