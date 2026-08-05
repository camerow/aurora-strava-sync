// Command tension-strava-sync syncs Tension Board sessions to Strava.
package main

import (
	"fmt"
	"os"
	"os/exec"

	"golang.org/x/term"

	"tension-strava-sync/aurora"
	"tension-strava-sync/config"
	"tension-strava-sync/strava"
)

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	var err error
	switch os.Args[1] {
	case "connect":
		err = runConnect(os.Args[2:])
	case "preview":
		err = runPipeline(os.Args[2:], false)
	case "sync":
		err = runPipeline(os.Args[2:], true)
	case "install-schedule":
		err = runInstallSchedule()
	case "backfill-rpe":
		err = runBackfillRPE()
	default:
		usage()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `usage: tension-strava-sync <command>

commands:
  connect tension    log in to the Tension Board account
  connect strava     authorize the Strava application
  preview [--all|--since YYYY-MM-DD]   dry-run: show sessions and scores
  sync    [--all|--since YYYY-MM-DD]   post new sessions to Strava
  install-schedule   run sync every 4 hours via launchd
  backfill-rpe       set perceived exertion on already-posted activities`)
	os.Exit(2)
}

func runConnect(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: connect tension|strava")
	}
	switch args[0] {
	case "tension":
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		username := cfg.Tension.Username
		if username == "" {
			fmt.Print("Tension username: ")
			fmt.Scanln(&username)
		}
		fmt.Print("Tension password: ")
		pw, err := term.ReadPassword(int(os.Stdin.Fd()))
		fmt.Println()
		if err != nil {
			return err
		}
		sess, err := aurora.NewClient("").Login(username, string(pw))
		if err != nil {
			return err
		}
		if err := aurora.SaveToken(sess); err != nil {
			return err
		}
		fmt.Printf("Connected to Tension as user %d.\n", sess.UserID)
		return nil
	case "strava":
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		if cfg.Strava.ClientID == "" || cfg.Strava.ClientSecret == "" {
			return fmt.Errorf("set strava client_id and client_secret in config.toml first")
		}
		_, err = strava.Connect(cfg.Strava, func(u string) error {
			fmt.Println("Opening browser for Strava authorization...")
			return exec.Command("open", u).Start()
		})
		if err != nil {
			return err
		}
		fmt.Println("Strava connected.")
		return nil
	default:
		return fmt.Errorf("unknown connect target %q", args[0])
	}
}
