import React from "react";

const DETAILS: Array<[string, string]> = [
  [
    "KEPT PER CLIMB",
    "Grade in V-scale or Font, send or attempt, tries, and the climb's name if you give it one",
  ],
  [
    "EFFORT",
    "Every session scored 1-10 against your own rolling eight weeks - set it yourself or leave it on auto",
  ],
  [
    "TRENDS",
    "Volume, grade pyramid, hardest send, flash rate and average grade, weekly or all-time - the membership half",
  ],
  [
    "STRAVA",
    "Optional and free for everyone. One Rock Climbing activity per session, fingerprinted so it never doubles up",
  ],
  ["LEAVING", "Delete your account and every session and token goes with it the same day"],
];

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

export function Details(): React.ReactElement {
  return (
    <div id="details" className="l-details">
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <h2 className="l-section-title" style={{ color: "var(--bs-gunmetal)" }}>
          Details
        </h2>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {DETAILS.map(([label, body], i) => (
            <DetailRow key={label} label={label} body={body} last={i === DETAILS.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}
