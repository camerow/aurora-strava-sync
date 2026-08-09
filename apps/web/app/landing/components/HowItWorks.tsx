import React from "react";
import { Card, Label } from "@sendtally/design";

const STEPS: Array<[string, string, string]> = [
  [
    "01",
    "Sign in to your board account",
    "The same Aurora login you use in the Tension or Kilter app. It's stored encrypted and used only to read your logbook - never to write to it.",
  ],
  [
    "02",
    "Import your history",
    "Every session you've ever logged comes across on day one, so the trends have something to say before your next climb.",
  ],
  [
    "03",
    "Authorise Strava, if you want it",
    "Standard OAuth, activity-write scope only. We never see your password and you can revoke it from Strava at any time.",
  ],
];

export function HowItWorks(): React.ReactElement {
  return (
    <div id="how" className="l-how">
      <div className="l-section-inner">
        <div className="l-section-header">
          <h2 className="l-section-title" style={{ color: "var(--bs-gunmetal)" }}>
            Two connections, once.
          </h2>
          <span className="l-section-blurb">
            After setup it runs on its own. Sessions show up within a few hours of you logging them
            in the board app.
          </span>
        </div>
        <div className="l-card-grid">
          {STEPS.map(([n, title, body]) => (
            <Card
              key={n}
              style={{
                background: "var(--surface-soft)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <Label on="accent" size={12} style={{ fontWeight: 600, letterSpacing: "0.1em" }}>
                {n}
              </Label>
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
