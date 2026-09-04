import React from "react";
import { Card, Label } from "@sendtally/design";
import { INSIGHT_SERIES } from "./insightSeries";
import { MiniBars } from "./MiniBars";

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
            Five things your logbook never shows you.
          </h2>
          <span className="l-section-blurb">
            These are the screens your logged sessions build, over any range from a month to
            all-time. Logging them is free; membership is what opens these five.
          </span>
        </div>

        <div className="l-card-grid">
          {INSIGHT_SERIES.map((s, i) => (
            <InsightCard
              key={s.metric}
              wide={i === INSIGHT_SERIES.length - 1}
              eyebrow={s.eyebrow}
              headline={s.headline}
              meta={s.meta}
              chart={
                <MiniBars
                  bars={s.bars}
                  height={i === INSIGHT_SERIES.length - 1 ? 62 : 48}
                  gap={i === INSIGHT_SERIES.length - 1 ? 8 : s.metric === "volume" ? 4 : 6}
                />
              }
              body={s.body}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
