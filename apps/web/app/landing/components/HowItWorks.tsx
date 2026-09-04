import React from "react";
import { Card, Label } from "@sendtally/design";

const STEPS: Array<[string, string, string]> = [
  [
    "01",
    "Log your session",
    "Date, times, indoor or outdoor, and the climbs - V-scale or Font grades, sends and attempts, tries. About a minute, right after you climb.",
  ],
  [
    "02",
    "Get an effort score",
    "Every session is scored 1-10 against your own last eight weeks, so a big night reads as a big night - not just a list of grades.",
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
            A minute after you climb.
          </h2>
          <span className="l-section-blurb">
            No accounts to link, no importers to babysit. Log the session and the effort score and
            Strava post follow from it for free; the trends build themselves for members.
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
