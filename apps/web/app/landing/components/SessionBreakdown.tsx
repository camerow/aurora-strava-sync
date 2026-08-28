import React from "react";
import { Label } from "@sendtally/design";
import { StatGrid } from "./StatGrid";

type Result = "FLASH" | "SENT" | "PROJECT";

type Climb = {
  n: number;
  name: string;
  grade: string;
  burns: string;
  result: Result;
  top?: boolean;
};

const CLIMBS: Climb[] = [
  {
    n: 1,
    name: "Static Cling",
    grade: "V2",
    burns: "1",
    result: "FLASH",
  },
  {
    n: 4,
    name: "Pinch Point",
    grade: "V5",
    burns: "2",
    result: "SENT",
  },
  {
    n: 7,
    name: "Dead Point Drill",
    grade: "V6",
    burns: "2",
    result: "SENT",
  },
  {
    n: 9,
    name: "Cutting Loose",
    grade: "V6",
    burns: "3",
    result: "SENT",
  },
  {
    n: 10,
    name: "Thread the Needle",
    grade: "V7",
    burns: "5",
    result: "SENT",
    top: true,
  },
  {
    n: 12,
    name: "Full Value",
    grade: "V8",
    burns: "2",
    result: "PROJECT",
  },
];

const HEADINGS = ["#", "CLIMB", "GRADE", "BURNS", "RESULT"];

const resultStyles: Record<Result, React.CSSProperties> = {
  FLASH: {
    background: "var(--bs-gold)",
    border: "1px solid var(--bs-gold)",
    color: "var(--bs-gunmetal)",
  },
  SENT: {
    background: "transparent",
    border: "1px solid rgba(64,63,76,0.25)",
    color: "var(--text-on-white-secondary)",
  },
  PROJECT: {
    background: "transparent",
    border: "1px solid rgba(64,63,76,0.15)",
    color: "rgba(64,63,76,0.55)",
  },
};

function ResultBadge({ result }: { result: Result }): React.ReactElement {
  return (
    <span
      style={{
        justifySelf: "start",
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        fontSize: 10,
        letterSpacing: "var(--type-label-track)",
        borderRadius: "var(--radius-pill)",
        padding: "3px 9px",
        whiteSpace: "nowrap",
        ...resultStyles[result],
      }}
    >
      {result}
    </span>
  );
}

const metaStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--text-on-white-secondary)",
};

function ClimbRow({ climb }: { climb: Climb }): React.ReactElement {
  return (
    <div className="l-climb-row">
      <span
        className="l-climb-num"
        style={{ ...metaStyle, color: "rgba(64,63,76,0.5)", alignSelf: "center" }}
      >
        {climb.n}
      </span>
      <span className="l-climb-name" style={{ fontWeight: 500, fontSize: 15, minWidth: 0 }}>
        {climb.name}
      </span>
      <span className="l-climb-meta">
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: 600,
            fontSize: 14,
            color: climb.top === true ? "var(--text-label-accent)" : "var(--bs-gunmetal)",
          }}
        >
          {climb.grade}
        </span>
        <span style={metaStyle}>
          {climb.burns}
          <span className="l-inline-label">{climb.burns === "1" ? " burn" : " burns"}</span>
        </span>
      </span>
      <span className="l-climb-result">
        <ResultBadge result={climb.result} />
      </span>
    </div>
  );
}

export function SessionBreakdown(): React.ReactElement {
  return (
    <div id="session" className="l-session">
      <div className="l-section-header">
        <h2 className="l-section-title" style={{ color: "var(--bs-gunmetal)" }}>
          Every session, climb by climb.
        </h2>
        <span className="l-section-blurb">
          Grades, burns and results - kept for every climb so a project you have been chipping at
          for a month reads as one story.
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: "-0.02em",
          }}
        >
          Tuesday night - Jul 30
        </span>
        <Label on="light" style={{ letterSpacing: "0.06em" }}>
          THU JUL 30 · 7:02 PM · INDOOR · 1H 28M
        </Label>
      </div>

      <StatGrid
        items={[
          { label: "TIME", value: "1H 28M" },
          { label: "CLIMBS", value: "12" },
          { label: "SENDS", value: "10" },
          { label: "AVG GRADE", value: "V4.9" },
          { label: "FLASHES", value: "3" },
          { label: "ATTEMPTS", value: "24" },
          { label: "TOP", value: "V7", accent: true },
        ]}
      />

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div className="l-climb-head">
          {HEADINGS.map((h) => (
            <Label key={h} on="accent" size={10}>
              {h}
            </Label>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {CLIMBS.map((c) => (
            <ClimbRow key={c.n} climb={c} />
          ))}
        </div>
      </div>

      <Label on="light" style={{ letterSpacing: "0.06em" }}>
        6 OF 12 CLIMBS SHOWN · FILTER BY SENT, FLASHED OR PROJECT IN THE APP
      </Label>
    </div>
  );
}
