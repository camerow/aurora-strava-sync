import React from "react";
import { Label } from "@sendtally/design";
import { MembershipPricing } from "../../billing/components/MembershipPricing";
import { INSIGHT_SERIES } from "./insightSeries";
import { MiniBars } from "./MiniBars";

function MemberRow({
  eyebrow,
  line,
  bars,
}: {
  eyebrow: string;
  line: string;
  bars: React.ComponentProps<typeof MiniBars>["bars"];
}): React.ReactElement {
  return (
    <div className="l-member-row">
      <div style={{ width: 96, flex: "none" }}>
        <MiniBars
          bars={bars.map(({ key, value, peak }) => ({ key, value, peak }))}
          height={26}
          gap={2}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <Label on="light" style={{ letterSpacing: "0.08em" }}>
          {eyebrow}
        </Label>
        <span style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-on-light-secondary)" }}>
          {line}
        </span>
      </div>
    </div>
  );
}

export function PricePanel(): React.ReactElement {
  return (
    <div id="price" className="l-price">
      <div className="l-price-panel">
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}
        >
          <Label on="light" style={{ color: "var(--text-on-light)" }}>
            MEMBERSHIP
          </Label>
          <h2 className="l-price-title">Logging is free. Membership gives you the trends.</h2>
          <p
            style={{
              margin: 0,
              fontSize: 17,
              lineHeight: 1.55,
              color: "var(--text-on-light-secondary)",
              maxWidth: 480,
              textWrap: "pretty",
            }}
          >
            Sign up, log sessions, keep your logbook, post to Strava - that costs nothing and always
            will. Five dollars a month is what turns the log into a training history, and it is what
            pays for the server.
          </p>
          <div
            style={{
              alignSelf: "stretch",
              display: "flex",
              flexDirection: "column",
              maxWidth: 520,
            }}
          >
            {INSIGHT_SERIES.map((s) => (
              <MemberRow key={s.metric} eyebrow={s.eyebrow} line={s.memberLine} bars={s.bars} />
            ))}
            <div className="l-member-row">
              <div style={{ width: 96, flex: "none" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <Label on="light" style={{ letterSpacing: "0.08em" }}>
                  THE ROADMAP
                </Label>
                <span
                  style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-on-light-secondary)" }}
                >
                  Members say what gets built next - the people paying for the server get first
                  call.
                </span>
              </div>
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--text-on-light)",
            }}
          >
            Logging and Strava sync stay free for everyone.
          </span>
        </div>
        <div
          style={{
            background: "var(--bs-white)",
            borderRadius: "var(--radius-card)",
            padding: 20,
          }}
        >
          <MembershipPricing />
        </div>
      </div>
    </div>
  );
}
