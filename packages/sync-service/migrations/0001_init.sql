CREATE TABLE users (
    id TEXT PRIMARY KEY,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    created_at TEXT NOT NULL
);

CREATE TABLE board_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    board TEXT NOT NULL,
    board_user_id INTEGER NOT NULL,
    token_ciphertext TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    sync_since TEXT,
    connected_at TEXT NOT NULL
);

CREATE TABLE strava_connections (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    athlete_id INTEGER NOT NULL,
    access_token_ciphertext TEXT NOT NULL,
    refresh_token_ciphertext TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    connected_at TEXT NOT NULL
);

CREATE TABLE sessions (
    user_id TEXT NOT NULL REFERENCES users(id),
    fingerprint TEXT NOT NULL,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    climb_count INTEGER NOT NULL,
    top_grade INTEGER NOT NULL,
    rpe INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    strava_activity_id INTEGER,
    posted_at TEXT,
    PRIMARY KEY (user_id, fingerprint)
);

CREATE INDEX idx_sessions_user_start ON sessions(user_id, start_at DESC);

CREATE TABLE board_climb_names (
    board TEXT NOT NULL,
    climb_uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY (board, climb_uuid)
);

CREATE TABLE board_climb_stats (
    board TEXT NOT NULL,
    climb_uuid TEXT NOT NULL,
    angle INTEGER NOT NULL,
    display_difficulty REAL NOT NULL,
    PRIMARY KEY (board, climb_uuid, angle)
);

CREATE TABLE board_cursors (
    board TEXT NOT NULL,
    table_name TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (board, table_name)
);

CREATE TABLE sync_state (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    last_synced_at TEXT,
    last_error TEXT
);
