import React from "react";
import { TREND_RANGES, type TrendsFeature } from "@sendtally/features/trends";
import { BOARD_LABELS } from "@sendtally/features/session-detail";

const chipStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.06em",
  padding: "7px 12px",
  borderRadius: "var(--radius-pill)",
  cursor: "pointer",
  background: active ? "var(--bs-gold)" : "transparent",
  color: active ? "var(--bs-gunmetal)" : "rgba(64,63,76,0.65)",
  border: active ? "1px solid var(--bs-gold)" : "1px solid rgba(64,63,76,0.18)",
});

export function TrendFilters({ feature }: { feature: TrendsFeature }): React.ReactElement {
  const { range, setRange, board, setBoard, boards } = feature;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TREND_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            style={chipStyle(range === r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>
      {boards.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setBoard(null)} style={chipStyle(board === null)}>
            ALL BOARDS
          </button>
          {boards.map((b) => (
            <button key={b} onClick={() => setBoard(b)} style={chipStyle(board === b)}>
              {(BOARD_LABELS[b] ?? b).toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
