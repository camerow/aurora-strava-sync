// Package session groups individual logged climbs into training sessions.
package session

import (
	"sort"
	"time"
)

type Kind int

const (
	Send Kind = iota
	Attempt
)

type Climb struct {
	Time   time.Time
	VGrade int // -1 when unknown
	Kind   Kind
	Tries  int
}

type Session struct {
	Start, End time.Time
	Climbs     []Climb
}

type Config struct {
	Gap              time.Duration
	WarmupBuffer     time.Duration
	CooldownBuffer   time.Duration
	InProgressWindow time.Duration
}

func DefaultConfig() Config {
	return Config{
		Gap:              90 * time.Minute,
		WarmupBuffer:     10 * time.Minute,
		CooldownBuffer:   5 * time.Minute,
		InProgressWindow: 2 * time.Hour,
	}
}

func Build(climbs []Climb, cfg Config, now time.Time) []Session {
	if len(climbs) == 0 {
		return nil
	}
	sorted := make([]Climb, len(climbs))
	copy(sorted, climbs)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Time.Before(sorted[j].Time) })

	var sessions []Session
	group := []Climb{sorted[0]}
	flush := func() {
		last := group[len(group)-1]
		if now.Sub(last.Time) < cfg.InProgressWindow {
			return // still in progress; pick it up next run
		}
		sessions = append(sessions, Session{
			Start:  group[0].Time.Add(-cfg.WarmupBuffer),
			End:    last.Time.Add(cfg.CooldownBuffer),
			Climbs: group,
		})
	}
	for _, c := range sorted[1:] {
		if c.Time.Sub(group[len(group)-1].Time) > cfg.Gap {
			flush()
			group = nil
		}
		group = append(group, c)
	}
	flush()
	return sessions
}
