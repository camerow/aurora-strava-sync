import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { useSettings } from "@sendtally/features/settings";
import { STRAVA_SYNC_FEATURE } from "../billing/features";
import { cloudflareContext } from "../lib/cloudflare-context";
import { requireApi } from "../lib/api.server";
import { hasFeature } from "../lib/billing.server";
import { useClientApi } from "../lib/useClientApi";
import { SettingsView } from "../settings/components/SettingsView";

type LoaderData = { apiUrl: string; canSyncStrava: boolean };

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  await requireApi(args);
  return {
    apiUrl: args.context.get(cloudflareContext).env.API_URL,
    canSyncStrava: await hasFeature(args, STRAVA_SYNC_FEATURE),
  };
}

export default function SettingsRoute(): React.ReactElement {
  const { apiUrl, canSyncStrava } = useLoaderData<typeof loader>();
  const api = useClientApi(apiUrl);
  const { vm } = useSettings(api);
  return <SettingsView vm={vm} canSyncStrava={canSyncStrava} />;
}
