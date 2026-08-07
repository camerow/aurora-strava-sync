import React from "react";
import { Button, Label } from "@sendtally/design";
import { SessionPreviewCard } from "./SessionPreviewCard";

export function Hero(): React.ReactElement {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 64,
        alignItems: "center",
        padding: "78px 56px 84px",
        maxWidth: 1440,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 26 }}>
        <Label on="accent" style={{ letterSpacing: "0.1em" }}>
          TENSION · KILTER · GRASSHOPPER · DECOY · TOUCHSTONE · SO ILL · AURORA
        </Label>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 66,
            lineHeight: 0.98,
            letterSpacing: "-0.035em",
            color: "var(--bs-gunmetal)",
            textWrap: "balance",
          }}
        >
          Get credit for the hardest training you do.
        </h1>
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
