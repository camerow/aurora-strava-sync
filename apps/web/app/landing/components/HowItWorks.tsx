import React from "react";
import { Card } from "@sendtally/design";

const STEPS: Array<[string, string, string]> = [
  [
    "01",
    "Sign in to your board account",
    "The same Aurora login you use in the Tension or Kilter app. It's stored encrypted and used only to read your logbook - never to write to it.",
  ],
  [
    "02",
    "Authorise Strava",
    "Standard OAuth, activity-write scope only. We never see your password and you can revoke it from Strava at any time.",
  ],
  [
    "03",
    "Climb",
    "Each logged session becomes one Rock Climbing activity. Titles, descriptions and privacy are yours to edit afterwards like any other activity.",
  ],
];

export function HowItWorks(): React.ReactElement {
  return (
    <div id="how" style={{ background: "var(--surface-accent-pink)", padding: "60px 56px" }}>
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 40,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 36,
              letterSpacing: "-0.03em",
              color: "var(--text-on-light)",
            }}
          >
            Two connections, once.
          </h2>
          <span
            style={{
              fontSize: 14,
              color: "var(--text-on-light)",
              maxWidth: 400,
              textAlign: "right",
            }}
          >
            After setup it runs on its own. Sessions show up within a few hours of you logging them
            in the board app.
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {STEPS.map(([n, title, body]) => (
            <Card key={n} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  color: "var(--text-label-accent)",
                }}
              >
                {n}
              </span>
              <span style={{ fontWeight: 600, fontSize: 19 }}>{title}</span>
              <span
                style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-on-white-secondary)" }}
              >
                {body}
              </span>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
