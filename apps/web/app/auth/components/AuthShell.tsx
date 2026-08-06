import React from "react";
import { Logo } from "@sendtally/design";

export function AuthShell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "22px 32px",
        }}
      >
        <a
          href="/"
          style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
        >
          <Logo tone="on-light" size={24} />
        </a>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          padding: "56px 24px 80px",
        }}
      >
        {children}
        <span
          style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(64,63,76,0.55)" }}
        >
          free · not affiliated with Strava or Aurora Climbing
        </span>
      </div>
    </div>
  );
}

export function StepCard({
  step,
  width = 480,
  children,
}: {
  step: string;
  width?: number;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        width: `min(${width}px, 100%)`,
        background: "var(--bs-white)",
        border: "1px solid var(--line-on-light)",
        boxShadow: "0 4px 24px rgba(20,19,26,0.06)",
        borderRadius: "var(--radius-panel)",
        padding: 36,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          fontSize: 11,
          letterSpacing: "0.1em",
          color: "var(--text-label-accent)",
        }}
      >
        {step}
      </span>
      {children}
    </div>
  );
}

export function StepTitle({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 32,
        letterSpacing: "-0.03em",
        lineHeight: 1.05,
        color: "var(--bs-gunmetal)",
      }}
    >
      {children}
    </h1>
  );
}

export function StepBody({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p
      style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--text-on-white-secondary)" }}
    >
      {children}
    </p>
  );
}
