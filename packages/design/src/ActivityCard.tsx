import React from "react";
import { Badge } from "./Badge";
import { Card } from "./Card";
import { GradeBars, type GradeBar } from "./GradeBars";
import { Label } from "./Label";
import { StatStrip, type Stat } from "./StatStrip";

export type ActivityCardProps = {
  athlete: string;
  initials: string;
  meta: string;
  title: string;
  stats?: Stat[];
  bars?: GradeBar[];
  float?: boolean;
};

export function ActivityCard({
  athlete,
  initials,
  meta,
  title,
  stats = [],
  bars = [],
  float = true,
}: ActivityCardProps): React.ReactElement {
  return (
    <Card float={float} pad={0} radius="var(--radius-card-lg)" style={{ overflow: "hidden" }}>
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
            color: "var(--bs-gunmetal)",
          }}
        >
          {initials}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{athlete}</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-on-white-secondary)",
            }}
          >
            {meta}
          </span>
        </div>
        <Badge tone="azure" pill={false} style={{ marginLeft: "auto" }}>
          via sendtally
        </Badge>
      </div>
      <div
        style={{ padding: "0 18px 14px", fontWeight: 600, fontSize: 19, letterSpacing: "-0.01em" }}
      >
        {title}
      </div>
      <StatStrip stats={stats} />
      <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <Label on="light" size={10}>
          SENDS BY GRADE
        </Label>
        <GradeBars bars={bars} />
      </div>
    </Card>
  );
}
