package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadReadsTOMLFromOverrideDir(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("TENSION_STRAVA_SYNC_DIR", dir)
	content := "[strava]\nclient_id = \"123\"\nclient_secret = \"abc\"\n[tension]\nusername = \"will\"\n"
	if err := os.WriteFile(filepath.Join(dir, "config.toml"), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Strava.ClientID != "123" || cfg.Strava.ClientSecret != "abc" || cfg.Tension.Username != "will" {
		t.Fatalf("unexpected config: %+v", cfg)
	}
}

func TestLoadErrorsWhenMissing(t *testing.T) {
	t.Setenv("TENSION_STRAVA_SYNC_DIR", t.TempDir())
	if _, err := Load(); err == nil {
		t.Fatal("expected error for missing config.toml")
	}
}
