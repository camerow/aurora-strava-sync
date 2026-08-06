import React from "react";

export type SpecRowProps = {
  label: string;
  children?: React.ReactNode;
  last?: boolean;
  labelWidth?: number;
};

export function SpecRow({
  label,
  children,
  last = false,
  labelWidth = 150,
}: SpecRowProps): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        padding: "14px 0",
        borderTop: "1px solid var(--line-on-dark)",
        borderBottom: last ? "1px solid var(--line-on-dark)" : "none",
      }}
    >
      <span
        style={{
          width: labelWidth,
          flex: "none",
          paddingTop: 2,
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 11,
          letterSpacing: "var(--type-label-track)",
          color: "var(--text-on-dark-label)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          lineHeight: 1.5,
          color: "rgba(255,255,255,0.86)",
        }}
      >
        {children}
      </span>
    </div>
  );
}
