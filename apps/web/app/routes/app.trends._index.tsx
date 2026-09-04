import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { UpgradePanel } from "../billing/components/UpgradePanel";
import { INSIGHTS_FEATURE } from "../billing/features";
import { cloudflareContext } from "../lib/cloudflare-context";
import { requireApi } from "../lib/api.server";
import { hasFeature } from "../lib/billing.server";
import { TrendsOverview } from "../trends/components/TrendsOverview";

type LoaderData = { apiUrl: string; canSeeInsights: boolean };

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  await requireApi(args);
  return {
    apiUrl: args.context.get(cloudflareContext).env.API_URL,
    canSeeInsights: await hasFeature(args, INSIGHTS_FEATURE),
  };
}

export default function TrendsRoute(): React.ReactElement {
  const { apiUrl, canSeeInsights } = useLoaderData<typeof loader>();

  if (!canSeeInsights) {
    return (
      <UpgradePanel
        eyebrow="MEMBERS"
        title="Your sessions are adding up to something. Trends is where you see it."
        body="Keep logging for free - your logbook is yours either way. Membership unlocks the screens that read the whole history back to you."
        points={[
          "Volume - how much you actually climbed, week by week",
          "RPE - how hard your sessions have been feeling over time",
          "Average send grade - the drift a logbook can never show you",
          "Flash rate - the first thing to move when your reading improves",
        ]}
      />
    );
  }

  return <TrendsOverview apiUrl={apiUrl} />;
}
