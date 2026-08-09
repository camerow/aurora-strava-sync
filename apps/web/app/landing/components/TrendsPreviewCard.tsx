import React from "react";
import { Label } from "@sendtally/design";
import { MiniBars, type MiniBar } from "./MiniBars";
import { StatGrid } from "./StatGrid";

const WEEKS: MiniBar[] = [
  { key: "5/18", label: "5/18", value: 24 },
  { key: "5/25", label: "5/25", value: 29 },
  { key: "6/1", label: "6/1", value: 11 },
  { key: "6/8", label: "6/8", value: 27 },
  { key: "6/15", label: "6/15", value: 31 },
  { key: "6/22", label: "6/22", value: 41 },
  { key: "6/29", label: "6/29", value: 28 },
  { key: "7/6", label: "7/6", value: 0 },
  { key: "7/13", label: "7/13", value: 25 },
  { key: "7/20", label: "7/20", value: 27 },
  { key: "7/27", label: "7/27", value: 31 },
  { key: "8/3", label: "8/3", value: 32, peak: true },
];

export function TrendsPreviewCard(): React.ReactElement {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        borderRadius: "var(--radius-card-lg)",
        boxShadow: "var(--shadow-float)",
        padding: "clamp(18px, 3vw, 26px)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        fontFamily: "var(--font-sans)",
        color: "var(--bs-gunmetal)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "4px 16px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: "-0.02em",
          }}
        >
          Trends
        </span>
        <Label on="light" size={10}>
          LAST 12 WEEKS · 47 SESSIONS
        </Label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Label on="accent">CLIMBS PER WEEK</Label>
        <MiniBars bars={WEEKS} height={78} />
      </div>

      <StatGrid
        tone="white"
        items={[
          { label: "CLIMBS", value: "328" },
          { label: "AVG GRADE", value: "V4.9" },
          { label: "FLASH RATE", value: "36%" },
          { label: "TOP", value: "V7", accent: true },
        ]}
      />
    </div>
  );
}
