import React from "react";

export type ClimbLogEntry = {
  sent: boolean;
  grade: string;
  name: string;
  tries?: number;
};

export type ClimbLogProps = {
  climbs?: ClimbLogEntry[];
  on?: "light" | "dark";
  footer?: string;
};

export function ClimbLog({
  climbs = [],
  on = "light",
  footer = "synced by sendtally",
}: ClimbLogProps): React.ReactElement {
  const dark = on === "dark";
  const muted = dark ? "var(--text-on-dark-muted)" : "var(--text-on-white-secondary)";
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        lineHeight: 1.85,
        color: dark ? "var(--text-on-dark)" : "var(--bs-gunmetal)",
      }}
    >
      {climbs.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 8, opacity: c.sent ? 1 : 0.72 }}>
          <span style={{ width: 12, flex: "none", color: c.sent ? "var(--bs-azure-ink)" : muted }}>
            {c.sent ? "✓" : "✗"}
          </span>
          <span style={{ width: 26, flex: "none", fontWeight: 600 }}>{c.grade}</span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {c.name}
          </span>
          {(c.tries ?? 1) > 1 && (
            <span style={{ flex: "none", color: muted }}>({c.tries} tries)</span>
          )}
        </div>
      ))}
      {footer !== "" && <div style={{ marginTop: 6, color: muted }}>{footer}</div>}
    </div>
  );
}
