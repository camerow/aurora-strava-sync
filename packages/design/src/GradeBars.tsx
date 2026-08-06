import React from "react";

export type GradeBar = { grade: string; count: number; peak?: boolean };

export type GradeBarsProps = { bars?: GradeBar[]; height?: number };

export function GradeBars({ bars = [], height = 64 }: GradeBarsProps): React.ReactElement {
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height }}>
      {bars.map((b) => {
        const h = b.count === 0 ? 4 : Math.max(8, (b.count / max) * (height - 20));
        const bg =
          b.count === 0
            ? "var(--data-bar-empty)"
            : b.peak
              ? "var(--data-bar-peak)"
              : "var(--data-bar)";
        return (
          <div
            key={b.grade}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{ width: "100%", height: h, background: bg, borderRadius: "4px 4px 0 0" }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 10,
                color: "var(--text-on-white-secondary)",
              }}
            >
              {b.grade}
            </span>
          </div>
        );
      })}
    </div>
  );
}
