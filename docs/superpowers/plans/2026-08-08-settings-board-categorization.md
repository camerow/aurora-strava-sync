# Settings Reorganized By Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the web settings page and the mobile Sync tab into three sections - Scheduled sync, Connected boards (one card per board holding that board's sync and Strava-posting controls), and Strava - so each board is configured in one place.

**Architecture:** All the per-board derivation moves into one pure function, `syncSettingsVM`, in `@sendtally/features/sync-settings`, tested with Vitest the way the other feature transforms are. Both screens then render from that single view model, so web and mobile cannot drift. Presentation only: no D1 schema changes, no new endpoints, no cron or queue changes.

**Tech Stack:** TypeScript (strict), React 19, React Router 7 on Cloudflare Workers (web), Expo Router + React Native (mobile), Vitest, pnpm + Turborepo.

## Global Constraints

- The spec is `docs/superpowers/specs/2026-08-08-settings-board-categorization-design.md`. Read it before starting.
- Presentation only. Do not touch `packages/sync-service` (no schema, endpoint, cron, or queue changes). Do not touch `packages/api-client`.
- No new API calls. Only the existing `POST /v1/sync-now`, `POST /v1/strava/posting`, `POST /v1/sync-schedule`, and `GET /v1/status` are used, all through the existing `useSyncSettings` hook.
- Section order on both platforms: Scheduled sync, Connected boards, Strava. Mobile keeps its existing ACCOUNT section last.
- Section labels are exactly `SCHEDULED SYNC`, `CONNECTED BOARDS`, `STRAVA` (and mobile's existing `ACCOUNT`). The old `SCHEDULE`, `MANUAL SYNC`, `STRAVA POSTING`, and `CONNECTED ACCOUNTS` labels are all gone.
- No `any`. Explicit return types on all exported functions and React components. Prefer `type` over `interface`.
- Avoid comments in code.
- Package manager is `pnpm`, never `npm` or `yarn`. Turbo tasks run from the repo root.
- Run `pnpm format` before each commit.
- Conventional Commits. No AI co-author trailers.
- Branch is already `feat/settings-board-categorization`, based on `origin/staging`. Do not create another branch.

---

### Task 1: `syncSettingsVM` view model in `@sendtally/features`

Adds the single derived shape both screens render from, plus `messageBoard` so a status message can be attributed to the board that produced it.

**Files:**

- Create: `packages/features/src/sync-settings/types.ts`
- Create: `packages/features/src/sync-settings/transforms.ts`
- Test: `packages/features/src/sync-settings/transforms.test.ts`
- Modify: `packages/features/src/sync-settings/useSyncSettings.ts`
- Modify: `packages/features/src/sync-settings/index.ts`

**Interfaces:**

- Consumes: `ConnectionStatus`, `BoardStatus`, `StravaPostingMode`, `SyncScheduleMode` from `@sendtally/api-client`; `BOARD_LABELS` from `../session-detail/types`.
- Produces, all exported from `@sendtally/features/sync-settings`:
  - `type BoardCardVM = { board: string; label: string; statusLabel: string; isActive: boolean; postingEnabled: boolean; postingLabel: string; syncing: boolean; syncDisabled: boolean }`
  - `type SyncSettingsVM = { boards: BoardCardVM[]; hasBoards: boolean; stravaConnected: boolean; stravaActive: boolean; stravaStatusLabel: string; headerBadge: string; autoSync: boolean; lastSyncLabel: string }`
  - `function syncSettingsVM(status: ConnectionStatus | null, syncingBoard: string | null): SyncSettingsVM`
  - `function boardLabelOf(board: string): string`
  - `SyncSettingsFeature` gains `vm: SyncSettingsVM`, `ready: boolean`, and `messageBoard: string | null`. Every existing field stays.

- [ ] **Step 1: Write the failing test**

Create `packages/features/src/sync-settings/transforms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ConnectionStatus } from "@sendtally/api-client";
import { syncSettingsVM } from "./transforms";

const base: ConnectionStatus = {
  boards: [],
  strava: null,
  sync: null,
  autoSync: false,
};

describe("syncSettingsVM", () => {
  it("handles a null status", () => {
    const vm = syncSettingsVM(null, null);
    expect(vm.boards).toEqual([]);
    expect(vm.hasBoards).toBe(false);
    expect(vm.stravaConnected).toBe(false);
    expect(vm.stravaActive).toBe(false);
    expect(vm.stravaStatusLabel).toBe("NOT CONNECTED");
    expect(vm.headerBadge).toBe("NOT CONNECTED");
    expect(vm.autoSync).toBe(false);
    expect(vm.lastSyncLabel).toBe("FIRST IMPORT PENDING");
  });

  it("labels an active board with posting off", () => {
    const vm = syncSettingsVM(
      {
        ...base,
        boards: [{ board: "tension", status: "active", postingEnabled: false, postSince: null }],
        strava: { athleteId: 42, status: "active" },
        autoSync: true,
      },
      null
    );
    expect(vm.boards).toHaveLength(1);
    expect(vm.boards[0]?.label).toBe("Tension Board");
    expect(vm.boards[0]?.statusLabel).toBe("AURORA TOKEN · ACTIVE");
    expect(vm.boards[0]?.isActive).toBe(true);
    expect(vm.boards[0]?.postingLabel).toBe("POSTING OFF");
    expect(vm.hasBoards).toBe(true);
    expect(vm.stravaConnected).toBe(true);
    expect(vm.stravaActive).toBe(true);
    expect(vm.stravaStatusLabel).toBe("ATHLETE 42 · ACTIVE");
    expect(vm.headerBadge).toBe("BOARD ONLY");
    expect(vm.autoSync).toBe(true);
  });

  it("reports STRAVA + BOARD when any board posts and Strava is active", () => {
    const vm = syncSettingsVM(
      {
        ...base,
        boards: [
          { board: "tension", status: "active", postingEnabled: false, postSince: null },
          { board: "kilter", status: "active", postingEnabled: true, postSince: null },
        ],
        strava: { athleteId: 7, status: "active" },
      },
      null
    );
    expect(vm.headerBadge).toBe("STRAVA + BOARD");
    expect(vm.boards[1]?.postingLabel).toBe("POSTING ON");
  });

  it("does not report STRAVA + BOARD when Strava is not active", () => {
    const vm = syncSettingsVM(
      {
        ...base,
        boards: [{ board: "tension", status: "active", postingEnabled: true, postSince: null }],
        strava: { athleteId: 7, status: "revoked" },
      },
      null
    );
    expect(vm.stravaConnected).toBe(true);
    expect(vm.stravaActive).toBe(false);
    expect(vm.stravaStatusLabel).toBe("ATHLETE 7 · REVOKED");
    expect(vm.headerBadge).toBe("BOARD ONLY");
  });

  it("marks the syncing board and disables every board's button", () => {
    const vm = syncSettingsVM(
      {
        ...base,
        boards: [
          { board: "tension", status: "active", postingEnabled: false, postSince: null },
          { board: "kilter", status: "active", postingEnabled: false, postSince: null },
        ],
      },
      "tension"
    );
    expect(vm.boards[0]?.syncing).toBe(true);
    expect(vm.boards[0]?.syncDisabled).toBe(true);
    expect(vm.boards[1]?.syncing).toBe(false);
    expect(vm.boards[1]?.syncDisabled).toBe(true);
  });

  it("keeps an inactive board in the list but marks it inactive", () => {
    const vm = syncSettingsVM(
      {
        ...base,
        boards: [{ board: "kilter", status: "revoked", postingEnabled: false, postSince: null }],
      },
      null
    );
    expect(vm.boards[0]?.isActive).toBe(false);
    expect(vm.boards[0]?.statusLabel).toBe("AURORA TOKEN · REVOKED");
    expect(vm.hasBoards).toBe(true);
  });

  it("falls back to a generic label for an unknown board", () => {
    const vm = syncSettingsVM(
      {
        ...base,
        boards: [{ board: "mystery", status: "active", postingEnabled: false, postSince: null }],
      },
      null
    );
    expect(vm.boards[0]?.label).toBe("Board");
  });

  it("renders a last sync timestamp when one exists", () => {
    const vm = syncSettingsVM(
      { ...base, sync: { lastSyncedAt: "2026-07-01T18:00:00.000Z", lastError: null } },
      null
    );
    expect(vm.lastSyncLabel.startsWith("LAST SYNC ")).toBe(true);
    expect(vm.lastSyncLabel).toBe(vm.lastSyncLabel.toUpperCase());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @sendtally/features test`
Expected: FAIL - cannot resolve `./transforms`.

- [ ] **Step 3: Write the types**

Create `packages/features/src/sync-settings/types.ts`:

```ts
export type BoardCardVM = {
  board: string;
  label: string;
  statusLabel: string;
  isActive: boolean;
  postingEnabled: boolean;
  postingLabel: string;
  syncing: boolean;
  syncDisabled: boolean;
};

export type SyncSettingsVM = {
  boards: BoardCardVM[];
  hasBoards: boolean;
  stravaConnected: boolean;
  stravaActive: boolean;
  stravaStatusLabel: string;
  headerBadge: string;
  autoSync: boolean;
  lastSyncLabel: string;
};
```

- [ ] **Step 4: Write the transform**

Create `packages/features/src/sync-settings/transforms.ts`:

```ts
import type { ConnectionStatus } from "@sendtally/api-client";
import { BOARD_LABELS } from "../session-detail/types";
import type { BoardCardVM, SyncSettingsVM } from "./types";

export function boardLabelOf(board: string): string {
  return BOARD_LABELS[board] ?? "Board";
}

function lastSyncLabelOf(lastSyncedAt: string | null): string {
  if (lastSyncedAt === null) return "FIRST IMPORT PENDING";
  const stamp = new Date(lastSyncedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `LAST SYNC ${stamp.toUpperCase()}`;
}

export function syncSettingsVM(
  status: ConnectionStatus | null,
  syncingBoard: string | null
): SyncSettingsVM {
  const rows = status?.boards ?? [];
  const strava = status?.strava ?? null;
  const stravaActive = strava?.status === "active";
  const boards: BoardCardVM[] = rows.map((b) => ({
    board: b.board,
    label: boardLabelOf(b.board),
    statusLabel: `AURORA TOKEN · ${b.status.toUpperCase()}`,
    isActive: b.status === "active",
    postingEnabled: b.postingEnabled,
    postingLabel: b.postingEnabled ? "POSTING ON" : "POSTING OFF",
    syncing: syncingBoard === b.board,
    syncDisabled: syncingBoard !== null,
  }));
  const anyPostingOn = stravaActive && rows.some((b) => b.postingEnabled);
  return {
    boards,
    hasBoards: boards.length > 0,
    stravaConnected: strava !== null,
    stravaActive,
    stravaStatusLabel:
      strava === null
        ? "NOT CONNECTED"
        : `ATHLETE ${strava.athleteId} · ${strava.status.toUpperCase()}`,
    headerBadge: anyPostingOn
      ? "STRAVA + BOARD"
      : boards.length > 0
        ? "BOARD ONLY"
        : "NOT CONNECTED",
    autoSync: status?.autoSync === true,
    lastSyncLabel: lastSyncLabelOf(status?.sync?.lastSyncedAt ?? null),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @sendtally/features test`
Expected: PASS, all 8 `syncSettingsVM` tests green, plus the existing `trends` and `session-detail` transform tests still green.

- [ ] **Step 6: Wire the view model and `messageBoard` into the hook**

Replace the whole of `packages/features/src/sync-settings/useSyncSettings.ts` with:

```ts
import React from "react";
import type {
  ConnectionStatus,
  SendtallyApi,
  StravaPostingMode,
  SyncScheduleMode,
} from "@sendtally/api-client";
import { useQuery, type QueryState } from "../lib/useQuery";
import { syncSettingsVM } from "./transforms";
import type { SyncSettingsVM } from "./types";

export type SyncSettingsFeature = {
  state: QueryState<ConnectionStatus>;
  vm: SyncSettingsVM;
  ready: boolean;
  reload: () => void;
  syncingBoard: string | null;
  syncBoard: (board: string) => Promise<void>;
  postingBoard: string | null;
  setPosting: (board: string, mode: StravaPostingMode) => Promise<void>;
  scheduleBusy: boolean;
  setSchedule: (mode: SyncScheduleMode) => Promise<void>;
  message: string | null;
  messageBoard: string | null;
};

export function useSyncSettings(api: SendtallyApi): SyncSettingsFeature {
  const load = React.useCallback(() => api.status(), [api]);
  const { state, reload } = useQuery(load);
  const [syncingBoard, setSyncingBoard] = React.useState<string | null>(null);
  const [postingBoard, setPostingBoard] = React.useState<string | null>(null);
  const [scheduleBusy, setScheduleBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [messageBoard, setMessageBoard] = React.useState<string | null>(null);

  const syncBoard = React.useCallback(
    async (board: string): Promise<void> => {
      setSyncingBoard(board);
      setMessage(null);
      setMessageBoard(board);
      try {
        await api.syncNow(board);
        setMessage("Sync queued - new sessions land in about a minute.");
      } catch {
        setMessage("Could not queue a sync. Try again.");
      }
      setTimeout(() => {
        setSyncingBoard(null);
        reload();
      }, 6000);
    },
    [api, reload]
  );

  const setPosting = React.useCallback(
    async (board: string, mode: StravaPostingMode): Promise<void> => {
      setPostingBoard(board);
      setMessage(null);
      setMessageBoard(board);
      try {
        await api.setStravaPosting(board, mode);
        reload();
      } catch {
        setMessage("Could not update Strava posting.");
      }
      setPostingBoard(null);
    },
    [api, reload]
  );

  const setSchedule = React.useCallback(
    async (mode: SyncScheduleMode): Promise<void> => {
      setScheduleBusy(true);
      setMessage(null);
      setMessageBoard(null);
      try {
        await api.setSyncSchedule(mode);
        reload();
      } catch {
        setMessage("Could not update the sync schedule.");
      }
      setScheduleBusy(false);
    },
    [api, reload]
  );

  const status = state.status === "ready" ? state.data : null;
  const vm = React.useMemo(() => syncSettingsVM(status, syncingBoard), [status, syncingBoard]);

  return {
    state,
    vm,
    ready: state.status === "ready",
    reload,
    syncingBoard,
    syncBoard,
    postingBoard,
    setPosting,
    scheduleBusy,
    setSchedule,
    message,
    messageBoard,
  };
}
```

- [ ] **Step 7: Export the new surface**

Replace `packages/features/src/sync-settings/index.ts` with:

```ts
export { useSyncSettings, type SyncSettingsFeature } from "./useSyncSettings";
export { boardLabelOf, syncSettingsVM } from "./transforms";
export type { BoardCardVM, SyncSettingsVM } from "./types";
```

- [ ] **Step 8: Verify types and tests**

Run: `pnpm --filter @sendtally/features check-types && pnpm --filter @sendtally/features test`
Expected: no type errors, all tests PASS.

- [ ] **Step 9: Format and commit**

```bash
pnpm format
git add packages/features/src/sync-settings
git commit -m "feat(features): derive a per-board sync settings view model"
```

---

### Task 2: Web settings page restructured into three sections

**Files:**

- Create: `apps/web/app/settings/components/styles.ts`
- Create: `apps/web/app/settings/components/BoardCard.tsx`
- Modify: `apps/web/app/routes/app.settings.tsx` (full rewrite of the module below the loader)

**Interfaces:**

- Consumes from Task 1: `useSyncSettings` returning `{ vm, ready, syncBoard, postingBoard, setPosting, scheduleBusy, setSchedule, message, messageBoard }`, and the `BoardCardVM` type.
- Produces: `BoardCard` with props `{ board: BoardCardVM; stravaActive: boolean; postingBusy: boolean; message: string | null; onSync: () => void; onPosting: (mode: StravaPostingMode) => void }`, and the style consts `sectionLabel`, `bodyText`, `monoMuted`, `azureButton`, `underlineButton`, `linkAction`, `rowDivider` from `styles.ts`.

This task has no unit test: these are presentational components and the repo has no React test harness for web (no `@testing-library/react` in any `package.json`). Verification is type-checking plus running the app, in Step 6.

- [ ] **Step 1: Extract the shared styles**

Create `apps/web/app/settings/components/styles.ts`:

```ts
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
```

- [ ] **Step 2: Write the board card**

Create `apps/web/app/settings/components/BoardCard.tsx`:

```tsx
import React from "react";
import { Link } from "react-router";
import type { StravaPostingMode } from "@sendtally/api-client";
import type { BoardCardVM } from "@sendtally/features/sync-settings";
import {
  azureButton,
  bodyText,
  linkAction,
  messageText,
  monoMuted,
  rowDivider,
  underlineButton,
} from "./styles";

export type BoardCardProps = {
  board: BoardCardVM;
  stravaActive: boolean;
  postingBusy: boolean;
  message: string | null;
  onSync: () => void;
  onPosting: (mode: StravaPostingMode) => void;
};

export function BoardCard({
  board,
  stravaActive,
  postingBusy,
  message,
  onSync,
  onPosting,
}: BoardCardProps): React.ReactElement {
  return (
    <div
      style={{
        ...rowDivider,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "14px 0",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{board.label}</span>
          <span style={monoMuted}>{board.statusLabel}</span>
        </span>
        <Link to="/app/setup?add=board" style={linkAction}>
          Re-link
        </Link>
      </div>

      {board.isActive && (
        <button
          onClick={onSync}
          disabled={board.syncDisabled}
          style={{ ...azureButton, opacity: board.syncDisabled ? 0.45 : 1 }}
        >
          {board.syncing ? "Syncing…" : "Sync now"}
        </button>
      )}

      {board.isActive &&
        (stravaActive ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={monoMuted}>{board.postingLabel}</span>
            {board.postingEnabled ? (
              <button
                onClick={() => onPosting("off")}
                disabled={postingBusy}
                style={underlineButton}
              >
                TURN OFF STRAVA POSTING
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => onPosting("new")} disabled={postingBusy} style={azureButton}>
                  Post new sessions
                </button>
                <button
                  onClick={() => onPosting("all")}
                  disabled={postingBusy}
                  style={{ ...azureButton, background: "var(--bs-watermelon-ink)" }}
                >
                  Post full history
                </button>
              </div>
            )}
          </div>
        ) : (
          <p style={bodyText}>
            Connect Strava below to post this board&rsquo;s sessions to your feed.
          </p>
        ))}

      {message !== null && <span style={messageText}>{message}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the settings route**

Replace the entire contents of `apps/web/app/routes/app.settings.tsx` with:

```tsx
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
```

- [ ] **Step 4: Verify types**

Run: `pnpm --filter @sendtally/web check-types`
Expected: no errors. The rewritten route deliberately no longer imports `BOARD_LABELS` or declares local style consts - `boardLabelOf` runs inside the view model and the styles moved to `styles.ts`.

- [ ] **Step 5: Verify the old sections are gone**

Run: `grep -n "MANUAL SYNC\|STRAVA POSTING\|CONNECTED ACCOUNTS" apps/web/app/routes/app.settings.tsx`
Expected: no output (exit code 1).

- [ ] **Step 6: Run the web app and check it**

Run: `pnpm --filter @sendtally/web dev`

Open `/app/settings` while signed in and confirm:

- Three cards in order: SCHEDULED SYNC, CONNECTED BOARDS, STRAVA.
- Each connected board appears once under CONNECTED BOARDS with its status, a `Sync now` button, and its posting controls.
- The schedule toggle still flips and persists across a reload.
- `Sync now` on a board shows `Syncing…` in that card and disables the other boards' buttons.
- The posting buttons still change the board's POSTING ON/OFF state.
- Nothing overflows or misaligns at a narrow viewport (~380px wide) - fix any layout break you see.

- [ ] **Step 7: Format and commit**

```bash
pnpm format
git add apps/web/app/settings apps/web/app/routes/app.settings.tsx
git commit -m "feat(web): organize sync settings by connected board"
```

---

### Task 3: Mobile Sync tab restructured to match

**Files:**

- Create: `apps/mobile/features/sync/BoardCard.tsx`
- Modify: `apps/mobile/app/(tabs)/sync.tsx` (full rewrite)

**Interfaces:**

- Consumes from Task 1: the same `useSyncSettings` fields and `BoardCardVM` type as Task 2.
- Produces: native `BoardCard` with props `{ board: BoardCardVM; stravaActive: boolean; postingBusy: boolean; message: string | null; onSync: () => void; onPosting: (mode: StravaPostingMode) => void }`. No Re-link action - mobile does not own connect flows.

- [ ] **Step 1: Write the native board card**

Create `apps/mobile/features/sync/BoardCard.tsx`:

```tsx
import React from "react";
import { Pressable, Text, View } from "react-native";
import type { StravaPostingMode } from "@sendtally/api-client";
import type { BoardCardVM } from "@sendtally/features/sync-settings";
import { colors, fonts, radius } from "@sendtally/design/tokens";

export type BoardCardProps = {
  board: BoardCardVM;
  stravaActive: boolean;
  postingBusy: boolean;
  message: string | null;
  onSync: () => void;
  onPosting: (mode: StravaPostingMode) => void;
};

export function BoardCard({
  board,
  stravaActive,
  postingBusy,
  message,
  onSync,
  onPosting,
}: BoardCardProps): React.ReactElement {
  return (
    <View
      style={{
        gap: 10,
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: colors.lineOnLight,
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.gunmetal }}>
          {board.label}
        </Text>
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: 9,
            letterSpacing: 0.7,
            color: colors.textMuted,
          }}
        >
          {board.statusLabel}
        </Text>
      </View>

      {board.isActive && (
        <Pressable
          onPress={onSync}
          disabled={board.syncDisabled}
          style={{
            backgroundColor: colors.azureInk,
            borderRadius: radius.control,
            paddingVertical: 14,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            opacity: board.syncDisabled ? 0.45 : 1,
          }}
        >
          <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 15, color: colors.white }}>
            {board.syncing ? "Syncing…" : "Sync now"}
          </Text>
        </Pressable>
      )}

      {board.isActive &&
        (stravaActive ? (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 9,
                letterSpacing: 0.7,
                color: colors.textMuted,
              }}
            >
              {board.postingLabel}
            </Text>
            {board.postingEnabled ? (
              <Pressable
                onPress={() => onPosting("off")}
                disabled={postingBusy}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 11,
                    letterSpacing: 0.6,
                    color: "rgba(64,63,76,0.6)",
                    textDecorationLine: "underline",
                  }}
                >
                  TURN OFF STRAVA POSTING
                </Text>
              </Pressable>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Pressable
                  onPress={() => onPosting("new")}
                  disabled={postingBusy}
                  style={{
                    backgroundColor: colors.azureInk,
                    borderRadius: radius.control,
                    paddingHorizontal: 14,
                    minHeight: 44,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.white }}
                  >
                    Post new sessions
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onPosting("all")}
                  disabled={postingBusy}
                  style={{
                    backgroundColor: colors.watermelonInk,
                    borderRadius: radius.control,
                    paddingHorizontal: 14,
                    minHeight: 44,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ fontFamily: fonts.sansSemiBold, fontSize: 13, color: colors.white }}
                  >
                    Post full history
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <Text
            style={{
              fontFamily: fonts.sans,
              fontSize: 13,
              lineHeight: 20,
              color: colors.textSecondary,
            }}
          >
            Connect Strava on the web at sendtally.com to post this board&rsquo;s sessions.
          </Text>
        ))}

      {message !== null && (
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            lineHeight: 17,
            color: colors.textSecondary,
          }}
        >
          {message}
        </Text>
      )}
    </View>
  );
}
```

`colors.lineOnLight` is `rgba(64,63,76,0.1)` in `packages/design/src/tokens.ts:22` - it exists, use it as written.

- [ ] **Step 2: Rewrite the Sync tab**

Replace the entire contents of `apps/mobile/app/(tabs)/sync.tsx` with:

```tsx
import { useClerk, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSyncSettings } from "@sendtally/features/sync-settings";
import { colors, fonts, radius } from "@sendtally/design/tokens";
import { Logo } from "../../components/Logo";
import { BoardCard } from "../../features/sync/BoardCard";
import { useApi } from "../../lib/api";

