import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { DELETE_CONFIRMATION_WORD, type DeleteAccountFeature } from "@sendtally/features/settings";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import {
  bodyText,
  dangerButton,
  dangerButtonLabel,
  messageText,
  sectionLabel,
  underlineLabel,
  underlinePress,
} from "./styles";

export type DeleteAccountSectionProps = {
  deletion: DeleteAccountFeature;
};

export function DeleteAccountSection({ deletion }: DeleteAccountSectionProps): React.ReactElement {
  const busy = deletion.status === "deleting" || deletion.status === "deleted";
  return (
    <View style={{ gap: 12 }}>
      <Text style={sectionLabel}>DELETE ACCOUNT</Text>
      <Text style={bodyText}>
        Deleting removes every session you have logged, disconnects Strava, and closes your sign-in.
        Activities already posted to Strava stay on Strava. This cannot be undone.
      </Text>
      {deletion.status === "idle" ? (
        <Pressable onPress={deletion.open} style={dangerButton}>
          <Text style={dangerButtonLabel}>Delete account</Text>
        </Pressable>
      ) : (
        <>
          <Text style={bodyText}>Type {DELETE_CONFIRMATION_WORD} to confirm.</Text>
          <TextInput
            value={deletion.confirmation}
            onChangeText={deletion.setConfirmation}
            editable={!busy}
            autoCapitalize="characters"
            autoCorrect={false}
            style={{
              fontFamily: fonts.mono,
              fontSize: 14,
              color: colors.gunmetal,
              borderWidth: 1,
              borderColor: colors.lineOnLight,
              borderRadius: radius.control,
              paddingHorizontal: 12,
              minHeight: 44,
            }}
          />
          <Pressable
            onPress={deletion.confirm}
            disabled={!deletion.canConfirm || busy}
            style={{ ...dangerButton, opacity: !deletion.canConfirm || busy ? 0.5 : 1 }}
          >
            <Text style={dangerButtonLabel}>{busy ? "Deleting…" : "Delete my account"}</Text>
          </Pressable>
          <Pressable onPress={deletion.cancel} disabled={busy} style={underlinePress}>
            <Text style={{ ...underlineLabel, fontSize: 12 }}>Cancel</Text>
          </Pressable>
        </>
      )}
      {deletion.error !== null && <Text style={messageText}>{deletion.error}</Text>}
    </View>
  );
}
