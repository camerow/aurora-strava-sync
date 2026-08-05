package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

const plistTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>com.tension-strava-sync</string>
	<key>ProgramArguments</key>
	<array>
		<string>%s</string>
		<string>sync</string>
	</array>
	<key>StartInterval</key><integer>14400</integer>
	<key>StandardOutPath</key><string>%s</string>
	<key>StandardErrorPath</key><string>%s</string>
</dict>
</plist>
`

func runInstallSchedule() error {
	bin, err := os.Executable()
	if err != nil {
		return err
	}
	bin, err = filepath.EvalSymlinks(bin)
	if err != nil {
		return err
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	logPath := filepath.Join(home, ".tension-strava-sync", "sync.log")
	plistPath := filepath.Join(home, "Library", "LaunchAgents", "com.tension-strava-sync.plist")
	if err := os.MkdirAll(filepath.Dir(logPath), 0o700); err != nil {
		return err
	}
	content := fmt.Sprintf(plistTemplate, bin, logPath, logPath)
	if err := os.WriteFile(plistPath, []byte(content), 0o644); err != nil {
		return err
	}
	exec.Command("launchctl", "unload", plistPath).Run() // ignore error: may not be loaded
	if out, err := exec.Command("launchctl", "load", plistPath).CombinedOutput(); err != nil {
		return fmt.Errorf("launchctl load failed: %v: %s", err, out)
	}
	fmt.Printf("Scheduled sync every 4 hours via %s (logs: %s).\n", plistPath, logPath)
	fmt.Println("Note: the schedule points at the current binary path; re-run install-schedule after moving the binary.")
	return nil
}
