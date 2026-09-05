import { describe, expect, it } from "vitest";
import type { ConnectionStatus } from "@sendtally/api-client";
import { deleteConfirmationMatches, settingsVM } from "./transforms";

function status(overrides: Partial<ConnectionStatus> = {}): ConnectionStatus {
  return {
    boards: [],
    strava: null,
    sync: null,
    autoSync: false,
    ...overrides,
  };
}

describe("settingsVM", () => {
  it("reports a disconnected state while loading or without Strava", () => {
    expect(settingsVM(null)).toEqual({
      stravaConnected: false,
      stravaActive: false,
      stravaStatusLabel: "NOT CONNECTED",
      headerBadge: "STRAVA NOT CONNECTED",
    });
    expect(settingsVM(status()).stravaConnected).toBe(false);
  });

  it("labels an active Strava connection", () => {
    const vm = settingsVM(status({ strava: { athleteId: 42, status: "active" } }));
    expect(vm.stravaConnected).toBe(true);
    expect(vm.stravaActive).toBe(true);
    expect(vm.stravaStatusLabel).toBe("ATHLETE 42 · ACTIVE");
    expect(vm.headerBadge).toBe("STRAVA CONNECTED");
  });

  it("flags a dead Strava connection as connected but inactive", () => {
    const vm = settingsVM(status({ strava: { athleteId: 42, status: "dead" } }));
    expect(vm.stravaConnected).toBe(true);
    expect(vm.stravaActive).toBe(false);
    expect(vm.stravaStatusLabel).toBe("ATHLETE 42 · DEAD");
  });
});

describe("deleteConfirmationMatches", () => {
  it("accepts the confirmation word regardless of case or padding", () => {
    expect(deleteConfirmationMatches("DELETE")).toBe(true);
    expect(deleteConfirmationMatches("  delete ")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(deleteConfirmationMatches("")).toBe(false);
    expect(deleteConfirmationMatches("del")).toBe(false);
    expect(deleteConfirmationMatches("delete my account")).toBe(false);
  });
});
