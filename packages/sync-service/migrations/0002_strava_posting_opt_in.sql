ALTER TABLE strava_connections ADD COLUMN posting_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE strava_connections ADD COLUMN post_since TEXT;