function SectionCard({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceSoft,
        borderWidth: 1,
        borderColor: colors.lineOnLightSoft,
        borderRadius: radius.card,
        padding: 18,
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}

function SectionLabel({ children }: { children: string }): React.ReactElement {
  return (
    <Text
      style={{
        fontFamily: fonts.monoMedium,
        fontSize: 10,
        letterSpacing: 0.8,
        color: colors.watermelonInk,
      }}
    >
      {children}
    </Text>
  );
}

function BodyText({ children }: { children: string }): React.ReactElement {
  return (
    <Text
      style={{
        fontFamily: fonts.sans,
        fontSize: 13,
        lineHeight: 20,
        color: colors.textSecondary,
      }}
    >
      {children}
    </Text>
  );
}

function MonoMuted({ children }: { children: string }): React.ReactElement {
  return (
    <Text
      style={{
        fontFamily: fonts.monoMedium,
        fontSize: 10,
        letterSpacing: 0.6,
        color: colors.textMuted,
      }}
    >
      {children}
    </Text>
  );
}

export default function Sync(): React.ReactElement {
  const api = useApi();
  const clerk = useClerk();
  const { user } = useUser();
  const router = useRouter();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 12,
          paddingBottom: 24,
          gap: 14,
        }}
      >
        <Logo size={18} />
        <View style={{ gap: 4 }}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 32,
              letterSpacing: -1,
              color: colors.gunmetal,
            }}
          >
            Sync
          </Text>
          <MonoMuted>{vm.headerBadge}</MonoMuted>
        </View>

        <SectionCard>
          <SectionLabel>SCHEDULED SYNC</SectionLabel>
          <BodyText>
            {vm.autoSync
              ? "Automatic daily sync is on - the server checks your boards once a day and imports anything new."
              : "Automatic sync is off. Sync each board by hand below, or turn on a once-a-day automatic check."}
          </BodyText>
          <Pressable
            onPress={() => void setSchedule(vm.autoSync ? "off" : "daily")}
            disabled={scheduleBusy || !ready}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                letterSpacing: 0.6,
                color: vm.autoSync ? "rgba(64,63,76,0.6)" : colors.azureInk,
                textDecorationLine: "underline",
              }}
            >
              {vm.autoSync ? "TURN OFF DAILY SYNC" : "TURN ON DAILY SYNC"}
            </Text>
          </Pressable>
          {vm.hasBoards ? (
            vm.boards.map((b) => (
              <View
                key={b.board}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Text
                  style={{ fontFamily: fonts.sansSemiBold, fontSize: 14, color: colors.gunmetal }}
                >
                  {b.label}
                </Text>
                <MonoMuted>{b.statusLabel}</MonoMuted>
              </View>
            ))
          ) : (
            <BodyText>
              Connect a board on the web at sendtally.com and the daily sync covers it.
            </BodyText>
          )}
          <MonoMuted>{vm.lastSyncLabel}</MonoMuted>
          {messageBoard === null && message !== null && (
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                lineHeight: 17,
                color: colors.textSecondary,
              }}
            >
              {message}
            </Text>
          )}
        </SectionCard>

        <SectionCard>
          <SectionLabel>CONNECTED BOARDS</SectionLabel>
          {vm.hasBoards ? (
            vm.boards.map((b) => (
              <BoardCard
                key={b.board}
                board={b}
                stravaActive={vm.stravaActive}
                postingBusy={postingBoard !== null}
                message={messageBoard === b.board ? message : null}
                onSync={() => void syncBoard(b.board)}
                onPosting={(mode) => void setPosting(b.board, mode)}
              />
            ))
          ) : (
            <BodyText>Connect a board on the web at sendtally.com and it appears here.</BodyText>
          )}
        </SectionCard>

        <SectionCard>
          <SectionLabel>STRAVA</SectionLabel>
          <MonoMuted>{vm.stravaStatusLabel}</MonoMuted>
          <BodyText>
            {vm.stravaActive
              ? "Choose per board above which sessions post to your Strava feed."
              : "Connect Strava on the web at sendtally.com, then choose per board what gets posted."}
          </BodyText>
        </SectionCard>

        <SectionCard>
          <SectionLabel>ACCOUNT</SectionLabel>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted }}>
            {user?.primaryEmailAddress?.emailAddress ?? ""}
          </Text>
          <BodyText>Board and Strava connections are managed on the web at sendtally.com.</BodyText>
          <Pressable
            onPress={() => {
              void clerk.signOut().then(() => router.replace("/sign-in"));
            }}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 12,
                color: "rgba(64,63,76,0.6)",
                textDecorationLine: "underline",
              }}
            >
              Sign out
            </Text>
          </Pressable>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify types**

