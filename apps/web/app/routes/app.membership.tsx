import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Badge, Label } from "@sendtally/design";
import { INSIGHTS_FEATURE, MEMBER_BENEFITS, STRAVA_SYNC_FEATURE } from "../billing/features";
import { MembershipPricing } from "../billing/components/MembershipPricing";
import { hasFeature } from "../lib/billing.server";
import { requireApi } from "../lib/api.server";

type LoaderData = { isMember: boolean };

export async function loader(args: LoaderFunctionArgs): Promise<LoaderData> {
  await requireApi(args);
  const [insights, stravaSync] = await Promise.all([
    hasFeature(args, INSIGHTS_FEATURE),
    hasFeature(args, STRAVA_SYNC_FEATURE),
  ]);
  return { isMember: insights || stravaSync };
}

export default function MembershipRoute(): React.ReactElement {
  const { isMember } = useLoaderData<typeof loader>();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: "-0.03em",
            }}
          >
            Membership
          </h1>
          {isMember && <Badge tone="petal">MEMBER</Badge>}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.55,
            color: "var(--text-on-white-secondary)",
            maxWidth: 620,
            textWrap: "pretty",
          }}
        >
          Logging sessions is free and always will be. Membership is what turns the log into a
          training history, and it is what pays for the server.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
        {MEMBER_BENEFITS.map((benefit) => (
          <div
            key={benefit.title}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              paddingTop: 16,
              borderTop: "1px solid var(--line-on-light)",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              {benefit.title}
              {benefit.soon === true && <Label on="accent">COMING SOON</Label>}
            </span>
            <span
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--text-on-white-secondary)",
              }}
            >
              {benefit.body}
            </span>
          </div>
        ))}
      </div>

      <MembershipPricing />
    </div>
  );
}
