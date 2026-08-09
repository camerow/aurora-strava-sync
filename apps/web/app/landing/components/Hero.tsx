import React from "react";
import { Button, Label } from "@sendtally/design";
import { TrendsPreviewCard } from "./TrendsPreviewCard";

export function Hero(): React.ReactElement {
  return (
    <div className="l-hero">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 26 }}>
        <Label on="accent" style={{ letterSpacing: "0.1em" }}>
          TENSION · KILTER · GRASSHOPPER · DECOY · TOUCHSTONE · SO ILL · AURORA
        </Label>
        <h1 className="l-hero-title">See what six months of board sessions add up to.</h1>
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
          The board app remembers every climb and shows you none of the pattern. sendtally reads
          your logbook out of your board account and turns it into volume, grade pyramids, flash
          rate and progression - session by session, week by week. It posts each session to Strava
          too.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div>
            <Button variant="primary" href="/app">
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
            Free · one-time code sign-in · your whole history imported on day one
          </span>
        </div>
      </div>
      <TrendsPreviewCard />
    </div>
  );
}
