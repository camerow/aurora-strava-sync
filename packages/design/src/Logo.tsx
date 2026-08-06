import React from "react";

type MarkProps = { inverse?: boolean; size: number; style?: React.CSSProperties };

function Mark({ inverse = false, size, style }: MarkProps): React.ReactElement {
  const box = inverse ? "var(--bs-gunmetal)" : "var(--bs-gold)";
  const glyph = inverse ? "var(--bs-gold)" : "var(--bs-gunmetal)";
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label="sendtally"
      style={{ flex: "none", ...style }}
    >
      <rect width="32" height="32" rx="8" fill={box} />
      <path
        d="M9.5 22.5 16 16l6.5-6.5"
        fill="none"
        stroke={glyph}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="22.5" r="3.1" fill={glyph} />
      <circle cx="16" cy="16" r="3.1" fill={glyph} />
      <circle cx="22.5" cy="9.5" r="3.1" fill={glyph} />
    </svg>
  );
}

export type LogoProps = {
  variant?: "lockup" | "mark";
  tone?: "on-dark" | "on-light";
  size?: number;
  style?: React.CSSProperties;
};

export function Logo({
  variant = "lockup",
  tone = "on-dark",
  size = 32,
  style,
}: LogoProps): React.ReactElement {
  const onLight = tone === "on-light";
  if (variant === "mark") return <Mark inverse={onLight} size={size} style={style} />;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(size * 0.375),
        ...style,
      }}
    >
      <Mark size={size} />
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          fontSize: Math.round(size * 0.59375),
          letterSpacing: "-0.02em",
          color: onLight ? "var(--bs-gunmetal)" : "var(--bs-petal-tint)",
          lineHeight: 1,
        }}
      >
        sendtally
      </span>
    </span>
  );
}
