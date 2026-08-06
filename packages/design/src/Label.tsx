import React from "react";

export type LabelProps = {
  on?: "dark" | "accent" | "light";
  size?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

export function Label({ on = "dark", size = 11, children, style }: LabelProps): React.ReactElement {
  const color =
    on === "dark"
      ? "var(--text-on-dark-label)"
      : on === "accent"
        ? "var(--text-label-accent)"
        : "var(--text-on-white-secondary)";
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        fontSize: size,
        letterSpacing: "var(--type-label-track)",
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
