import type { TextStyle, ViewStyle } from "react-native";
import { colors, fonts, radius } from "@sendtally/design/tokens";

export const sectionCard: ViewStyle = {
  backgroundColor: colors.surfaceSoft,
  borderWidth: 1,
  borderColor: colors.lineOnLightSoft,
  borderRadius: radius.card,
  padding: 18,
  gap: 12,
};

export const sectionLabel: TextStyle = {
  fontFamily: fonts.monoMedium,
  fontSize: 10,
  letterSpacing: 0.8,
  color: colors.watermelonInk,
};

export const bodyText: TextStyle = {
  fontFamily: fonts.sans,
  fontSize: 13,
  lineHeight: 20,
  color: colors.textSecondary,
};

export const monoMuted: TextStyle = {
  fontFamily: fonts.monoMedium,
  fontSize: 10,
  letterSpacing: 0.6,
  color: colors.textMuted,
};

export const messageText: TextStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  lineHeight: 17,
  color: colors.textSecondary,
};

export const underlinePress: ViewStyle = {
  minHeight: 44,
  justifyContent: "center",
};

export const underlineLabel: TextStyle = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: 0.6,
  color: "rgba(64,63,76,0.6)",
  textDecorationLine: "underline",
};

export const primaryButton: ViewStyle = {
  backgroundColor: colors.azureInk,
  borderRadius: radius.control,
  paddingVertical: 14,
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
};

export const primaryButtonLabel: TextStyle = {
  fontFamily: fonts.sansSemiBold,
  fontSize: 15,
  color: colors.white,
};

export const chipButton: ViewStyle = {
  backgroundColor: colors.azureInk,
  borderRadius: radius.control,
  paddingHorizontal: 14,
  minHeight: 44,
  justifyContent: "center",
};

export const chipButtonLabel: TextStyle = {
  fontFamily: fonts.sansSemiBold,
  fontSize: 13,
  color: colors.white,
};

export const dangerButton: ViewStyle = {
  backgroundColor: colors.watermelonInk,
  borderRadius: radius.control,
  paddingVertical: 14,
  minHeight: 48,
  alignItems: "center",
  justifyContent: "center",
};

export const dangerButtonLabel: TextStyle = {
  fontFamily: fonts.sansSemiBold,
  fontSize: 15,
  color: colors.white,
};
