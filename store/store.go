// Package store persists sync state in SQLite.
package store

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"

	"tension-strava-sync/aurora"
	"tension-strava-sync/grades"
)

type Store struct{ db *sql.DB }

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(`PRAGMA busy_timeout = 5000;`); err != nil {
		db.Close()
		return nil, err
	}
	schema := `
	CREATE TABLE IF NOT EXISTS sessions (
		fingerprint TEXT PRIMARY KEY,
		strava_activity_id INTEGER NOT NULL,
		rpe INTEGER NOT NULL,
		posted_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS climb_stats (
		climb_uuid TEXT NOT NULL,
		angle INTEGER NOT NULL,
		display_difficulty REAL NOT NULL,
		PRIMARY KEY (climb_uuid, angle)
	);
	CREATE TABLE IF NOT EXISTS cursors (
		name TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);`
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func Fingerprint(userID int, start time.Time) string {
	return fmt.Sprintf("%d-%d", userID, start.Unix())
}

func (s *Store) IsPosted(fp string) (bool, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM sessions WHERE fingerprint = ?`, fp).Scan(&n)
	return n > 0, err
}

func (s *Store) MarkPosted(fp string, stravaID int64, rpe int) error {
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO sessions (fingerprint, strava_activity_id, rpe, posted_at) VALUES (?, ?, ?, ?)`,
		fp, stravaID, rpe, time.Now().Format(time.RFC3339))
	return err
}

func (s *Store) PutClimbStats(stats []aurora.ClimbStat) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	for _, cs := range stats {
		if _, err := tx.Exec(
			`INSERT OR REPLACE INTO climb_stats (climb_uuid, angle, display_difficulty) VALUES (?, ?, ?)`,
			cs.ClimbUUID, cs.Angle, cs.DisplayDifficulty); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) ClimbVGrade(climbUUID string, angle int) (int, bool, error) {
	var display float64
	err := s.db.QueryRow(
		`SELECT display_difficulty FROM climb_stats WHERE climb_uuid = ? AND angle = ?`,
		climbUUID, angle).Scan(&display)
	if err == sql.ErrNoRows {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	v, ok := grades.VFromDisplay(display)
	return v, ok, nil
}

func (s *Store) GetCursor(name string) (string, error) {
	var v string
	err := s.db.QueryRow(`SELECT value FROM cursors WHERE name = ?`, name).Scan(&v)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return v, err
}

func (s *Store) SetCursor(name, value string) error {
	_, err := s.db.Exec(`INSERT OR REPLACE INTO cursors (name, value) VALUES (?, ?)`, name, value)
	return err
}
