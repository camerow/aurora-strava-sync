import React from "react";

export type InputProps = {
  onDark?: boolean;
  style?: React.CSSProperties;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "style">;

export function Input({ onDark = false, style, ...rest }: InputProps): React.ReactElement {
  const [focus, setFocus] = React.useState(false);
  return (
    <input
      {...rest}
      onFocus={(e) => {
        setFocus(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        rest.onBlur?.(e);
      }}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 15,
        color: "var(--bs-gunmetal)",
        background: "var(--bs-white)",
        border: onDark ? "none" : "1px solid rgba(64,63,76,0.15)",
        borderRadius: "var(--radius-control)",
        padding: onDark ? "13px 15px" : "14px 16px",
        outline: "none",
        boxShadow: focus
          ? onDark
            ? "var(--focus-ring-azure-strong)"
            : "var(--focus-ring-azure)"
          : "none",
        borderColor: focus && !onDark ? "var(--bs-azure)" : undefined,
        ...style,
      }}
    />
  );
}
