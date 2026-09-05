import React from "react";
import type { TrendBarVM } from "@sendtally/features/trends";

const BAR_GAP = 5;
const VALUE_BAND = 14;
const AXIS_BAND = 16;
const Y_AXIS_WIDTH = 34;
const AXIS_LINE = "1px solid var(--line-on-light)";

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 9,
  lineHeight: "12px",
  color: "rgba(64,63,76,0.72)",
  whiteSpace: "nowrap",
};

function tickTop(height: number, i: number, count: number): number {
  return VALUE_BAND + (height * i) / Math.max(1, count - 1);
}

export function TrendBars({
  bars,
  height,
  showValues = false,
  yTicks = [],
}: {
  bars: TrendBarVM[];
  height: number;
  showValues?: boolean;
  yTicks?: string[];
}): React.ReactElement {
  const valueBand = showValues ? VALUE_BAND : 0;

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {showValues && (
        <div
          style={{
            position: "relative",
            width: Y_AXIS_WIDTH,
            height: height + VALUE_BAND + AXIS_BAND,
            flexShrink: 0,
          }}
        >
          {yTicks.map((t, i) => (
            <span
              key={i}
              style={{
                ...labelStyle,
                position: "absolute",
                right: 0,
                top: tickTop(height, i, yTicks.length),
                transform: "translateY(-50%)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ position: "relative", height: height + valueBand }}>
          {showValues &&
            yTicks.map((_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: tickTop(height, i, yTicks.length),
                  borderTop: "1px solid var(--line-on-light-soft)",
                }}
              />
            ))}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "flex-end",
              gap: BAR_GAP,
            }}
          >
            {bars.map((b, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                }}
              >
                {showValues && (
                  <span style={{ ...labelStyle, height: VALUE_BAND, overflow: "hidden" }}>
                    {b.valueLabel}
                  </span>
                )}
                <div
                  style={{
                    width: "100%",
                    height: b.height === 0 ? 4 : Math.max(6, Math.round(b.height * height)),
                    background:
                      b.height === 0
                        ? "var(--data-bar-empty)"
                        : b.peak
                          ? "var(--data-bar-peak)"
                          : "var(--data-bar)",
                    borderRadius: "3px 3px 0 0",
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: AXIS_LINE, display: "flex", gap: BAR_GAP, height: AXIS_BAND }}>
          {bars.map((b, i) => (
            <span
              key={i}
              style={{
                ...labelStyle,
                flex: 1,
                minWidth: 0,
                textAlign: "center",
                paddingTop: 3,
                overflow: "visible",
              }}
            >
              {b.axisLabel}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
