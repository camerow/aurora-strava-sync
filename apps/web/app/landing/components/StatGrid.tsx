import React from "react";

export type StatGridItem = { label: string; value: string; accent?: boolean };

export function StatGrid({
  items,
  tone = "soft",
}: {
  items: StatGridItem[];
  tone?: "soft" | "white";
}): React.ReactElement {
  return (
    <div
      className={tone === "white" ? "l-statgrid l-statgrid--white" : "l-statgrid"}
      style={{ "--statgrid-cols": items.length } as React.CSSProperties}
    >
      {items.map((s) => (
        <div key={s.label} className="l-statgrid-cell">
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
              color: s.accent === true ? "var(--text-label-accent)" : "var(--bs-gunmetal)",
            }}
          >
            {s.value}
          </span>
        </div>
      ))}
    </div>
  );
}
