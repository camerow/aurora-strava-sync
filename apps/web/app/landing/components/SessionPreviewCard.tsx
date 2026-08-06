import React from "react";
import { Badge, GradeBars, Label, StatStrip } from "@sendtally/design";

export function SessionPreviewCard(): React.ReactElement {
  return (
    <div
      style={{
        background: "var(--bs-white)",
        border: "1px solid var(--line-on-light-soft)",
        borderRadius: "var(--radius-card-lg)",
        boxShadow: "0 20px 48px rgba(20,19,26,0.14)",
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
        color: "var(--bs-gunmetal)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 18px 12px" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--bs-petal)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          WH
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Will Hendriks</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-on-white-secondary)",
            }}
          >
            Today at 6:42 PM · Rock Climbing
          </span>
        </div>
        <Badge tone="azure" pill={false} style={{ marginLeft: "auto" }}>
          via sendtally
        </Badge>
      </div>
      <div
        style={{ padding: "0 18px 14px", fontWeight: 600, fontSize: 19, letterSpacing: "-0.01em" }}
      >
        Tension Board 2 - 18 climbs, top V7
      </div>
      <StatStrip
        stats={[
          { label: "TIME", value: "1:24" },
          { label: "SENDS", value: "14" },
          { label: "ATTEMPTS", value: "31" },
          { label: "GRADES", value: "V4–V7" },
        ]}
      />
      <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <Label on="light" size={10}>
          SENDS BY GRADE
        </Label>
        <GradeBars
          bars={[
            { grade: "V4", count: 4 },
            { grade: "V5", count: 6 },
            { grade: "V6", count: 3 },
            { grade: "V7", count: 1, peak: true },
            { grade: "V8", count: 0 },
          ]}
        />
      </div>
    </div>
  );
}
