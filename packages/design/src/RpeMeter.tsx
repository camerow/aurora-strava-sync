import React from "react";

export type RpeMeterProps = {
  rpe?: number;
  label?: string;
  on?: "light" | "dark";
  showValue?: boolean;
};

export function RpeMeter({
  rpe = 6,
  label = "RPE",
  on = "light",
  showValue = true,
}: RpeMeterProps): React.ReactElement {
  const dark = on === "dark";
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "var(--font-mono)" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "var(--type-label-track)",
            color: dark ? "var(--text-on-dark-label)" : "var(--text-on-white-secondary)",
          }}
        >
          {label}
        </span>
        {showValue && (
          <span
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: dark ? "var(--text-on-dark)" : "var(--bs-gunmetal)",
            }}
          >
            {rpe}
            <span style={{ fontSize: 12, opacity: 0.6 }}>/10</span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: 10 }, (_, i) => {
          const lit = i < rpe;
          const peak = i === rpe - 1;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 2,
                background: !lit
                  ? dark
                    ? "var(--line-on-dark)"
                    : "var(--data-bar-empty)"
                  : peak && rpe >= 8
                    ? "var(--data-bar-peak)"
                    : "var(--data-bar)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
