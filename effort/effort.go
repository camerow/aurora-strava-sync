// Package effort scores climbing sessions on an RPE-style 1-10 scale.
package effort

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"tension-strava-sync/session"
)

type Config struct {
	BidWeight   float64
	DensityHigh float64
	DensityLow  float64
	Window      time.Duration
	MinHistory  int
}

func DefaultConfig() Config {
	return Config{
		BidWeight:   0.4,
		DensityHigh: 12,
		DensityLow:  5,
		Window:      8 * 7 * 24 * time.Hour,
		MinHistory:  3,
	}
}

// Points grows exponentially with grade: V0=1, V2=2, V4=4, V6=8, V8=16.
// Unknown grades (-1) score conservatively as V1.
func Points(vGrade int) float64 {
	if vGrade < 0 {
		vGrade = 1
	}
	return math.Pow(2, float64(vGrade)/2)
}

func SessionPoints(s session.Session, cfg Config) float64 {
	var pts float64
	for _, c := range s.Climbs {
		p := Points(c.VGrade)
		if c.Kind == session.Attempt {
			p *= cfg.BidWeight
		}
		pts += p
	}
	return pts
}

type Result struct {
	RPE     int
	Title   string
	Summary string
}

func Score(target session.Session, history []session.Session, cfg Config) Result {
	pts := SessionPoints(target, cfg)

	// Reference set: sessions within the window before this one.
	var ref []session.Session
	for _, h := range history {
		if h.End.Before(target.Start) && target.Start.Sub(h.End) <= cfg.Window {
			ref = append(ref, h)
		}
	}
	if len(ref) < cfg.MinHistory {
		ref = history
	}

	base := 6.0
	if len(ref) > 0 {
		var refPts []float64
		for _, h := range ref {
			refPts = append(refPts, SessionPoints(h, cfg))
		}
		med := median(refPts)
		if med > 0 {
			base = 6 * math.Sqrt(pts/med)
		}
	}

	nudge := 0.0
	if len(target.Climbs) > 1 {
		span := target.Climbs[len(target.Climbs)-1].Time.Sub(target.Climbs[0].Time).Hours()
		if span < 0.5 {
			span = 0.5
		}
		density := float64(len(target.Climbs)) / span
		if density >= cfg.DensityHigh {
			nudge++
		} else if density <= cfg.DensityLow {
			nudge--
		}
	}

	rollingMax := 0
	for _, h := range ref {
		for _, c := range h.Climbs {
			if c.Kind == session.Send && c.VGrade > rollingMax {
				rollingMax = c.VGrade
			}
		}
	}
	if rollingMax > 0 {
		for _, c := range target.Climbs {
			if c.VGrade > rollingMax {
				nudge++
				break
			}
		}
	}

	rpe := int(math.Round(base + nudge))
	if rpe < 1 {
		rpe = 1
	}
	if rpe > 10 {
		rpe = 10
	}

	return Result{
		RPE:     rpe,
		Title:   title(rpe, target, volumeDriven(target, rollingMax)),
		Summary: summary(rpe, target),
	}
}

// volumeDriven reports whether a session's effort comes from volume rather
// than grade intensity: its hardest climb sits well below the climber's
// rolling max (2+ grades), so a high score means lots of climbing with short
// rests, not limit attempts. Unclassifiable without history (rollingMax 0)
// or without known grades.
func volumeDriven(s session.Session, rollingMax int) bool {
	_, hi := gradeRange(s)
	return rollingMax > 0 && hi >= 0 && hi <= rollingMax-2
}

func median(xs []float64) float64 {
	sorted := make([]float64, len(xs))
	copy(sorted, xs)
	sort.Float64s(sorted)
	n := len(sorted)
	if n == 0 {
		return 0
	}
	if n%2 == 1 {
		return sorted[n/2]
	}
	return (sorted[n/2-1] + sorted[n/2]) / 2
}

func adjective(rpe int) string {
	switch {
	case rpe <= 3:
		return "Easy climbing session"
	case rpe <= 5:
		return "Casual climbing session"
	case rpe <= 7:
		return "Solid climbing session"
	case rpe <= 9:
		return "Hard climbing session"
	default:
		return "Max effort climbing session"
	}
}

func gradeRange(s session.Session) (lo, hi int) {
	lo, hi = -1, -1
	for _, c := range s.Climbs {
		if c.VGrade < 0 {
			continue
		}
		if lo == -1 || c.VGrade < lo {
			lo = c.VGrade
		}
		if c.VGrade > hi {
			hi = c.VGrade
		}
	}
	return lo, hi
}

func title(rpe int, s session.Session, volume bool) string {
	adj := adjective(rpe)
	// High-scoring sessions well below the climber's max are volume work,
	// not limit attempts; name them accordingly.
	if volume && rpe >= 8 {
		if rpe == 10 {
			adj = "Max volume climbing session"
		} else {
			adj = "High volume climbing session"
		}
	}
	_, hi := gradeRange(s)
	if hi < 0 {
		return fmt.Sprintf("%s · %s", adj, plural(len(s.Climbs), "climb"))
	}
	return fmt.Sprintf("%s · %s, top V%d", adj, plural(len(s.Climbs), "climb"), hi)
}

func plural(n int, word string) string {
	if n == 1 {
		return fmt.Sprintf("%d %s", n, word)
	}
	return fmt.Sprintf("%d %ss", n, word)
}

// summary is the Strava activity description: a stats header line followed
// by a chronological per-climb log.
func summary(rpe int, s session.Session) string {
	sends, attempts := 0, 0
	gradeSum, graded := 0, 0
	for _, c := range s.Climbs {
		if c.Kind == session.Send {
			sends++
		} else {
			attempts++
		}
		if c.VGrade >= 0 {
			gradeSum += c.VGrade
			graded++
		}
	}
	lo, hi := gradeRange(s)
	grades := ""
	if lo >= 0 {
		grades = fmt.Sprintf(" · V%d-V%d · avg V%.1f", lo, hi, float64(gradeSum)/float64(graded))
	}

	var b strings.Builder
	fmt.Fprintf(&b, "RPE %d/10 · %s, %s%s\n",
		rpe, plural(sends, "send"), plural(attempts, "attempt"), grades)
	for _, c := range s.Climbs {
		b.WriteString(climbLine(c))
	}
	b.WriteString("synced from Tension Board")
	return b.String()
}

// climbLine renders one log entry, e.g. "✓ V6 Sleight of Hand" or
// "✗ V8 Mind Meld (3 tries)".
func climbLine(c session.Climb) string {
	mark := "✓"
	if c.Kind == session.Attempt {
		mark = "✗"
	}
	grade := "V?"
	if c.VGrade >= 0 {
		grade = fmt.Sprintf("V%d", c.VGrade)
	}
	line := mark + " " + grade
	if c.Name != "" {
		line += " " + c.Name
	}
	if c.Tries > 1 {
		line += fmt.Sprintf(" (%d tries)", c.Tries)
	}
	return line + "\n"
}
