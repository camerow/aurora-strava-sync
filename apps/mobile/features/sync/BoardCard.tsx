import React from "react";
import { Pressable, Text, View } from "react-native";
import type { StravaPostingMode } from "@sendtally/api-client";
import type { BoardCardVM } from "@sendtally/features/sync-settings";
import { colors, fonts, radius } from "@sendtally/design/tokens";

export type BoardCardProps = {
  board: BoardCardVM;
  stravaActive: boolean;
  postingBusy: boolean;
  message: string | null;
  onSync: () => void;
  onPosting: (mode: StravaPostingMode) => void;
};

export function BoardCard({
  board,
  stravaActive,
  postingBusy,
  message,
  onSync,
  onPosting,
}: BoardCardProps): React.ReactElement {
  return (
    <View
      style={{
        gap: 10,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: colors.lineOnLight,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.gunmetal }}>
          {board.label}
        </Text>
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: 9,
            letterSpacing: 0.7,
            color: colors.textMuted,
          }}
        >
          {board.statusLabel}
        </Text>
      </View>

      {board.isActive && (
        <Pressable
          onPress={onSync}
          disabled={board.syncDisabled}
          style={{
            backgroundColor: colors.azureInk,
            borderRadius: radius.control,
            paddingVertical: 14,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            opacity: board.syncDisabled ? 0.45 : 1,
          }}
        >
          <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.white }}>
            {board.syncing ? "Syncing…" : "Sync now"}
          </Text>
        </Pressable>
      )}

      {board.isActive &&
        (stravaActive ? (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 9,
                letterSpacing: 0.7,
                color: colors.textMuted,
              }}
            >
              {board.postingLabel}
            </Text>
            {board.postingEnabled ? (
              <Pressable
                onPress={() => onPosting("off")}
                disabled={postingBusy}
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
                  TURN OFF STRAVA POSTING
                </Text>
              </Pressable>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Pressable
                  onPress={() => onPosting("new")}
                  disabled={postingBusy}
                  style={{
                    backgroundColor: colors.azureInk,
                    borderRadius: radius.control,
                    paddingHorizontal: 14,
                    minHeight: 44,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.white }}
                  >
                    Post new sessions
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onPosting("all")}
                  disabled={postingBusy}
                  style={{
                    backgroundColor: colors.watermelonInk,
                    borderRadius: radius.control,
                    paddingHorizontal: 14,
                    minHeight: 44,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.white }}
                  >
                    Post full history
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 13,
              lineHeight: 20,
              color: colors.textSecondary,
            }}
          >
            Connect Strava on the web at sendtally.com to post this board&rsquo;s sessions.
          </Text>
        ))}

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
    </View>
  );
}
