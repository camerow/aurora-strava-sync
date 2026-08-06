import React from "react";

export type Stat = { label: string; value: string };

export type StatStripProps = { stats?: Stat[] };

export function StatStrip({ stats = [] }: StatStripProps): React.ReactElement {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${stats.length || 1}, 1fr)`,
        borderTop: "1px solid var(--line-on-light)",
        borderBottom: "1px solid var(--line-on-light)",
      }}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          style={{
            padding: "13px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 3,
            borderRight: i < stats.length - 1 ? "1px solid var(--line-on-light-soft)" : "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 10,
              letterSpacing: "var(--type-label-track)",
              color: "var(--text-on-white-secondary)",
            }}
          >
            {s.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 600,
              fontSize: 17,
              color: "var(--bs-gunmetal)",
            }}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}
