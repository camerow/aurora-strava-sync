package effort

import (
	"strings"
	"testing"
	"time"

	"tension-strava-sync/session"
)

func at(day, h, m int) time.Time {
	return time.Date(2026, 7, day, h, m, 0, 0, time.Local)
}

// mkSession builds a session of n sends at the given grade, 10 min apart.
func mkSession(day, hour, n, grade int) session.Session {
	var climbs []session.Climb
	for i := 0; i < n; i++ {
		climbs = append(climbs, session.Climb{
			Time: at(day, hour, i*10), VGrade: grade, Kind: session.Send, Tries: 1,
		})
	}
	return session.Session{
		Start:  climbs[0].Time.Add(-10 * time.Minute),
		End:    climbs[len(climbs)-1].Time.Add(5 * time.Minute),
		Climbs: climbs,
	}
}

func TestPoints(t *testing.T) {
	if Points(0) != 1 || Points(2) != 2 || Points(4) != 4 || Points(6) != 8 {
		t.Fatalf("point curve wrong: V0=%v V2=%v V4=%v V6=%v", Points(0), Points(2), Points(4), Points(6))
	}
	if Points(-1) != Points(1) {
		t.Fatalf("unknown grade should score as V1")
	}
}

func TestSessionPointsWeightsAttempts(t *testing.T) {
	s := session.Session{Climbs: []session.Climb{
		{VGrade: 4, Kind: session.Send},
		{VGrade: 4, Kind: session.Attempt},
	}}
	got := SessionPoints(s, DefaultConfig())
	want := 4.0 + 4.0*0.4
	if got != want {
		t.Fatalf("SessionPoints = %v want %v", got, want)
	}
}

func TestScoreMedianSessionIsSix(t *testing.T) {
	var history []session.Session
	for day := 1; day <= 6; day++ {
		history = append(history, mkSession(day, 18, 10, 4))
	}
	target := mkSession(10, 18, 10, 4) // identical to every history session
	res := Score(target, history, DefaultConfig())
	if res.RPE != 6 {
		t.Fatalf("median session RPE = %d want 6", res.RPE)
	}
	if !strings.Contains(res.Title, "Solid board session") {
		t.Fatalf("title = %q", res.Title)
	}
	if !strings.Contains(res.Title, "10 climbs, top V4") {
		t.Fatalf("title missing facts: %q", res.Title)
	}
}

func TestScoreBigSessionScoresHigher(t *testing.T) {
	var history []session.Session
	for day := 1; day <= 6; day++ {
		history = append(history, mkSession(day, 18, 10, 4))
	}
	small := Score(mkSession(10, 18, 4, 3), history, DefaultConfig())
	big := Score(mkSession(10, 18, 18, 5), history, DefaultConfig())
	if small.RPE >= 6 {
		t.Fatalf("small easy session RPE = %d, want < 6", small.RPE)
	}
	if big.RPE <= 6 {
		t.Fatalf("big hard session RPE = %d, want > 6", big.RPE)
	}
}

func TestScoreMaxGradeNudge(t *testing.T) {
	var history []session.Session
	for day := 1; day <= 6; day++ {
		history = append(history, mkSession(day, 18, 10, 4)) // rolling max V4
	}
	base := mkSession(10, 18, 10, 4)
	project := mkSession(10, 18, 10, 4)
	project.Climbs[9].VGrade = 6 // attempt above rolling max
	project.Climbs[9].Kind = session.Attempt
	baseRes := Score(base, history, DefaultConfig())
	projRes := Score(project, history, DefaultConfig())
	if projRes.RPE <= baseRes.RPE {
		t.Fatalf("projecting above max should raise RPE: %d vs %d", projRes.RPE, baseRes.RPE)
	}
}

func TestScoreEmptyHistoryDefaultsToSix(t *testing.T) {
	res := Score(mkSession(10, 18, 10, 4), nil, DefaultConfig())
	if res.RPE < 5 || res.RPE > 7 {
		t.Fatalf("cold-start RPE = %d, want near 6", res.RPE)
	}
}

func TestSummaryLine(t *testing.T) {
	s := session.Session{Climbs: []session.Climb{
		{Time: at(1, 18, 0), VGrade: 4, Kind: session.Send},
		{Time: at(1, 18, 10), VGrade: 7, Kind: session.Send},
		{Time: at(1, 18, 20), VGrade: 7, Kind: session.Attempt},
	}, Start: at(1, 17, 50), End: at(1, 18, 25)}
	res := Score(s, nil, DefaultConfig())
	for _, want := range []string{"2 sends", "1 attempt", "V4-V7", "synced from Tension Board", "RPE"} {
		if !strings.Contains(res.Summary, want) {
			t.Errorf("summary %q missing %q", res.Summary, want)
		}
	}
}
