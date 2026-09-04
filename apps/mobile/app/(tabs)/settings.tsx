import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React from "react";
import { useSettings } from "@sendtally/features/settings";
import { SettingsView } from "../../features/settings/SettingsView";
import { useApi } from "../../lib/api";
import { STRAVA_SYNC_FEATURE, useHasFeature } from "../../lib/billing";

export default function Settings(): React.ReactElement {
  const api = useApi();
  const clerk = useClerk();
  const { user } = useUser();
  const router = useRouter();
  const { vm } = useSettings(api);
  const canSyncStrava = useHasFeature(STRAVA_SYNC_FEATURE);

  return (
    <SettingsView
      vm={vm}
      email={user?.primaryEmailAddress?.emailAddress ?? ""}
      canSyncStrava={canSyncStrava}
      onSignOut={() => {
        void clerk.signOut().then(() => router.replace("/sign-in"));
      }}
    />
  );
}
