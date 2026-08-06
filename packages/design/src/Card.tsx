import React from "react";

export type CardProps = {
  float?: boolean;
  pad?: number;
  radius?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export function Card({
  float = false,
  pad = 26,
  radius = "var(--radius-card)",
  children,
  style,
}: CardProps): React.ReactElement {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        borderRadius: radius,
        padding: pad,
        boxShadow: float ? "var(--shadow-float)" : "none",
        fontFamily: "var(--font-sans)",
        color: "var(--bs-gunmetal)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
