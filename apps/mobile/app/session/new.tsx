import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@sendtally/design/tokens";
import { LogSessionForm } from "../../features/log-session/LogSessionForm";

export default function LogSessionScreen(): React.ReactElement {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top", "bottom"]}>
      <LogSessionForm />
    </SafeAreaView>
  );
}
