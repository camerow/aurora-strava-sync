import React from "react";
import { Card, Label } from "@sendtally/design";
import { MiniBars, type MiniBar } from "./MiniBars";

const MONTHS = ["MAR", "APR", "MAY", "JUN", "JUL", "AUG"];

const VOLUME: MiniBar[] = [24, 29, 11, 27, 31, 41, 28, 0, 25, 27, 31, 32].map((v, i) => ({
  key: `w${i}`,
  value: v,
}));

const PYRAMID: MiniBar[] = [
  { key: "V2", label: "V2", value: 7 },
  { key: "V3", label: "V3", value: 18 },
  { key: "V4", label: "V4", value: 31 },
  { key: "V5", label: "V5", value: 28 },
  { key: "V6", label: "V6", value: 15 },
  { key: "V7", label: "V7", value: 2, peak: true },
  { key: "V8", label: "V8", value: 0 },
];

const FLASH: MiniBar[] = [22, 26, 25, 31, 33, 36].map((v, i) => ({
  key: MONTHS[i] ?? `m${i}`,
  label: MONTHS[i] ?? "",
  value: v,
  peak: i === 5,
}));

const HARDEST: MiniBar[] = [20, 20, 35, 35, 52, 52].map((v, i) => ({
  key: MONTHS[i] ?? `m${i}`,
  label: MONTHS[i] ?? "",
  value: v,
  peak: i === 2 || i === 4,
}));

const AVG_GRADE: MiniBar[] = [
  ["5/18", "V4.2", 42],
  ["5/25", "V4.3", 43],
  ["6/1", "V4.1", 41],
  ["6/8", "V4.4", 44],
  ["6/15", "V4.5", 45],
  ["6/22", "V4.6", 46],
  ["6/29", "V4.4", 44],
  ["7/6", "n/a", 0],
  ["7/13", "V4.6", 46],
  ["7/20", "V4.7", 47],
  ["7/27", "V4.8", 48],
  ["8/3", "V4.9", 49],
].map(([week, grade, value]) => ({
  key: String(week),
  label: String(week),
  topLabel: String(grade),
  value: Number(value),
  peak: week === "8/3",
}));

function InsightCard({
  eyebrow,
  headline,
  meta,
  chart,
  body,
  wide = false,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  meta: string;
  chart: React.ReactNode;
  body: string;
  wide?: boolean;
}): React.ReactElement {
  return (
    <Card
      className={wide ? "l-card-wide" : undefined}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
      <Label on="accent">{eyebrow}</Label>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: "-0.02em",
        }}
      >
        {headline}
      </span>
      <Label on="light" style={{ letterSpacing: "0.06em" }}>
        {meta}
      </Label>
      <div style={{ marginTop: 6 }}>{chart}</div>
      <span style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-on-white-secondary)" }}>
        {body}
      </span>
    </Card>
  );
}

export function Insights(): React.ReactElement {
  return (
    <div id="insights" className="l-insights">
      <div className="l-section-inner">
        <div className="l-section-header">
          <h2
            className="l-section-title"
            style={{ color: "var(--text-on-light)", maxWidth: 640, textWrap: "balance" }}
          >
            Five things the board apps never show you.
          </h2>
          <span className="l-section-blurb">
            These are the screens you get on day one, built from the sessions you already logged.
            Every one of them is a click deep.
          </span>
        </div>

        <div className="l-card-grid">
          <InsightCard
            eyebrow="VOLUME"
            headline="328 climbs"
            meta="22 SESSIONS · LAST 12 WEEKS"
            chart={<MiniBars bars={VOLUME} height={48} gap={4} />}
            body="One empty week in July was travel, not a slump. Volume has held near thirty climbs a week since May."
          />

          <InsightCard
            eyebrow="GRADE PYRAMID"
            headline="111 sends"
            meta="ALL-TIME · BY GRADE"
            chart={<MiniBars bars={PYRAMID} height={48} />}
            body="A V4 base with 28 V5s behind it and two V7s on top. The shape says V6 volume is what feeds the next grade."
          />

          <InsightCard
            eyebrow="FLASH RATE"
            headline="36%"
            meta="UP FROM 22% IN MARCH"
            chart={<MiniBars bars={FLASH} height={48} />}
            body="Reading the board is trainable. Six months of mileage shows up here before it shows up in the grades."
          />

          <InsightCard
            eyebrow="HARDEST SEND"
            headline="V7"
            meta="JUL 30 · THREAD THE NEEDLE"
            chart={<MiniBars bars={HARDEST} height={48} />}
            body="Twelve weeks from the first V6 to the first V7, and both V7s came at 40° or steeper."
          />

          <InsightCard
            wide
            eyebrow="AVG SEND GRADE"
            headline="V4.9 this week"
            meta="+0.7 SINCE MID-MAY"
            chart={<MiniBars bars={AVG_GRADE} height={62} gap={8} />}
            body="Average send grade has drifted up about V0.7 over twelve weeks - steady, not a spike, which tracks with the volume behind it. The board app can tell you what you climbed on Tuesday; it can't tell you this."
          />
        </div>
      </div>
    </div>
  );
}
