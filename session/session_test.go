package session

import (
	"testing"
	"time"
)

func at(h, m int) time.Time {
	return time.Date(2026, 8, 1, h, m, 0, 0, time.Local)
}

func TestBuildSplitsOnGap(t *testing.T) {
	climbs := []Climb{
		{Time: at(10, 0), VGrade: 4, Kind: Send, Tries: 1},
		{Time: at(10, 30), VGrade: 5, Kind: Send, Tries: 2},
		{Time: at(13, 0), VGrade: 6, Kind: Attempt, Tries: 3}, // 2.5h gap -> new session
	}
	now := at(23, 0)
	got := Build(climbs, DefaultConfig(), now)
	if len(got) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(got))
	}
	if len(got[0].Climbs) != 2 || len(got[1].Climbs) != 1 {
		t.Fatalf("bad split: %d/%d climbs", len(got[0].Climbs), len(got[1].Climbs))
	}
	wantStart := at(9, 50) // 10:00 minus 10min warm-up
	if !got[0].Start.Equal(wantStart) {
		t.Errorf("start = %v want %v", got[0].Start, wantStart)
	}
	wantEnd := at(10, 35) // 10:30 plus 5min cooldown
	if !got[0].End.Equal(wantEnd) {
		t.Errorf("end = %v want %v", got[0].End, wantEnd)
	}
}

func TestBuildSortsInput(t *testing.T) {
	climbs := []Climb{
		{Time: at(10, 30), VGrade: 5, Kind: Send, Tries: 1},
		{Time: at(10, 0), VGrade: 4, Kind: Send, Tries: 1},
	}
	got := Build(climbs, DefaultConfig(), at(23, 0))
	if len(got) != 1 || !got[0].Climbs[0].Time.Equal(at(10, 0)) {
		t.Fatalf("input not sorted: %+v", got)
	}
}

func TestBuildSkipsInProgressSession(t *testing.T) {
	climbs := []Climb{{Time: at(10, 0), VGrade: 4, Kind: Send, Tries: 1}}
	if got := Build(climbs, DefaultConfig(), at(11, 0)); len(got) != 0 {
		t.Fatalf("in-progress session should be skipped, got %d", len(got))
	}
	if got := Build(climbs, DefaultConfig(), at(12, 30)); len(got) != 1 {
		t.Fatalf("completed session should be returned, got %d", len(got))
	}
}

func TestBuildEmptyInput(t *testing.T) {
	if got := Build(nil, DefaultConfig(), time.Now()); len(got) != 0 {
		t.Fatalf("expected no sessions, got %d", len(got))
	}
}
