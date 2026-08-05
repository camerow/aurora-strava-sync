package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"aurora-strava-sync/aurora"
	"aurora-strava-sync/config"
	"aurora-strava-sync/effort"
	"aurora-strava-sync/grades"
	"aurora-strava-sync/session"
	"aurora-strava-sync/store"
	"aurora-strava-sync/strava"
)

type scored struct {
	sess   session.Session
	result effort.Result
	fp     string
}

func runPipeline(args []string, post bool) error {
	fs := flag.NewFlagSet("pipeline", flag.ExitOnError)
	all := fs.Bool("all", false, "include the entire ascent history")
	since := fs.String("since", "", "include sessions on or after this date (YYYY-MM-DD)")
	fs.Parse(args)

	cfg, err := config.Load()
	if err != nil {
		return err
	}
	dir, err := config.Dir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}

	lockFile, err := os.OpenFile(filepath.Join(dir, "run.lock"), os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return err
	}
	defer lockFile.Close()
	if err := syscall.Flock(int(lockFile.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		return fmt.Errorf("another sync is already running")
	}
	defer syscall.Flock(int(lockFile.Fd()), syscall.LOCK_UN)

	st, err := store.Open(filepath.Join(dir, "state.db"))
	if err != nil {
		return err
	}
	defer st.Close()

	auroraSess, ok := aurora.LoadToken()
	if !ok {
		return fmt.Errorf("not connected to the board; run `aurora-strava-sync connect board`")
	}

	baseURL, okBoard := aurora.BaseURLFor(cfg.Aurora.Board)
	if !okBoard {
		return fmt.Errorf("unknown board %q in config", cfg.Aurora.Board)
	}
	client := aurora.NewClient(baseURL)
	ascents, bids, err := client.SyncUser(auroraSess.Token)
	if err != nil {
		return err
	}
	fmt.Printf("Fetched %d ascents, %d attempts from the board.\n", len(ascents), len(bids))

	if err := ensureClimbData(client, st, auroraSess.Token, ascents, bids); err != nil {
		return err
	}

	climbs, err := toClimbs(ascents, bids, st)
	if err != nil {
		return err
	}
	sessions := session.Build(climbs, session.DefaultConfig(), time.Now())

	cutoff, err := resolveCutoff(*all, *since, st, sessions, auroraSess.UserID)
	if err != nil {
		return err
	}

	var selected []scored
	for i, s := range sessions {
		if s.Start.Before(cutoff) {
			continue
		}
		history := append(append([]session.Session{}, sessions[:i]...), sessions[i+1:]...)
		selected = append(selected, scored{
			sess:   s,
			result: effort.Score(s, history, effort.DefaultConfig()),
			// fingerprints use the first climb's raw time so tuning session buffers never changes identity
			fp: store.Fingerprint(auroraSess.UserID, s.Climbs[0].Time),
		})
	}

	if len(selected) == 0 {
		fmt.Println("No completed sessions to process.")
		return nil
	}
	printTable(selected, st)

	if !post {
		return nil
	}
	if *all && !confirm(fmt.Sprintf("Post up to %d activities to Strava?", len(selected))) {
		fmt.Println("Aborted.")
		return nil
	}
	return publish(cfg, st, selected)
}

// ensureClimbData refreshes the shared climb caches (grades for bids, names
// for everything) when any referenced climb is missing locally.
func ensureClimbData(client *aurora.Client, st *store.Store, token string, ascents []aurora.Ascent, bids []aurora.Bid) error {
	missing := false
	for _, b := range bids {
		if _, ok, err := st.ClimbVGrade(b.ClimbUUID, b.Angle); err != nil {
			return err
		} else if !ok {
			missing = true
			break
		}
	}
	if !missing {
		for _, a := range ascents {
			if _, ok, err := st.ClimbName(a.ClimbUUID); err != nil {
				return err
			} else if !ok {
				missing = true
				break
			}
		}
	}
	if !missing {
		return nil
	}
	statsCursor, err := st.GetCursor("climb_stats")
	if err != nil {
		return err
	}
	climbsCursor, err := st.GetCursor("climbs")
	if err != nil {
		return err
	}
	fmt.Println("Refreshing climb grade data (first run can take a minute)...")
	stats, climbs, newStatsCursor, newClimbsCursor, err := client.SyncShared(token, statsCursor, climbsCursor)
	if err != nil {
		return err
	}
	if err := st.PutClimbStats(stats); err != nil {
		return err
	}
	if err := st.PutClimbNames(climbs); err != nil {
		return err
	}
	if err := st.SetCursor("climb_stats", newStatsCursor); err != nil {
		return err
	}
	return st.SetCursor("climbs", newClimbsCursor)
}

