import React from "react";
import { Pressable, Text, View } from "react-native";
import type { StravaPostingMode } from "@sendtally/api-client";
import type { BoardCardVM } from "@sendtally/features/sync-settings";
import { colors } from "@sendtally/design/tokens";
import {
  bodyText,
  boardName,
  chipButton,
  chipButtonLabel,
  messageText,
  monoMuted,
  primaryButton,
  primaryButtonLabel,
  underlineLabel,
  underlinePress,
} from "./styles";

export type BoardCardProps = {
  board: BoardCardVM;
  stravaActive: boolean;
  stravaConnected: boolean;
  postingBusy: boolean;
  message: string | null;
  onSync: () => void;
  onPosting: (mode: StravaPostingMode) => void;
};

export function BoardCard({
  board,
  stravaActive,
  stravaConnected,
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
        <Text style={boardName}>{board.label}</Text>
        <Text style={monoMuted}>{board.statusLabel}</Text>
      </View>

      {board.isActive && (
        <Pressable
          onPress={onSync}
          disabled={board.syncDisabled}
          style={{ ...primaryButton, opacity: board.syncDisabled ? 0.45 : 1 }}
        >
          <Text style={primaryButtonLabel}>{board.syncing ? "Syncing…" : "Sync now"}</Text>
        </Pressable>
      )}

      {board.isActive &&
        (stravaActive ? (
          <View style={{ gap: 8 }}>
            <Text style={monoMuted}>{board.postingLabel}</Text>
            {board.postingEnabled ? (
              <Pressable
                onPress={() => onPosting("off")}
                disabled={postingBusy}
                style={underlinePress}
              >
                <Text style={underlineLabel}>TURN OFF STRAVA POSTING</Text>
              </Pressable>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Pressable
                  onPress={() => onPosting("new")}
                  disabled={postingBusy}
                  style={chipButton}
                >
                  <Text style={chipButtonLabel}>Post new sessions</Text>
                </Pressable>
                <Pressable
                  onPress={() => onPosting("all")}
                  disabled={postingBusy}
                  style={{ ...chipButton, backgroundColor: colors.watermelonInk }}
                >
                  <Text style={chipButtonLabel}>Post full history</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <Text style={bodyText}>
            {stravaConnected
              ? "Strava access has lapsed. Re-link it on the web at sendtally.com to resume posting this board’s sessions."
              : "Connect Strava on the web at sendtally.com to post this board’s sessions."}
          </Text>
        ))}

      {message !== null && <Text style={messageText}>{message}</Text>}
    </View>
  );
}
