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
