package store

import (
	"path/filepath"
	"testing"
	"time"

	"aurora-strava-sync/aurora"
)

func open(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestPostedRoundTrip(t *testing.T) {
	s := open(t)
	fp := Fingerprint(42, time.Date(2026, 8, 1, 18, 0, 0, 0, time.Local))
	if posted, _ := s.IsPosted(fp); posted {
		t.Fatal("fresh store should have nothing posted")
	}
	if err := s.MarkPosted(fp, 999, 7); err != nil {
		t.Fatal(err)
	}
	if posted, _ := s.IsPosted(fp); !posted {
		t.Fatal("expected fingerprint to be posted")
	}
	// MarkPosted must be idempotent (re-run after crash).
	if err := s.MarkPosted(fp, 999, 7); err != nil {
		t.Fatalf("second MarkPosted: %v", err)
	}
}

func TestClimbStatsLookup(t *testing.T) {
	s := open(t)
	err := s.PutClimbStats([]aurora.ClimbStat{
		{ClimbUUID: "c1", Angle: 40, DisplayDifficulty: 18.4}, // rounds to 18 = V4
	})
	if err != nil {
		t.Fatal(err)
	}
	v, ok, err := s.ClimbVGrade("c1", 40)
	if err != nil || !ok || v != 4 {
		t.Fatalf("ClimbVGrade = %d,%v,%v want 4,true,nil", v, ok, err)
	}
	if _, ok, _ := s.ClimbVGrade("missing", 40); ok {
		t.Fatal("missing climb should not resolve")
	}
	// Upsert overwrites.
	s.PutClimbStats([]aurora.ClimbStat{{ClimbUUID: "c1", Angle: 40, DisplayDifficulty: 22.0}})
	if v, _, _ := s.ClimbVGrade("c1", 40); v != 6 {
		t.Fatalf("after upsert V = %d want 6", v)
	}
}

func TestCursor(t *testing.T) {
	s := open(t)
	if c, _ := s.GetCursor("climb_stats"); c != "" {
		t.Fatalf("fresh cursor = %q want empty", c)
	}
	s.SetCursor("climb_stats", "2026-08-01 00:00:00.000000")
	if c, _ := s.GetCursor("climb_stats"); c != "2026-08-01 00:00:00.000000" {
		t.Fatalf("cursor = %q", c)
	}
}

func TestClimbNames(t *testing.T) {
	s := open(t)
	if err := s.PutClimbNames([]aurora.ClimbRow{{UUID: "c1", Name: "Jug Life"}}); err != nil {
		t.Fatal(err)
	}
	n, ok, err := s.ClimbName("c1")
	if err != nil || !ok || n != "Jug Life" {
		t.Fatalf("ClimbName = %q,%v,%v", n, ok, err)
	}
	if _, ok, _ := s.ClimbName("missing"); ok {
		t.Fatal("missing climb should not resolve")
	}
	s.PutClimbNames([]aurora.ClimbRow{{UUID: "c1", Name: "Jug Life v2"}})
	if n, _, _ := s.ClimbName("c1"); n != "Jug Life v2" {
		t.Fatalf("after upsert name = %q", n)
	}
}
