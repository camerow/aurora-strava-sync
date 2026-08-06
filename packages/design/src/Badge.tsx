import React from "react";

const tones: Record<string, React.CSSProperties> = {
  gold: {
    color: "var(--bs-gold)",
    border: "1px solid rgba(249,220,92,0.45)",
    background: "transparent",
  },
  azure: { color: "var(--bs-azure-ink)", border: "none", background: "rgba(49,133,252,0.12)" },
  petal: { color: "var(--bs-gunmetal)", border: "none", background: "rgba(204,121,234,0.14)" },
};

export type BadgeProps = {
  tone?: "gold" | "azure" | "petal";
  pill?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export function Badge({
  tone = "gold",
  pill = true,
  children,
  style,
}: BadgeProps): React.ReactElement {
  const t = tones[tone] ?? tones["gold"]!;
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        fontSize: 10,
        letterSpacing: "var(--type-label-track)",
        padding: "4px 8px",
        borderRadius: pill ? "var(--radius-pill)" : "var(--radius-sm)",
        ...t,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
