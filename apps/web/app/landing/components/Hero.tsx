import React from "react";
import { Button, Label } from "@sendtally/design";
import { TrendsPreviewCard } from "./TrendsPreviewCard";

export function Hero(): React.ReactElement {
  return (
    <div className="l-hero">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 26 }}>
        <Label on="accent" style={{ letterSpacing: "0.1em" }}>
          FREE TO LOG · MEMBER TRENDS
        </Label>
        <h1 className="l-hero-title">See what six months of climbing adds up to.</h1>
        <p
          style={{
            margin: 0,
            fontSize: 18,
            lineHeight: 1.55,
            color: "var(--text-on-white-secondary)",
            maxWidth: 470,
            textWrap: "pretty",
          }}
        >
          A session takes a minute to log - grades, sends, attempts - and every one gets an effort
          score against your own last eight weeks and posts to Strava. That part is free. Membership
          turns the history into volume, grade pyramids, flash rate, hardest send and average grade,
          week by week.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div>
            <Button variant="gold" href="/app">
              Create your account →
            </Button>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "rgba(64,63,76,0.58)",
            }}
          >
            Free to log · one-time code sign-in · Strava sync included, never paywalled
          </span>
        </div>
      </div>
      <TrendsPreviewCard />
    </div>
  );
}