Run: `pnpm --filter @sendtally/mobile check-types`
Expected: no errors. If the mobile package name differs, get it with `node -e "console.log(require('./apps/mobile/package.json').name)"` and use that.

- [ ] **Step 4: Verify the old sections are gone**

Run: `grep -n "MANUAL SYNC\|STRAVA POSTING" "apps/mobile/app/(tabs)/sync.tsx"`
Expected: no output (exit code 1).

- [ ] **Step 5: Run the app on a simulator and check the tab**

Run: `pnpm --filter @sendtally/mobile ios` (or `pnpm --filter @sendtally/mobile start` then press `i`).

On the SYNC tab confirm:

- Four cards in order: SCHEDULED SYNC, CONNECTED BOARDS, STRAVA, ACCOUNT.
- With a board connected, it appears once under CONNECTED BOARDS with its status, `Sync now`, and posting controls.
- With no board connected, CONNECTED BOARDS shows the "connect a board on the web" line and no card.
- Every tappable target is at least 44pt tall and nothing is clipped or misaligned - fix any layout break you see.

If no simulator is available in this environment, say so explicitly in the final report rather than claiming the tab was verified.

- [ ] **Step 6: Format and commit**

```bash
pnpm format
git add apps/mobile/features/sync "apps/mobile/app/(tabs)/sync.tsx"
git commit -m "feat(mobile): organize the sync tab by connected board"
```

---

### Task 4: Repo-wide verification

**Files:** none created or modified unless a check fails.

**Interfaces:**

- Consumes: the finished work of Tasks 1-3.
- Produces: a green repo.

- [ ] **Step 1: Run the full check suite**

```bash
pnpm check-types && pnpm test && pnpm format:check
```

Expected: all three PASS. `pnpm lint` is also a root task - run it too and fix anything it reports, including pre-existing warnings in the files this plan touched.

- [ ] **Step 2: Fix anything that failed**

Fix failures in the files this plan touched. If a failure is pre-existing and unrelated, fix it anyway when it is small, and note it in the final commit message; do not leave a red check behind.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore: satisfy checks after settings reorganization"
```

Skip this step if nothing needed fixing.

- [ ] **Step 4: Confirm the branch is clean and based on staging**

```bash
git status --short
git log --oneline origin/staging..HEAD
```

Expected: empty status; the log shows the spec commit plus the commits from Tasks 1-3.
