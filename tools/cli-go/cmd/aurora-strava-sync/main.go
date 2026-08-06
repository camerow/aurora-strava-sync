// Command aurora-strava-sync syncs Aurora climbing board sessions to Strava.
package main

import (
	"fmt"
	"os"
	"os/exec"

	"golang.org/x/term"

	"aurora-strava-sync/aurora"
	"aurora-strava-sync/config"
	"aurora-strava-sync/strava"
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
	default:
		usage()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `usage: aurora-strava-sync <command>

commands:
  connect board      log in to the Aurora board account (board set in config)
  connect strava     authorize the Strava application
  preview [--all|--since YYYY-MM-DD]   dry-run: show sessions and scores
  sync    [--all|--since YYYY-MM-DD]   post new sessions to Strava
  install-schedule   run sync every 4 hours via launchd`)
	os.Exit(2)
}

func runConnect(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: connect board|strava")
	}
	switch args[0] {
	case "board":
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		baseURL, ok := aurora.BaseURLFor(cfg.Aurora.Board)
		if !ok {
			return fmt.Errorf("unknown board %q in config; valid: aurora, decoy, grasshopper, kilter, soill, tension, touchstone", cfg.Aurora.Board)
		}
		username := cfg.Aurora.Username
		if username == "" {
			fmt.Print("Board username: ")
			fmt.Scanln(&username)
		}
		fmt.Print("Board password: ")
		pw, err := term.ReadPassword(int(os.Stdin.Fd()))
		fmt.Println()
		if err != nil {
			return err
		}
		sess, err := aurora.NewClient(baseURL).Login(username, string(pw))
		if err != nil {
			return err
		}
		if err := aurora.SaveToken(sess); err != nil {
			return err
		}
		fmt.Printf("Connected to the board as user %d.\n", sess.UserID)
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