func toClimbs(ascents []aurora.Ascent, bids []aurora.Bid, st *store.Store) ([]session.Climb, error) {
	var out []session.Climb
	name := func(climbUUID string) string {
		n, ok, err := st.ClimbName(climbUUID)
		if err != nil || !ok {
			return ""
		}
		return n
	}
	for _, a := range ascents {
		ts, err := aurora.ParseTime(a.ClimbedAt)
		if err != nil {
			return nil, err
		}
		v, ok := grades.V(a.Difficulty)
		if !ok {
			v = -1
		}
		out = append(out, session.Climb{Time: ts, VGrade: v, Name: name(a.ClimbUUID), Kind: session.Send, Tries: a.BidCount})
	}
	for _, b := range bids {
		ts, err := aurora.ParseTime(b.ClimbedAt)
		if err != nil {
			return nil, err
		}
		v, ok, err := st.ClimbVGrade(b.ClimbUUID, b.Angle)
		if err != nil {
			return nil, err
		}
		if !ok {
			v = -1
		}
		out = append(out, session.Climb{Time: ts, VGrade: v, Name: name(b.ClimbUUID), Kind: session.Attempt, Tries: b.BidCount})
	}
	return out, nil
}

// resolveCutoff decides which sessions are in scope. --all means everything;
// --since means from that date. With neither, a store that has never posted
// anything limits scope to today onwards so a fresh install does not flood
// Strava; once anything is posted, idempotency alone is enough.
func resolveCutoff(all bool, since string, st *store.Store, sessions []session.Session, userID int) (time.Time, error) {
	if all {
		return time.Time{}, nil
	}
	if since != "" {
		t, err := time.ParseInLocation("2006-01-02", since, time.Local)
		if err != nil {
			return time.Time{}, fmt.Errorf("bad --since date %q: %w", since, err)
		}
		return t, nil
	}
	for _, s := range sessions {
		if posted, err := st.IsPosted(store.Fingerprint(userID, s.Climbs[0].Time)); err != nil {
			return time.Time{}, err
		} else if posted {
			return time.Time{}, nil
		}
	}
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local), nil
}

func printTable(selected []scored, st *store.Store) {
	for _, s := range selected {
		posted, _ := st.IsPosted(s.fp)
		status := " "
		if posted {
			status = "already posted"
		}
		fmt.Printf("%s  %3d climbs  RPE %2d  %-40s %s\n",
			s.sess.Start.Format("2006-01-02 15:04"), len(s.sess.Climbs),
			s.result.RPE, s.result.Title, status)
	}
}

func confirm(prompt string) bool {
	fmt.Printf("%s [y/N] ", prompt)
	line, _ := bufio.NewReader(os.Stdin).ReadString('\n')
	return strings.EqualFold(strings.TrimSpace(line), "y")
}

func publish(cfg config.Config, st *store.Store, selected []scored) error {
	tokens, err := strava.LoadTokens()
	if err != nil {
		return err
	}
	client := strava.NewClient(cfg.Strava, tokens)
	posted := 0
	for _, s := range selected {
		if already, err := st.IsPosted(s.fp); err != nil {
			return err
		} else if already {
			continue
		}
		id, err := client.CreateActivity(strava.Activity{
			Name:              s.result.Title,
			Description:       s.result.Summary,
			StartDateLocal:    s.sess.Start,
			ElapsedSeconds:    int(s.sess.End.Sub(s.sess.Start).Seconds()),
			PerceivedExertion: s.result.RPE,
		})
		if errors.Is(err, strava.ErrRateLimited) {
			fmt.Printf("Strava rate limit reached after %d activities; run sync again in 15 minutes to continue.\n", posted)
			return nil
		}
		if err != nil {
			return err
		}
		if err := st.MarkPosted(s.fp, id, s.result.RPE); err != nil {
			return err
		}
		// Create ignores perceived_exertion; patch it in after the fact.
		// Best effort: a failure here leaves a valid activity, and
		// backfill-rpe can repair it later.
		if err := client.SetPerceivedExertion(id, s.result.RPE); err != nil {
			fmt.Printf("warning: could not set perceived exertion on activity %d: %v\n", id, err)
		}
		posted++
		fmt.Printf("Posted: %s (activity %d)\n", s.result.Title, id)
	}
	fmt.Printf("Done. %d new activities posted.\n", posted)
	return nil
}
