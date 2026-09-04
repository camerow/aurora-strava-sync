import React from "react";
import { Link } from "react-router";
import type { DeleteAccountFeature, SettingsVM } from "@sendtally/features/settings";
import { azureButton, bodyText, linkAction, monoMuted, sectionLabel } from "./styles";
import { DeleteAccountSection } from "./DeleteAccountSection";

export type SettingsViewProps = {
  vm: SettingsVM;
  email: string;
  canSyncStrava: boolean;
  deletion: DeleteAccountFeature;
};

function Section({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        background: "#F7F6F3",
        border: "1px solid var(--line-on-light-soft)",
        borderRadius: "var(--radius-card)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

export function SettingsView({
  vm,
  email,
  canSyncStrava,
  deletion,
}: SettingsViewProps): React.ReactElement {
  return (
    <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 32,
            letterSpacing: "-0.03em",
          }}
        >
          Settings
        </h1>
        <span style={monoMuted}>{vm.headerBadge}</span>
      </div>

      <Section>
        <span style={sectionLabel}>STRAVA</span>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Strava</span>
            <span style={monoMuted}>{canSyncStrava ? vm.stravaStatusLabel : "MEMBERS ONLY"}</span>
          </span>
          {canSyncStrava && vm.stravaConnected && (
            <Link to="/app/setup" style={linkAction}>
              Re-link
            </Link>
          )}
        </div>
        {!canSyncStrava && (
          <>
            <p style={bodyText}>
              Strava sync is part of membership. Each logged session posts to your feed as a Rock
              Climbing activity, so board training counts toward your training load.
            </p>
            <Link to="/app/membership" style={{ ...azureButton, textDecoration: "none" }}>
              See membership
            </Link>
          </>
        )}
        {canSyncStrava && !vm.stravaConnected && (
          <>
            <p style={bodyText}>
              Connect Strava and your logged sessions can post to your feed as Rock Climbing
              activities.
            </p>
            <Link to="/app/setup" style={{ ...azureButton, textDecoration: "none" }}>
              Connect Strava
            </Link>
          </>
        )}
        {canSyncStrava && vm.stravaConnected && !vm.stravaActive && (
          <p style={bodyText}>
            Strava access has lapsed. Re-link it to start posting your sessions again.
          </p>
        )}
      </Section>

      <Section>
        <span style={sectionLabel}>ACCOUNT</span>
        <span style={monoMuted}>{email}</span>
        <DeleteAccountSection deletion={deletion} />
      </Section>
    </div>
  );
}
