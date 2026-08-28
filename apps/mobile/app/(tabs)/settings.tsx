import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React from "react";
import { useSettings } from "@sendtally/features/settings";
import { SettingsView } from "../../features/settings/SettingsView";
import { useApi } from "../../lib/api";

export default function Settings(): React.ReactElement {
  const api = useApi();
  const clerk = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const { vm } = useSettings(api);

  return (
    <SettingsView
      vm={vm}
      email={user?.primaryEmailAddress?.emailAddress ?? ""}
      onSignOut={() => {
        void clerk.signOut().then(() => router.replace("/sign-in"));
      }}
    />
  );
}
