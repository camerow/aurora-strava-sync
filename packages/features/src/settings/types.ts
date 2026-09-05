export type SettingsVM = {
  stravaConnected: boolean;
  stravaActive: boolean;
  stravaStatusLabel: string;
  headerBadge: string;
};

export type DeleteAccountStatus = "idle" | "confirming" | "deleting" | "deleted";
