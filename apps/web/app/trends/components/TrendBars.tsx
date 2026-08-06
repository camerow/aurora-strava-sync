import React from "react";
import type { TrendBarVM } from "@sendtally/features/trends";

export function TrendBars({
  bars,
  height,
  showValues = false,
}: {
  bars: TrendBarVM[];
  height: number;
  showValues?: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 5,
        height: showValues ? height + 34 : height,
      }}
    >
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            alignSelf: "flex-end",
            minWidth: 0,
          }}
        >
          {showValues && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 9,
                color: "rgba(64,63,76,0.72)",
                whiteSpace: "nowrap",
              }}
            >
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
          {showValues && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                fontSize: 9,
                color: "rgba(64,63,76,0.72)",
                whiteSpace: "nowrap",
              }}
            >
              {b.axisLabel}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
