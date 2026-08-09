import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useSyncSettings } from "@sendtally/features/sync-settings";
import { cloudflareContext } from "../lib/cloudflare-context";
import { requireApi } from "../lib/api.server";
import { useClientApi } from "../lib/useClientApi";
import { SettingsView } from "../settings/components/SettingsView";

export async function loader(args: LoaderFunctionArgs): Promise<{ apiUrl: string }> {
  await requireApi(args);
  return { apiUrl: args.context.get(cloudflareContext).env.API_URL };
}

export default function SettingsRoute(): React.ReactElement {
  const { apiUrl } = useLoaderData<typeof loader>();
  const api = useClientApi(apiUrl);
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
    <SettingsView
      vm={vm}
      ready={ready}
      scheduleBusy={scheduleBusy}
      postingBusy={postingBoard !== null}
      message={message}
      messageBoard={messageBoard}
      onSchedule={(mode) => void setSchedule(mode)}
      onSync={(board) => void syncBoard(board)}
      onPosting={(board, mode) => void setPosting(board, mode)}
    />
  );
}
