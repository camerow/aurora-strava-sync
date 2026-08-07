import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  timezone: text("timezone").notNull().default("UTC"),
  created_at: text("created_at").notNull(),
  auto_sync: integer("auto_sync").notNull().default(0),
});

export const boardConnections = sqliteTable(
  "board_connections",
  {
    user_id: text("user_id")
      .notNull()
      .references(() => users.id),
    board: text("board").notNull(),
    board_user_id: integer("board_user_id").notNull(),
    token_ciphertext: text("token_ciphertext").notNull(),
    status: text("status").notNull().default("active"),
    sync_since: text("sync_since"),
    connected_at: text("connected_at").notNull(),
    posting_enabled: integer("posting_enabled").notNull().default(0),
    post_since: text("post_since"),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.board] })]
);

export const stravaConnections = sqliteTable("strava_connections", {
  user_id: text("user_id")
    .primaryKey()
    .references(() => users.id),
  athlete_id: integer("athlete_id").notNull(),
  access_token_ciphertext: text("access_token_ciphertext").notNull(),
  refresh_token_ciphertext: text("refresh_token_ciphertext").notNull(),
  expires_at: integer("expires_at").notNull(),
  status: text("status").notNull().default("active"),
  connected_at: text("connected_at").notNull(),
  posting_enabled: integer("posting_enabled").notNull().default(0),
  post_since: text("post_since"),
});

export const sessions = sqliteTable(
  "sessions",
  {
    user_id: text("user_id")
      .notNull()
      .references(() => users.id),
    fingerprint: text("fingerprint").notNull(),
    board: text("board"),
    start_at: text("start_at").notNull(),
    end_at: text("end_at").notNull(),
    climb_count: integer("climb_count").notNull(),
    top_grade: integer("top_grade").notNull(),
    rpe: integer("rpe").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    climbs_json: text("climbs_json"),
    strava_activity_id: integer("strava_activity_id"),
    posted_at: text("posted_at"),
  },
  (t) => [
    primaryKey({ columns: [t.user_id, t.fingerprint] }),
    index("idx_sessions_user_start").on(t.user_id, t.start_at),
  ]
);

export const boardClimbNames = sqliteTable(
  "board_climb_names",
  {
    board: text("board").notNull(),
    climb_uuid: text("climb_uuid").notNull(),
    name: text("name").notNull(),
  },
  (t) => [primaryKey({ columns: [t.board, t.climb_uuid] })]
);

export const boardClimbStats = sqliteTable(
  "board_climb_stats",
  {
    board: text("board").notNull(),
    climb_uuid: text("climb_uuid").notNull(),
    angle: integer("angle").notNull(),
    display_difficulty: real("display_difficulty").notNull(),
  },
  (t) => [primaryKey({ columns: [t.board, t.climb_uuid, t.angle] })]
);

export const boardCursors = sqliteTable(
  "board_cursors",
  {
    board: text("board").notNull(),
    table_name: text("table_name").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.board, t.table_name] })]
);

export const syncState = sqliteTable("sync_state", {
  user_id: text("user_id")
    .primaryKey()
    .references(() => users.id),
  last_synced_at: text("last_synced_at"),
  last_error: text("last_error"),
});
