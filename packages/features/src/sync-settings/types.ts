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
