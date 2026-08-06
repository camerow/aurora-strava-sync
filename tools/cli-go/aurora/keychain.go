package aurora

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

const keychainService = "aurora-strava-sync"

// SaveToken stores the Aurora session in the macOS Keychain as "user_id:token".
func SaveToken(s Session) error {
	secret := fmt.Sprintf("%d:%s", s.UserID, s.Token)
	cmd := exec.Command("security", "add-generic-password",
		"-U", "-s", keychainService, "-a", "aurora", "-w", secret)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("keychain save failed: %v: %s", err, out)
	}
	return nil
}

// LoadToken returns the stored Aurora session, or false when absent.
func LoadToken() (Session, bool) {
	out, err := exec.Command("security", "find-generic-password",
		"-s", keychainService, "-a", "aurora", "-w").Output()
	if err != nil {
		return Session{}, false
	}
	parts := strings.SplitN(strings.TrimSpace(string(out)), ":", 2)
	if len(parts) != 2 {
		return Session{}, false
	}
	userID, err := strconv.Atoi(parts[0])
	if err != nil {
		return Session{}, false
	}
	return Session{UserID: userID, Token: parts[1]}, true
}
