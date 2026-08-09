import React from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { useSyncSettings } from "@sendtally/features/sync-settings";
import { cloudflareContext } from "../lib/cloudflare-context";
import { requireApi } from "../lib/api.server";
import { useClientApi } from "../lib/useClientApi";
import { BoardCard } from "../settings/components/BoardCard";
import {
  azureButton,
  bodyText,
  linkAction,
  messageText,
  monoMuted,
  rowDivider,
  sectionLabel,
  underlineButton,
} from "../settings/components/styles";

export async function loader(args: LoaderFunctionArgs): Promise<{ apiUrl: string }> {
  await requireApi(args);
  return { apiUrl: args.context.get(cloudflareContext).env.API_URL };
}

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

export default function SettingsRoute(): React.ReactElement {
  const { apiUrl } = useLoaderData<typeof loader>();
  const api = useClientApi(apiUrl);
  const {
    vm,
    ready,
    syncBoard,
    postingBoard,
    setPosting,
    scheduleBusy,
    setSchedule,
    message,
    messageBoard,
  } = useSyncSettings(api);

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
          Sync &amp; accounts
        </h1>
        <span style={monoMuted}>{vm.headerBadge}</span>
      </div>

      <Section>
        <span style={sectionLabel}>SCHEDULED SYNC</span>
        <p style={bodyText}>
          {vm.autoSync
            ? "Automatic daily sync is on - the server checks your boards once a day and imports anything new."
            : "Automatic sync is off. Sync each board by hand below, or turn on a once-a-day automatic check."}
        </p>
        <button
          onClick={() => void setSchedule(vm.autoSync ? "off" : "daily")}
          disabled={scheduleBusy || !ready}
          style={
            vm.autoSync
              ? { ...underlineButton, opacity: scheduleBusy ? 0.45 : 1 }
              : { ...azureButton, opacity: scheduleBusy || !ready ? 0.45 : 1 }
          }
        >
          {vm.autoSync ? "TURN OFF DAILY SYNC" : "Turn on daily sync"}
        </button>
        {vm.hasBoards ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {vm.boards.map((b) => (
              <div
                key={b.board}
                style={{
                  ...rowDivider,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 0",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>{b.label}</span>
                <span style={monoMuted}>{b.statusLabel}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={bodyText}>Connect a board below and the daily sync covers it.</p>
        )}
        <span style={monoMuted}>{vm.lastSyncLabel}</span>
        {messageBoard === null && message !== null && <span style={messageText}>{message}</span>}
      </Section>

      <Section>
        <span style={sectionLabel}>CONNECTED BOARDS</span>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {vm.boards.map((b) => (
            <BoardCard
              key={b.board}
              board={b}
              stravaActive={vm.stravaActive}
              postingBusy={postingBoard !== null}
              message={messageBoard === b.board ? message : null}
              onSync={() => void syncBoard(b.board)}
              onPosting={(mode) => void setPosting(b.board, mode)}
            />
          ))}
          <div
            style={{
              ...rowDivider,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
            }}
          >
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>
                {vm.hasBoards ? "Another board" : "Board"}
              </span>
              <span style={monoMuted}>
                {vm.hasBoards ? "TENSION, KILTER, AND MORE" : "NOT LINKED"}
              </span>
            </span>
            <Link to="/app/setup?add=board" style={linkAction}>
              {vm.hasBoards ? "Connect" : "Link"}
            </Link>
          </div>
        </div>
      </Section>

      <Section>
        <span style={sectionLabel}>STRAVA</span>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Strava</span>
            <span style={monoMuted}>{vm.stravaStatusLabel}</span>
          </span>
          <Link to="/app/setup" style={linkAction}>
            {vm.stravaConnected ? "Re-link" : "Connect"}
          </Link>
        </div>
        {!vm.stravaActive && (
          <p style={bodyText}>
            Connect Strava and choose per board which sessions post to your feed as Rock Climbing
            activities.
          </p>
        )}
      </Section>
    </div>
  );
}
