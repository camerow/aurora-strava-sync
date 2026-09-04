import React from "react";

const base: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  border: "none",
  borderRadius: "var(--radius-control)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-3)",
  whiteSpace: "nowrap",
  textDecoration: "none",
  transition: "background var(--motion-fast), color var(--motion-fast)",
};

const sizes = {
  md: { fontSize: 15, padding: "14px 22px" },
  sm: { fontSize: 13, padding: "9px 16px" },
} satisfies Record<string, React.CSSProperties>;

type Variant = {
  background: string;
  color: string;
  hover: string;
  border?: string;
};

const variants: Record<string, Variant> = {
  gold: {
    background: "var(--bs-gold)",
    color: "var(--bs-gunmetal)",
    hover: "var(--bs-gold-hover)",
  },
  azure: {
    background: "var(--bs-azure-ink)",
    color: "var(--bs-white)",
    hover: "var(--bs-azure-ink-press)",
  },
  ghostOnDark: {
    background: "transparent",
    color: "var(--text-on-dark-secondary)",
    hover: "transparent",
    border: "1px solid var(--line-on-dark)",
  },
  danger: {
    background: "var(--bs-watermelon-ink)",
    color: "var(--bs-white)",
    hover: "var(--bs-watermelon-ink-press)",
  },
};

export type ButtonProps = {
  variant?: "gold" | "azure" | "ghostOnDark" | "danger";
  size?: "md" | "sm";
  href?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
} & Omit<React.HTMLAttributes<HTMLElement>, "style">;

export function Button({
  variant = "gold",
  size = "md",
  href,
  disabled = false,
  children,
  style,
  ...rest
}: ButtonProps): React.ReactElement {
  const v = variants[variant] ?? variants["gold"]!;
  const [hover, setHover] = React.useState(false);
  const css: React.CSSProperties = {
    ...base,
    ...sizes[size],
    background: hover && !disabled ? v.hover : v.background,
    color: v.color,
    border: v.border ?? base.border,
    opacity: disabled ? 0.45 : 1,
    pointerEvents: disabled ? "none" : undefined,
    ...style,
  };
  const shared = {
    style: css,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    ...rest,
  };
  if (href !== undefined) {
    return (
      <a href={href} {...shared}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" {...shared}>
      {children}
    </button>
  );
}
