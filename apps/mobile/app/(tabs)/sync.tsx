import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React from "react";
import { useSyncSettings } from "@sendtally/features/sync-settings";
import { SyncView } from "../../features/sync/SyncView";
import { useApi } from "../../lib/api";

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
    <SyncView
      vm={vm}
      ready={ready}
      scheduleBusy={scheduleBusy}
      postingBusy={postingBoard !== null}
      message={message}
      messageBoard={messageBoard}
      email={user?.primaryEmailAddress?.emailAddress ?? ""}
      onSchedule={(mode) => void setSchedule(mode)}
      onSync={(board) => void syncBoard(board)}
      onPosting={(board, mode) => void setPosting(board, mode)}
      onSignOut={() => {
        void clerk.signOut().then(() => router.replace("/sign-in"));
      }}
    />
  );
}
