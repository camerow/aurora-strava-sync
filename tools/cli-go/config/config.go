// Package config loads tool configuration from the state directory.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Strava StravaConfig `toml:"strava"`
	Aurora AuroraConfig `toml:"aurora"`
}

type StravaConfig struct {
	ClientID     string `toml:"client_id"`
	ClientSecret string `toml:"client_secret"`
}

type AuroraConfig struct {
	// Board selects which Aurora Climbing board to sync; defaults to
	// "tension" when empty. See aurora.HostBases for valid names.
	Board    string `toml:"board"`
	Username string `toml:"username"`
}

// Dir returns the state directory, honouring AURORA_STRAVA_SYNC_DIR for tests.
func Dir() (string, error) {
	if d := os.Getenv("AURORA_STRAVA_SYNC_DIR"); d != "" {
		return d, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".aurora-strava-sync"), nil
}

func Load() (Config, error) {
	dir, err := Dir()
	if err != nil {
		return Config{}, err
	}
	path := filepath.Join(dir, "config.toml")
	var cfg Config
	if _, err := toml.DecodeFile(path, &cfg); err != nil {
		return Config{}, fmt.Errorf("loading %s: %w", path, err)
	}
	return cfg, nil
}
