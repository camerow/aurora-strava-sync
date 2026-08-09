import React from "react";

const BOARDS = [
  "Tension Board 1 & 2",
  "Kilter Board",
  "Grasshopper Board",
  "Decoy Board",
  "Touchstone Board",
  "So iLL Board",
  "Aurora Board",
];

const DETAILS: Array<[string, string]> = [
  ["KEPT PER CLIMB", "Grade, angle, setter, burns, rest between attempts, and result"],
  [
    "TRENDS",
    "Volume, grade pyramid, hardest send, flash rate and average grade, weekly or all-time",
  ],
  ["BACKFILL", "Your whole board history on request, or leave the past alone"],
  [
    "STRAVA",
    "Optional. One Rock Climbing activity per session, fingerprinted so it never doubles up",
  ],
  ["LEAVING", "Disconnect once and your credentials are deleted the same day"],
];

function SectionTitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <h2 className="l-section-title" style={{ color: "var(--bs-gunmetal)" }}>
      {children}
    </h2>
  );
}

function DetailRow({
  label,
  body,
  last,
}: {
  label: string;
  body: string;
  last: boolean;
}): React.ReactElement {
  return (
    <div
      className="l-detail-row"
      style={{ borderBottom: last ? "1px solid var(--line-on-light)" : "none" }}
    >
      <span
        style={{
          width: 150,
          flex: "none",
          paddingTop: 2,
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 11,
          letterSpacing: "var(--type-label-track)",
          color: "var(--text-label-accent)",
        }}
      >
        {label}
      </span>
      <span className="l-detail-body">{body}</span>
    </div>
  );
}

export function BoardsAndDetails(): React.ReactElement {
  return (
    <div id="boards" className="l-boards">
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <SectionTitle>Boards</SectionTitle>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            background: "var(--line-on-light-soft)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {BOARDS.map((b) => (
            <div
              key={b}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 18px",
                background: "var(--surface-soft)",
              }}
            >
              <span style={{ flex: 1, fontWeight: 500, fontSize: 15 }}>{b}</span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  fontSize: 11,
                  color: "var(--text-label-accent)",
                }}
              >
                SUPPORTED
              </span>
            </div>
          ))}
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.5,
            color: "rgba(64,63,76,0.58)",
          }}
        >
          Link as many as you climb on. Trends read across all of them at once, or one board at a
          time.
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <SectionTitle>Details</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {DETAILS.map(([label, body], i) => (
            <DetailRow key={label} label={label} body={body} last={i === DETAILS.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
