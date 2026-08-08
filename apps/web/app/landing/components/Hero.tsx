import React from "react";
import { Button, Label } from "@sendtally/design";
import { SessionPreviewCard } from "./SessionPreviewCard";

export function Hero(): React.ReactElement {
  return (
    <div className="l-hero">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 26 }}>
        <Label on="accent" style={{ letterSpacing: "0.1em" }}>
          TENSION · KILTER · GRASSHOPPER · DECOY · TOUCHSTONE · SO ILL · AURORA
        </Label>
        <h1 className="l-hero-title">Get credit for the hardest training you do.</h1>
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
          Your board sessions already have every number Strava wants - duration, sends, attempts,
          grades. sendtally reads them from your board account and posts the activity for you.
          Nothing to type, nothing to remember.
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
            Free · one-time code sign-in · connected in about five minutes
          </span>
        </div>
      </div>
      <SessionPreviewCard />
    </div>
  );
}
