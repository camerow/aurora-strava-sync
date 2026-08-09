import type React from "react";

export const sectionLabel: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--text-label-accent)",
};

export const bodyText: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "var(--text-on-white-secondary)",
  margin: 0,
};

export const monoMuted: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: "0.06em",
  color: "rgba(64,63,76,0.55)",
};

export const azureButton: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
  fontSize: 14,
  color: "var(--bs-white)",
  background: "var(--bs-azure-ink)",
  border: "none",
  borderRadius: "var(--radius-control)",
  padding: "12px 18px",
  cursor: "pointer",
  alignSelf: "flex-start",
};

export const underlineButton: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.06em",
  color: "rgba(64,63,76,0.6)",
  background: "none",
  border: "none",
  cursor: "pointer",
  textDecoration: "underline",
  padding: 0,
  alignSelf: "flex-start",
};

export const linkAction: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "rgba(64,63,76,0.6)",
  textDecoration: "underline",
};

export const rowDivider: React.CSSProperties = {
  borderTop: "1px solid var(--line-on-light)",
};

export const messageText: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "rgba(64,63,76,0.6)",
};
