import React from "react";
import { Link } from "react-router";
import {
  MONTH_SHORT_NAMES,
  adjacentSessionMonths,
  monthsOfYear,
  sessionYears,
  type SessionMonth,
} from "@sendtally/features/sessions";

function monthHref(key: string): string {
  return `/app?month=${key}`;
}

const chipBase: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.06em",
  padding: "7px 12px",
  borderRadius: "var(--radius-pill)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  ...chipBase,
  background: active ? "var(--bs-gold)" : "transparent",
  color: active ? "var(--bs-gunmetal)" : "rgba(64,63,76,0.65)",
  border: active ? "1px solid var(--bs-gold)" : "1px solid rgba(64,63,76,0.18)",
});

const emptyChipStyle: React.CSSProperties = {
  ...chipBase,
  color: "rgba(64,63,76,0.28)",
  border: "1px solid rgba(64,63,76,0.08)",
};

const arrowStyle = (enabled: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: "var(--radius-pill)",
  border: "1px solid rgba(64,63,76,0.18)",
  fontFamily: "var(--font-mono)",
  fontWeight: 600,
  fontSize: 16,
  lineHeight: 1,
  textDecoration: "none",
  color: enabled ? "var(--bs-gunmetal)" : "rgba(64,63,76,0.25)",
  background: enabled ? "#F7F6F3" : "transparent",
  pointerEvents: enabled ? "auto" : "none",
});

function Arrow({
  target,
  label,
  children,
}: {
  target: SessionMonth | null;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  if (target === null) {
    return (
      <span aria-disabled style={arrowStyle(false)}>
        {children}
      </span>
    );
  }
  return (
    <Link
      to={monthHref(target.key)}
      aria-label={`${label}: ${target.label}`}
      style={arrowStyle(true)}
    >
      {children}
    </Link>
  );
}

export function MonthPicker({
  months,
  selected,
}: {
  months: SessionMonth[];
  selected: SessionMonth;
}): React.ReactElement {
  const { newer, older } = adjacentSessionMonths(months, selected.key);
  const years = sessionYears(months);
  const count = selected.sessions.length;

  return (
    <nav
      aria-label="Browse sessions by month"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Arrow target={older} label="Older month">
          ‹
        </Arrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 220 }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "-0.02em",
            }}
          >
            {selected.label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 500,
              fontSize: 10,
              letterSpacing: "0.08em",
              color: "rgba(64,63,76,0.55)",
            }}
          >
            {count === 1 ? "1 SESSION" : `${count} SESSIONS`}
          </span>
        </div>
        <Arrow target={newer} label="Newer month">
          ›
        </Arrow>
      </div>
      {years.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {years.map((year) => {
            const active = year === selected.year;
            const first = months.find((m) => m.year === year);
            return first === undefined ? null : (
              <Link
                key={year}
                to={monthHref(active ? selected.key : first.key)}
                style={chipStyle(active)}
              >
                {year}
              </Link>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {monthsOfYear(months, selected.year).map((month, i) =>
          month === null ? (
            <span key={i} style={emptyChipStyle}>
              {MONTH_SHORT_NAMES[i]}
            </span>
          ) : (
            <Link
              key={i}
              to={monthHref(month.key)}
              aria-current={month.key === selected.key ? "page" : undefined}
              style={chipStyle(month.key === selected.key)}
            >
              {MONTH_SHORT_NAMES[i]}
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
