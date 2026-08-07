CREATE TABLE board_connections_multi (
    user_id TEXT NOT NULL REFERENCES users(id),
    board TEXT NOT NULL,
    board_user_id INTEGER NOT NULL,
    token_ciphertext TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    sync_since TEXT,
    connected_at TEXT NOT NULL,
    posting_enabled INTEGER NOT NULL DEFAULT 0,
    post_since TEXT,
    PRIMARY KEY (user_id, board)
);

INSERT INTO board_connections_multi (user_id, board, board_user_id, token_ciphertext, status, sync_since, connected_at, posting_enabled, post_since)
SELECT bc.user_id, bc.board, bc.board_user_id, bc.token_ciphertext, bc.status, bc.sync_since, bc.connected_at,
       COALESCE(sc.posting_enabled, 0), sc.post_since
FROM board_connections bc
LEFT JOIN strava_connections sc ON sc.user_id = bc.user_id;

DROP TABLE board_connections;
ALTER TABLE board_connections_multi RENAME TO board_connections;

ALTER TABLE sessions ADD COLUMN board TEXT;
UPDATE sessions SET board = (
    SELECT bc.board FROM board_connections bc WHERE bc.user_id = sessions.user_id LIMIT 1
) WHERE board IS NULL;

ALTER TABLE users ADD COLUMN auto_sync INTEGER NOT NULL DEFAULT 0;
