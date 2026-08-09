import React from "react";

export type CardProps = {
  float?: boolean;
  pad?: number;
  radius?: string;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export function Card({
  float = false,
  pad = 26,
  radius = "var(--radius-card)",
  className,
  children,
  style,
}: CardProps): React.ReactElement {
  return (
    <div
      className={className}
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
