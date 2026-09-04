import React from "react";
import { Link } from "react-router";
import { Label } from "@sendtally/design";

export type UpgradePanelProps = {
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
};

const primaryLink: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 15,
  color: "var(--bs-white)",
  background: "var(--bs-watermelon-ink)",
  borderRadius: "var(--radius-control)",
  padding: "14px 22px",
  textDecoration: "none",
  alignSelf: "flex-start",
};

export function UpgradePanel({
  eyebrow,
  title,
  body,
  points = [],
}: UpgradePanelProps): React.ReactElement {
  return (
    <div
      style={{
        background: "var(--surface-accent-pink)",
        borderRadius: "var(--radius-card)",
        padding: 32,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 620,
      }}
    >
      <Label on="accent">{eyebrow}</Label>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "-0.03em",
          textWrap: "balance",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.55,
          color: "var(--text-on-light-secondary)",
          textWrap: "pretty",
        }}
      >
        {body}
      </p>
      {points.length > 0 && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 14,
            lineHeight: 1.5,
            color: "var(--text-on-light-secondary)",
          }}
        >
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
      <Link to="/app/membership" style={primaryLink}>
        See membership →
      </Link>
    </div>
  );
}
