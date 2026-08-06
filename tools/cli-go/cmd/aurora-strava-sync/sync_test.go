package main

import (
	"path/filepath"
	"testing"
	"time"

	"aurora-strava-sync/aurora"
	"aurora-strava-sync/session"
	"aurora-strava-sync/store"
)

func openTestStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatalf("store.Open: %v", err)
	}
	t.Cleanup(func() { st.Close() })
	return st
}

func sessionAt(start time.Time) session.Session {
	return session.Session{
		Start: start,
		End:   start.Add(time.Hour),
		Climbs: []session.Climb{
			{Time: start, VGrade: 4, Kind: session.Send, Tries: 1},
		},
	}
}

func TestResolveCutoffAll(t *testing.T) {
	st := openTestStore(t)
	sessions := []session.Session{sessionAt(time.Now())}

	cutoff, err := resolveCutoff(true, "", st, sessions, 1)
	if err != nil {
		t.Fatalf("resolveCutoff: %v", err)
	}
	if !cutoff.IsZero() {
		t.Errorf("expected zero time for --all, got %v", cutoff)
	}
}

func TestResolveCutoffSince(t *testing.T) {
	st := openTestStore(t)
	sessions := []session.Session{sessionAt(time.Now())}

	cutoff, err := resolveCutoff(false, "2026-07-01", st, sessions, 1)
	if err != nil {
		t.Fatalf("resolveCutoff: %v", err)
	}
	want := time.Date(2026, 7, 1, 0, 0, 0, 0, time.Local)
	if !cutoff.Equal(want) {
		t.Errorf("cutoff = %v, want %v", cutoff, want)
	}
}

func TestResolveCutoffBadSince(t *testing.T) {
	st := openTestStore(t)
	sessions := []session.Session{sessionAt(time.Now())}

	if _, err := resolveCutoff(false, "not-a-date", st, sessions, 1); err == nil {
		t.Fatal("expected error for bad --since date")
	}
}

func TestResolveCutoffFreshStore(t *testing.T) {
	st := openTestStore(t)
	sessions := []session.Session{sessionAt(time.Now())}

	cutoff, err := resolveCutoff(false, "", st, sessions, 1)
	if err != nil {
		t.Fatalf("resolveCutoff: %v", err)
	}
	now := time.Now()
	want := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	if !cutoff.Equal(want) {
		t.Errorf("cutoff = %v, want %v (today's local midnight)", cutoff, want)
	}
}

func TestResolveCutoffAlreadyPosted(t *testing.T) {
	st := openTestStore(t)
	sess := sessionAt(time.Now())
	sessions := []session.Session{sess}

	fp := store.Fingerprint(1, sess.Climbs[0].Time)
	if err := st.MarkPosted(fp, 12345, 6); err != nil {
		t.Fatalf("MarkPosted: %v", err)
	}

	cutoff, err := resolveCutoff(false, "", st, sessions, 1)
	if err != nil {
		t.Fatalf("resolveCutoff: %v", err)
	}
	if !cutoff.IsZero() {
		t.Errorf("expected zero time once something has been posted, got %v", cutoff)
	}
}

func TestToClimbsAscentDifficulty(t *testing.T) {
	st := openTestStore(t)
	ascents := []aurora.Ascent{
		{ClimbUUID: "c1", Angle: 40, Difficulty: 22, BidCount: 1, ClimbedAt: "2026-07-01 10:00:00"},
	}

	climbs, err := toClimbs(ascents, nil, st)
	if err != nil {
		t.Fatalf("toClimbs: %v", err)
	}
	if len(climbs) != 1 {
		t.Fatalf("expected 1 climb, got %d", len(climbs))
	}
	if climbs[0].VGrade != 6 {
		t.Errorf("VGrade = %d, want 6 (difficulty 22 maps to V6)", climbs[0].VGrade)
	}
	if climbs[0].Kind != session.Send {
		t.Errorf("Kind = %v, want Send", climbs[0].Kind)
	}
}

func TestToClimbsBidWithCachedStats(t *testing.T) {
	st := openTestStore(t)
	if err := st.PutClimbStats([]aurora.ClimbStat{
		{ClimbUUID: "c2", Angle: 40, DisplayDifficulty: 22},
	}); err != nil {
		t.Fatalf("PutClimbStats: %v", err)
	}
	bids := []aurora.Bid{
		{ClimbUUID: "c2", Angle: 40, BidCount: 3, ClimbedAt: "2026-07-01 10:05:00"},
	}

	climbs, err := toClimbs(nil, bids, st)
	if err != nil {
		t.Fatalf("toClimbs: %v", err)
	}
	if len(climbs) != 1 {
		t.Fatalf("expected 1 climb, got %d", len(climbs))
	}
	if climbs[0].VGrade != 6 {
		t.Errorf("VGrade = %d, want 6 from cached climb_stats", climbs[0].VGrade)
	}
	if climbs[0].Kind != session.Attempt {
		t.Errorf("Kind = %v, want Attempt", climbs[0].Kind)
	}
}

func TestToClimbsBidWithoutCachedStats(t *testing.T) {
	st := openTestStore(t)
	bids := []aurora.Bid{
		{ClimbUUID: "unknown", Angle: 40, BidCount: 2, ClimbedAt: "2026-07-01 10:05:00"},
	}

	climbs, err := toClimbs(nil, bids, st)
	if err != nil {
		t.Fatalf("toClimbs: %v", err)
	}
	if len(climbs) != 1 {
		t.Fatalf("expected 1 climb, got %d", len(climbs))
	}
	if climbs[0].VGrade != -1 {
		t.Errorf("VGrade = %d, want -1 for uncached climb", climbs[0].VGrade)
	}
}

func TestToClimbsBadTimestamp(t *testing.T) {
	st := openTestStore(t)
	ascents := []aurora.Ascent{
		{ClimbUUID: "c1", Angle: 40, Difficulty: 22, BidCount: 1, ClimbedAt: "not-a-timestamp"},
	}

	if _, err := toClimbs(ascents, nil, st); err == nil {
		t.Fatal("expected error for bad timestamp")
	}
}
