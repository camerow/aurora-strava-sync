import React from "react";

export type MiniBar = {
  key: string;
  value: number;
  label?: string;
  topLabel?: string;
  peak?: boolean;
};

function BarLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        fontSize: 10,
        color: "var(--text-on-white-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function MiniBars({
  bars,
  height = 52,
  gap = 6,
}: {
  bars: MiniBar[];
  height?: number;
  gap?: number;
}): React.ReactElement {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap }}>
      {bars.map((b) => (
        <div
          key={b.key}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
          }}
        >
          {b.topLabel !== undefined && <BarLabel>{b.topLabel}</BarLabel>}
          <div
            style={{
              width: "100%",
              height: b.value === 0 ? 4 : Math.max(6, Math.round((b.value / max) * height)),
              background:
                b.value === 0
                  ? "var(--data-bar-empty)"
                  : b.peak
                    ? "var(--data-bar-peak)"
                    : "var(--data-bar)",
              borderRadius: "4px 4px 0 0",
            }}
          />
          {b.label !== undefined && <BarLabel>{b.label}</BarLabel>}
        </div>
      ))}
    </div>
  );
}
