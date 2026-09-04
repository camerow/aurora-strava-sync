import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useParams } from "react-router";
import type { TrendMetric } from "@sendtally/features/trends";
import { INSIGHTS_FEATURE } from "../billing/features";
import { cloudflareContext } from "../lib/cloudflare-context";
import { requireApi } from "../lib/api.server";
import { requireFeature } from "../lib/billing.server";
import { TrendDetail } from "../trends/components/TrendDetail";

const METRICS: TrendMetric[] = ["volume", "pyramid", "hardest", "flash", "avggrade"];

export async function loader(args: LoaderFunctionArgs): Promise<{ apiUrl: string }> {
  await requireApi(args);
  await requireFeature(args, INSIGHTS_FEATURE);
  return { apiUrl: args.context.get(cloudflareContext).env.API_URL };
}

export default function TrendDetailRoute(): React.ReactElement {
  const { apiUrl } = useLoaderData<typeof loader>();
  const params = useParams();
  const metric = METRICS.includes(params.metric as TrendMetric)
    ? (params.metric as TrendMetric)
    : "volume";

  return <TrendDetail apiUrl={apiUrl} metric={metric} />;
}
