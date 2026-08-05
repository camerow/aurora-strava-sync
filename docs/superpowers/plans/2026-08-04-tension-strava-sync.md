# Tension Board to Strava Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Go CLI that pulls climbing ascents/attempts from the Tension Board (Aurora) API, groups them into sessions, scores effort, and posts them to Strava as RockClimbing activities.

**Architecture:** Single binary with pure-logic packages (`session`, `effort`) separated from IO packages (`aurora`, `strava`, `store`).
State lives in SQLite at `~/.tension-strava-sync/state.db`; config in `~/.tension-strava-sync/config.toml`.

**Tech Stack:** Go 1.22+, `github.com/BurntSushi/toml` (config), `modernc.org/sqlite` (pure-Go SQLite, no cgo).
Everything else is stdlib.

**Spec:** `docs/superpowers/specs/2026-08-04-tension-strava-sync-design.md`.
One amendment discovered during planning: Aurora `bids` rows carry no difficulty, so attempt grades come from the shared `climb_stats` table (synced via the same `/sync` endpoint, cached in the state DB).
The effort rolling-max nudge compares strictly above (greater than) the rolling max, which preserves the median RPE of 6 calibration anchor.
The publisher does not pre-space Strava requests and relies on 429-resume instead.

## Global Constraints

- Module name: `tension-strava-sync` (renameable when pushed to GitHub).
- Config dir: `~/.tension-strava-sync/`, overridable via env var `TENSION_STRAVA_SYNC_DIR` (tests depend on this).
- Never use em dashes in any output or copy; use hyphens.
- Commit messages: conventional style (`feat:`, `test:`, `chore:`), no co-author lines.
- Aurora host for Tension: `https://tensionboardapp2.com`.
- Strava OAuth callback: `http://localhost:8723/callback`; scope `activity:write`.
- All timestamps from Aurora are wall-clock local; parse in `time.Local`.
- The pure packages (`session`, `effort`, `grades`) must not import `aurora`, `strava`, or `store`.

## Verified API facts (from BoardLib source + app bundle DB, 2026-08-04)

- Login: `POST https://tensionboardapp2.com/sessions`, JSON body `{"username","password","tou":"accepted","pp":"accepted","ua":"app"}`.
  Response: `{"session": {"token": "...", "user_id": 123}}`.
  422 means bad credentials.
- Sync: `POST https://tensionboardapp2.com/sync`, header `Cookie: token=<token>`, `Content-Type: application/x-www-form-urlencoded`.
  Body is manually-joined form pairs of `table=<last sync date>`, e.g. `ascents=1970-01-01 00:00:00.000000&bids=1970-01-01 00:00:00.000000` (dates URL-encoded).
  Response JSON contains requested table arrays (`ascents`, `bids`, `climb_stats`), plus `user_syncs`/`shared_syncs` arrays of `{table_name, last_synchronized_at}` for pagination, plus `_complete: true` on the final page.
  Loop: after each page, update each table's date from `user_syncs`/`shared_syncs`, repeat until `_complete`.
- `ascents` row fields we use: `uuid`, `climb_uuid`, `angle`, `user_id`, `bid_count`, `quality`, `difficulty` (int), `climbed_at` ("2026-08-01 18:23:44.123456").
- `bids` row fields we use: `uuid`, `climb_uuid`, `angle`, `user_id`, `bid_count`, `climbed_at`.
  No difficulty on bids - resolve via `climb_stats`.
- `climb_stats` row fields we use: `climb_uuid`, `angle`, `display_difficulty` (float).
- Difficulty-to-V-grade table verified from app bundle `db.sqlite3` (see Task 2 for full table).
- Strava: authorize `https://www.strava.com/oauth/authorize`, token `https://www.strava.com/oauth/token`, create `POST https://www.strava.com/api/v3/activities` (form fields: `name`, `sport_type=RockClimbing`, `start_date_local` ISO8601, `elapsed_time` seconds, `description`, `trainer=0`).

## File Structure

```
tension-strava-sync/
  go.mod
  config/config.go        config load + dir resolution
  config/config_test.go
  grades/grades.go        Aurora difficulty -> V-grade (vendored table)
  grades/grades_test.go
  aurora/client.go        login + sync + pagination
  aurora/types.go         Ascent, Bid, ClimbStat + timestamp parsing
  aurora/client_test.go   httptest fixtures
  aurora/keychain.go      macOS Keychain via `security` CLI
  session/session.go      Climb, Session, Build()
  session/session_test.go
  effort/effort.go        Points, Score, Title
  effort/effort_test.go
  store/store.go          state.db: posted sessions + climb_stats cache
  store/store_test.go
  strava/oauth.go         connect flow + token refresh + persistence
  strava/publish.go       CreateActivity
  strava/strava_test.go   httptest fixtures
  cmd/tension-strava-sync/main.go   subcommand dispatch
  cmd/tension-strava-sync/sync.go   preview/sync pipeline wiring
  cmd/tension-strava-sync/schedule.go  launchd install
```

---

### Task 1: Scaffold and config package

**Files:**
- Create: `go.mod`, `config/config.go`
- Test: `config/config_test.go`

**Interfaces:**
- Produces: `config.Dir() (string, error)` - returns `$TENSION_STRAVA_SYNC_DIR` if set, else `~/.tension-strava-sync`.
- Produces: `config.Load() (Config, error)` where:

```go
type Config struct {
    Strava  StravaConfig  `toml:"strava"`
    Tension TensionConfig `toml:"tension"`
}
type StravaConfig struct {
    ClientID     string `toml:"client_id"`
    ClientSecret string `toml:"client_secret"`
}
type TensionConfig struct {
    Username string `toml:"username"`
}
```

- [ ] **Step 1: Init module**

```bash
cd /Users/will/src/tension-strava-sync
go mod init tension-strava-sync
go get github.com/BurntSushi/toml@latest modernc.org/sqlite@latest
```

- [ ] **Step 2: Write the failing test**

`config/config_test.go`:

```go
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `go test ./config/`
Expected: FAIL (package does not compile: `Load` undefined).

- [ ] **Step 4: Implement**

`config/config.go`:

```go
// Package config loads tool configuration from the state directory.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Strava  StravaConfig  `toml:"strava"`
	Tension TensionConfig `toml:"tension"`
}

type StravaConfig struct {
	ClientID     string `toml:"client_id"`
	ClientSecret string `toml:"client_secret"`
}

type TensionConfig struct {
	Username string `toml:"username"`
}

// Dir returns the state directory, honouring TENSION_STRAVA_SYNC_DIR for tests.
func Dir() (string, error) {
	if d := os.Getenv("TENSION_STRAVA_SYNC_DIR"); d != "" {
		return d, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".tension-strava-sync"), nil
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `go test ./config/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add go.mod go.sum config/
git commit -m "feat: scaffold module and config loading"
```

---

### Task 2: grades package (vendored difficulty table)

**Files:**
- Create: `grades/grades.go`
- Test: `grades/grades_test.go`

**Interfaces:**
- Produces: `grades.V(difficulty int) (int, bool)` - Aurora integer difficulty to V-grade number; false when unknown.
- Produces: `grades.VFromDisplay(display float64) (int, bool)` - rounds `climb_stats.display_difficulty` to nearest int then maps.

The table below was extracted verbatim from the app bundle DB (`difficulty_grades`, `boulder_name` column, format "6b/V4") on 2026-08-04.

- [ ] **Step 1: Write the failing test**

`grades/grades_test.go`:

```go
package grades

import "testing"

func TestV(t *testing.T) {
	cases := []struct {
		difficulty int
		want       int
		ok         bool
	}{
		{1, 0, true},   // 1a/V0
		{12, 0, true},  // 4c/V0
		{13, 1, true},  // 5a/V1
		{15, 2, true},  // 5c/V2
		{18, 4, true},  // 6b/V4
		{22, 6, true},  // 7a/V6
		{23, 7, true},  // 7a+/V7
		{27, 10, true}, // 7c+/V10
		{39, 22, true}, // 9c+/V22
		{0, 0, false},
		{40, 0, false},
	}
	for _, c := range cases {
		got, ok := V(c.difficulty)
		if got != c.want || ok != c.ok {
			t.Errorf("V(%d) = %d,%v want %d,%v", c.difficulty, got, ok, c.want, c.ok)
		}
	}
}

func TestVFromDisplay(t *testing.T) {
	if v, ok := VFromDisplay(18.4); !ok || v != 4 {
		t.Errorf("VFromDisplay(18.4) = %d,%v want 4,true", v, ok)
	}
	if v, ok := VFromDisplay(22.6); !ok || v != 7 {
		t.Errorf("VFromDisplay(22.6) = %d,%v want 7,true (rounds to 23)", v, ok)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./grades/`
Expected: FAIL (undefined: V).

- [ ] **Step 3: Implement**

`grades/grades.go`:

```go
// Package grades maps Aurora numeric difficulty to V-grades.
// Table vendored from the Tension Board app bundle's difficulty_grades table.
package grades

import "math"

var vByDifficulty = map[int]int{
	1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
	13: 1, 14: 1,
	15: 2,
	16: 3, 17: 3,
	18: 4, 19: 4,
	20: 5, 21: 5,
	22: 6,
	23: 7,
	24: 8, 25: 8,
	26: 9,
	27: 10,
	28: 11, 29: 12, 30: 13, 31: 14, 32: 15, 33: 16,
	34: 17, 35: 18, 36: 19, 37: 20, 38: 21, 39: 22,
}

func V(difficulty int) (int, bool) {
	v, ok := vByDifficulty[difficulty]
	return v, ok
}

func VFromDisplay(display float64) (int, bool) {
	return V(int(math.Round(display)))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./grades/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add grades/
git commit -m "feat: add vendored Aurora difficulty to V-grade table"
```

---

### Task 3: aurora types and client

**Files:**
- Create: `aurora/types.go`, `aurora/client.go`
- Test: `aurora/client_test.go`

**Interfaces:**
- Consumes: nothing internal.
- Produces:

```go
type Ascent struct {
	UUID       string  `json:"uuid"`
	ClimbUUID  string  `json:"climb_uuid"`
	Angle      int     `json:"angle"`
	UserID     int     `json:"user_id"`
	BidCount   int     `json:"bid_count"`
	Quality    int     `json:"quality"`
	Difficulty int     `json:"difficulty"`
	ClimbedAt  string  `json:"climbed_at"`
}
type Bid struct {
	UUID      string `json:"uuid"`
	ClimbUUID string `json:"climb_uuid"`
	Angle     int    `json:"angle"`
	UserID    int    `json:"user_id"`
	BidCount  int    `json:"bid_count"`
	ClimbedAt string `json:"climbed_at"`
}
type ClimbStat struct {
	ClimbUUID         string  `json:"climb_uuid"`
	Angle             int     `json:"angle"`
	DisplayDifficulty float64 `json:"display_difficulty"`
}
type Session struct { Token string; UserID int }

func ParseTime(s string) (time.Time, error)          // "2006-01-02 15:04:05[.ffffff]" in time.Local
func NewClient(baseURL string) *Client               // baseURL default https://tensionboardapp2.com
func (c *Client) Login(username, password string) (Session, error)
func (c *Client) SyncUser(token string) ([]Ascent, []Bid, error)          // full history, paginated
func (c *Client) SyncClimbStats(token, sinceDate string) ([]ClimbStat, string, error) // returns rows + new since-date
```

- [ ] **Step 1: Write the failing test**

`aurora/client_test.go`:

```go
package aurora

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestParseTime(t *testing.T) {
	for _, s := range []string{"2026-08-01 18:23:44.123456", "2026-08-01 18:23:44"} {
		got, err := ParseTime(s)
		if err != nil {
			t.Fatalf("ParseTime(%q): %v", s, err)
		}
		if got.Hour() != 18 || got.Minute() != 23 {
			t.Errorf("ParseTime(%q) = %v", s, got)
		}
	}
}

func TestLogin(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/sessions" || r.Method != "POST" {
			t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		var body map[string]string
		json.NewDecoder(r.Body).Decode(&body)
		if body["username"] != "will" || body["tou"] != "accepted" {
			t.Errorf("bad login body: %v", body)
		}
		w.Write([]byte(`{"session": {"token": "tok123", "user_id": 42}}`))
	}))
	defer srv.Close()
	sess, err := NewClient(srv.URL).Login("will", "pw")
	if err != nil {
		t.Fatal(err)
	}
	if sess.Token != "tok123" || sess.UserID != 42 {
		t.Fatalf("unexpected session: %+v", sess)
	}
}

func TestLoginBadCredentials(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(422)
	}))
	defer srv.Close()
	if _, err := NewClient(srv.URL).Login("will", "wrong"); err == nil ||
		!strings.Contains(err.Error(), "credentials") {
		t.Fatalf("expected credentials error, got %v", err)
	}
}

func TestSyncUserPaginates(t *testing.T) {
	page := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/sync" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		if got := r.Header.Get("Cookie"); got != "token=tok123" {
			t.Errorf("bad cookie: %q", got)
		}
		raw, _ := io.ReadAll(r.Body)
		body := string(raw)
		page++
		if page == 1 {
			if !strings.Contains(body, "ascents=1970-01-01") {
				t.Errorf("first page should sync from epoch, got %q", body)
			}
			w.Write([]byte(`{
				"ascents": [{"uuid":"a1","climb_uuid":"c1","angle":40,"user_id":42,"bid_count":2,"quality":3,"difficulty":22,"climbed_at":"2026-08-01 18:00:00.000000"}],
				"bids": [],
				"user_syncs": [{"table_name":"ascents","last_synchronized_at":"2026-08-01 18:00:00.000000"}]
			}`))
			return
		}
		if !strings.Contains(body, "ascents=2026-08-01") {
			t.Errorf("second page should sync from cursor, got %q", body)
		}
		w.Write([]byte(`{
			"ascents": [{"uuid":"a2","climb_uuid":"c2","angle":40,"user_id":42,"bid_count":1,"quality":3,"difficulty":18,"climbed_at":"2026-08-02 19:00:00.000000"}],
			"bids": [{"uuid":"b1","climb_uuid":"c3","angle":40,"user_id":42,"bid_count":3,"climbed_at":"2026-08-02 19:30:00.000000"}],
			"_complete": true
		}`))
	}))
	defer srv.Close()
	ascents, bids, err := NewClient(srv.URL).SyncUser("tok123")
	if err != nil {
		t.Fatal(err)
	}
	if len(ascents) != 2 || len(bids) != 1 {
		t.Fatalf("got %d ascents %d bids", len(ascents), len(bids))
	}
	if ascents[1].UUID != "a2" || bids[0].BidCount != 3 {
		t.Fatalf("unexpected rows: %+v %+v", ascents, bids)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./aurora/`
Expected: FAIL (undefined types/functions).

- [ ] **Step 3: Implement**

`aurora/types.go`:

```go
// Package aurora is a minimal client for the Aurora Climbing board API
// (Tension Board 2). Endpoint shapes follow the BoardLib project.
package aurora

import (
	"fmt"
	"time"
)

type Ascent struct {
	UUID       string `json:"uuid"`
	ClimbUUID  string `json:"climb_uuid"`
	Angle      int    `json:"angle"`
	UserID     int    `json:"user_id"`
	BidCount   int    `json:"bid_count"`
	Quality    int    `json:"quality"`
	Difficulty int    `json:"difficulty"`
	ClimbedAt  string `json:"climbed_at"`
}

type Bid struct {
	UUID      string `json:"uuid"`
	ClimbUUID string `json:"climb_uuid"`
	Angle     int    `json:"angle"`
	UserID    int    `json:"user_id"`
	BidCount  int    `json:"bid_count"`
	ClimbedAt string `json:"climbed_at"`
}

type ClimbStat struct {
	ClimbUUID         string  `json:"climb_uuid"`
	Angle             int     `json:"angle"`
	DisplayDifficulty float64 `json:"display_difficulty"`
}

type Session struct {
	Token  string `json:"token"`
	UserID int    `json:"user_id"`
}

var timeLayouts = []string{"2006-01-02 15:04:05.000000", "2006-01-02 15:04:05"}

// ParseTime parses Aurora wall-clock timestamps in the machine's local zone.
func ParseTime(s string) (time.Time, error) {
	for _, layout := range timeLayouts {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognised aurora timestamp %q", s)
}
```

`aurora/client.go`:

```go
package aurora

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	DefaultBaseURL = "https://tensionboardapp2.com"
	epochSyncDate  = "1970-01-01 00:00:00.000000"
	maxSyncPages   = 100
	userAgent      = "Kilter%20Board/202 CFNetwork/1568.100.1 Darwin/24.0.0"
)

type Client struct {
	baseURL string
	http    *http.Client
}

func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	return &Client{baseURL: baseURL, http: &http.Client{Timeout: 30 * time.Second}}
}

func (c *Client) Login(username, password string) (Session, error) {
	body, _ := json.Marshal(map[string]string{
		"username": username, "password": password,
		"tou": "accepted", "pp": "accepted", "ua": "app",
	})
	req, err := http.NewRequest("POST", c.baseURL+"/sessions", bytes.NewReader(body))
	if err != nil {
		return Session{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", userAgent)
	resp, err := c.http.Do(req)
	if err != nil {
		return Session{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnprocessableEntity {
		return Session{}, fmt.Errorf("invalid Tension credentials")
	}
	if resp.StatusCode != http.StatusOK {
		return Session{}, fmt.Errorf("login failed: HTTP %d", resp.StatusCode)
	}
	var out struct {
		Session Session `json:"session"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return Session{}, err
	}
	return out.Session, nil
}

type syncPage struct {
	Ascents    []Ascent    `json:"ascents"`
	Bids       []Bid       `json:"bids"`
	ClimbStats []ClimbStat `json:"climb_stats"`
	UserSyncs  []syncMark  `json:"user_syncs"`
	SharedSyncs []syncMark `json:"shared_syncs"`
	Complete   bool        `json:"_complete"`
}

type syncMark struct {
	TableName          string `json:"table_name"`
	LastSynchronizedAt string `json:"last_synchronized_at"`
}

// syncTables runs the paginated /sync loop for the given table cursors.
func (c *Client) syncTables(token string, cursors map[string]string, onPage func(syncPage)) error {
	for page := 0; page < maxSyncPages; page++ {
		var parts []string
		for table, date := range cursors {
			parts = append(parts, url.QueryEscape(table)+"="+url.QueryEscape(date))
		}
		req, err := http.NewRequest("POST", c.baseURL+"/sync", strings.NewReader(strings.Join(parts, "&")))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", userAgent)
		if token != "" {
			req.Header.Set("Cookie", "token="+token)
		}
		resp, err := c.http.Do(req)
		if err != nil {
			return err
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return fmt.Errorf("sync failed: HTTP %d", resp.StatusCode)
		}
		var p syncPage
		err = json.NewDecoder(resp.Body).Decode(&p)
		resp.Body.Close()
		if err != nil {
			return err
		}
		onPage(p)
		for _, m := range append(p.UserSyncs, p.SharedSyncs...) {
			if _, tracked := cursors[m.TableName]; tracked && m.LastSynchronizedAt != "" {
				cursors[m.TableName] = m.LastSynchronizedAt
			}
		}
		if p.Complete {
			return nil
		}
	}
	return fmt.Errorf("sync did not complete within %d pages", maxSyncPages)
}

// SyncUser pulls the user's full ascent and bid history.
func (c *Client) SyncUser(token string) ([]Ascent, []Bid, error) {
	var ascents []Ascent
	var bids []Bid
	err := c.syncTables(token, map[string]string{
		"ascents": epochSyncDate,
		"bids":    epochSyncDate,
	}, func(p syncPage) {
		ascents = append(ascents, p.Ascents...)
		bids = append(bids, p.Bids...)
	})
	return ascents, bids, err
}

// SyncClimbStats pulls shared climb difficulty stats incrementally.
// Pass the previously returned cursor (or "" for a full pull); the new
// cursor comes back for the caller to persist.
func (c *Client) SyncClimbStats(token, sinceDate string) ([]ClimbStat, string, error) {
	if sinceDate == "" {
		sinceDate = epochSyncDate
	}
	cursors := map[string]string{"climb_stats": sinceDate}
	var stats []ClimbStat
	err := c.syncTables(token, cursors, func(p syncPage) {
		stats = append(stats, p.ClimbStats...)
	})
	return stats, cursors["climb_stats"], err
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./aurora/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add aurora/
git commit -m "feat: add Aurora API client with paginated sync"
```

---

### Task 4: Keychain token storage

**Files:**
- Create: `aurora/keychain.go`

**Interfaces:**
- Produces: `aurora.SaveToken(session Session) error` and `aurora.LoadToken() (Session, bool)` using the macOS `security` CLI, service name `tension-strava-sync`, account `tension`.
  The token and user ID are stored together as `<user_id>:<token>`.
  These shell out and are not unit-tested; they are exercised in the live E2E task.

- [ ] **Step 1: Implement**

`aurora/keychain.go`:

```go
package aurora

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

const keychainService = "tension-strava-sync"

// SaveToken stores the Aurora session in the macOS Keychain as "user_id:token".
func SaveToken(s Session) error {
	secret := fmt.Sprintf("%d:%s", s.UserID, s.Token)
	cmd := exec.Command("security", "add-generic-password",
		"-U", "-s", keychainService, "-a", "tension", "-w", secret)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("keychain save failed: %v: %s", err, out)
	}
	return nil
}

// LoadToken returns the stored Aurora session, or false when absent.
func LoadToken() (Session, bool) {
	out, err := exec.Command("security", "find-generic-password",
		"-s", keychainService, "-a", "tension", "-w").Output()
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
```

- [ ] **Step 2: Verify it builds**

Run: `go build ./...`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add aurora/keychain.go
git commit -m "feat: store Aurora session token in macOS Keychain"
```

---

### Task 5: session builder

**Files:**
- Create: `session/session.go`
- Test: `session/session_test.go`

**Interfaces:**
- Consumes: nothing internal (pure package; callers convert aurora rows to `Climb`).
- Produces:

```go
type Kind int
const (
	Send Kind = iota
	Attempt
)
type Climb struct {
	Time   time.Time
	VGrade int  // resolved V-grade; -1 when unknown (bid whose climb_stats row is missing)
	Kind   Kind
	Tries  int  // bid_count
}
type Session struct {
	Start, End time.Time // buffered activity window
	Climbs     []Climb   // sorted by time
}
type Config struct {
	Gap              time.Duration // 90 * time.Minute
	WarmupBuffer     time.Duration // 10 * time.Minute
	CooldownBuffer   time.Duration // 5 * time.Minute
	InProgressWindow time.Duration // 2 * time.Hour
}
func DefaultConfig() Config
func Build(climbs []Climb, cfg Config, now time.Time) []Session
```

`Build` sorts climbs by time, splits where the gap between consecutive climbs exceeds `cfg.Gap`, drops any session whose last climb is within `cfg.InProgressWindow` of `now`, and applies the start/end buffers.

- [ ] **Step 1: Write the failing test**

`session/session_test.go`:

```go
package session

import (
	"testing"
	"time"
)

func at(h, m int) time.Time {
	return time.Date(2026, 8, 1, h, m, 0, 0, time.Local)
}

func TestBuildSplitsOnGap(t *testing.T) {
	climbs := []Climb{
		{Time: at(10, 0), VGrade: 4, Kind: Send, Tries: 1},
		{Time: at(10, 30), VGrade: 5, Kind: Send, Tries: 2},
		{Time: at(13, 0), VGrade: 6, Kind: Attempt, Tries: 3}, // 2.5h gap -> new session
	}
	now := at(23, 0)
	got := Build(climbs, DefaultConfig(), now)
	if len(got) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(got))
	}
	if len(got[0].Climbs) != 2 || len(got[1].Climbs) != 1 {
		t.Fatalf("bad split: %d/%d climbs", len(got[0].Climbs), len(got[1].Climbs))
	}
	wantStart := at(9, 50) // 10:00 minus 10min warm-up
	if !got[0].Start.Equal(wantStart) {
		t.Errorf("start = %v want %v", got[0].Start, wantStart)
	}
	wantEnd := at(10, 35) // 10:30 plus 5min cooldown
	if !got[0].End.Equal(wantEnd) {
		t.Errorf("end = %v want %v", got[0].End, wantEnd)
	}
}

func TestBuildSortsInput(t *testing.T) {
	climbs := []Climb{
		{Time: at(10, 30), VGrade: 5, Kind: Send, Tries: 1},
		{Time: at(10, 0), VGrade: 4, Kind: Send, Tries: 1},
	}
	got := Build(climbs, DefaultConfig(), at(23, 0))
	if len(got) != 1 || !got[0].Climbs[0].Time.Equal(at(10, 0)) {
		t.Fatalf("input not sorted: %+v", got)
	}
}

func TestBuildSkipsInProgressSession(t *testing.T) {
	climbs := []Climb{{Time: at(10, 0), VGrade: 4, Kind: Send, Tries: 1}}
	if got := Build(climbs, DefaultConfig(), at(11, 0)); len(got) != 0 {
		t.Fatalf("in-progress session should be skipped, got %d", len(got))
	}
	if got := Build(climbs, DefaultConfig(), at(12, 30)); len(got) != 1 {
		t.Fatalf("completed session should be returned, got %d", len(got))
	}
}

func TestBuildEmptyInput(t *testing.T) {
	if got := Build(nil, DefaultConfig(), time.Now()); len(got) != 0 {
		t.Fatalf("expected no sessions, got %d", len(got))
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./session/`
Expected: FAIL (undefined types).

- [ ] **Step 3: Implement**

`session/session.go`:

```go
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./session/`
Expected: PASS.
Note: `flush` appends to `sessions` via closure; the `group = nil` reassignment requires `group` captured by reference - it is, since `flush` reads `group` at call time.
If the second flush after `group = nil; group = append(...)` misbehaves, the closure is capturing a stale slice header; fix by making `flush` take `group` as a parameter.

- [ ] **Step 5: Commit**

```bash
git add session/
git commit -m "feat: add session builder with gap splitting and buffers"
```

---

### Task 6: effort engine

**Files:**
- Create: `effort/effort.go`
- Test: `effort/effort_test.go`

**Interfaces:**
- Consumes: `session.Session`, `session.Climb`, `session.Send`, `session.Attempt`.
- Produces:

```go
type Config struct {
	BidWeight   float64 // 0.4: fraction of points a failed attempt earns
	DensityHigh float64 // 12 climbs per active hour and above: +1
	DensityLow  float64 // 5 climbs per active hour and below: -1
	Window      time.Duration // 8 * 7 * 24h history window
	MinHistory  int     // 3: fewer prior sessions than this falls back to all-session median
}
func DefaultConfig() Config
func Points(vGrade int) float64                       // 2^(v/2); unknown grade (-1) scores as V1
func SessionPoints(s session.Session, cfg Config) float64
type Result struct {
	RPE       int
	Title     string // "Hard board session · 18 climbs, top V7"
	Summary   string // "RPE 8/10 · 14 sends, 9 attempts · V4-V7 · synced from Tension Board"
}
func Score(target session.Session, history []session.Session, cfg Config) Result
```

Scoring algorithm (locked during design review):

1. `pts = SessionPoints(target)`: sum over climbs of `Points(VGrade)`, full for sends, `* BidWeight` for attempts.
2. Reference set = sessions in `history` ending within `Window` before `target.Start`; if fewer than `MinHistory`, use all of `history`; if history is empty, RPE base is 6.
3. `load = pts / median(SessionPoints of reference set)`; `base = 6 * sqrt(load)`.
4. Density = climb count / hours between first and last climb (minimum 0.5h): `>= DensityHigh` adds 1, `<= DensityLow` subtracts 1.
5. If any climb in target has `VGrade >= rolling max sent grade` over the reference set (and that max > 0), add 1.
6. `RPE = clamp(round(base + nudges), 1, 10)`.

Title adjective by RPE: 1-3 "Easy board spin", 4-5 "Casual board session", 6-7 "Solid board session", 8-9 "Hard board session", 10 "Max effort board session".

- [ ] **Step 1: Write the failing test**

`effort/effort_test.go`:

```go
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./effort/`
Expected: FAIL (undefined functions).

- [ ] **Step 3: Implement**

`effort/effort.go`:

```go
// Package effort scores climbing sessions on an RPE-style 1-10 scale.
package effort

import (
	"fmt"
	"math"
	"sort"
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
			if c.VGrade >= rollingMax {
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

	return Result{RPE: rpe, Title: title(rpe, target), Summary: summary(rpe, target)}
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
		return "Easy board spin"
	case rpe <= 5:
		return "Casual board session"
	case rpe <= 7:
		return "Solid board session"
	case rpe <= 9:
		return "Hard board session"
	default:
		return "Max effort board session"
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

func title(rpe int, s session.Session) string {
	_, hi := gradeRange(s)
	if hi < 0 {
		return fmt.Sprintf("%s · %d climbs", adjective(rpe), len(s.Climbs))
	}
	return fmt.Sprintf("%s · %d climbs, top V%d", adjective(rpe), len(s.Climbs), hi)
}

func plural(n int, word string) string {
	if n == 1 {
		return fmt.Sprintf("%d %s", n, word)
	}
	return fmt.Sprintf("%d %ss", n, word)
}

func summary(rpe int, s session.Session) string {
	sends, attempts := 0, 0
	for _, c := range s.Climbs {
		if c.Kind == session.Send {
			sends++
		} else {
			attempts++
		}
	}
	lo, hi := gradeRange(s)
	grades := ""
	if lo >= 0 {
		grades = fmt.Sprintf(" · V%d-V%d", lo, hi)
	}
	return fmt.Sprintf("RPE %d/10 · %s, %s%s · synced from Tension Board",
		rpe, plural(sends, "send"), plural(attempts, "attempt"), grades)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./effort/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add effort/
git commit -m "feat: add effort scoring engine"
```

---

### Task 7: state store

**Files:**
- Create: `store/store.go`
- Test: `store/store_test.go`

**Interfaces:**
- Consumes: `config.Dir()` for the default path.
- Produces:

```go
func Open(path string) (*Store, error)  // creates schema if absent
func (s *Store) Close() error
func Fingerprint(userID int, start time.Time) string   // fmt.Sprintf("%d-%d", userID, start.Unix())
func (s *Store) IsPosted(fp string) (bool, error)
func (s *Store) MarkPosted(fp string, stravaID int64, rpe int) error
func (s *Store) PutClimbStats(stats []aurora.ClimbStat) error   // upsert
func (s *Store) ClimbVGrade(climbUUID string, angle int) (int, bool, error) // via grades.VFromDisplay
func (s *Store) GetCursor(name string) (string, error)          // "" when unset
func (s *Store) SetCursor(name, value string) error             // e.g. climb_stats sync date
```

- [ ] **Step 1: Write the failing test**

`store/store_test.go`:

```go
package store

import (
	"path/filepath"
	"testing"
	"time"

	"tension-strava-sync/aurora"
)

func open(t *testing.T) *Store {
	t.Helper()
	s, err := Open(filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestPostedRoundTrip(t *testing.T) {
	s := open(t)
	fp := Fingerprint(42, time.Date(2026, 8, 1, 18, 0, 0, 0, time.Local))
	if posted, _ := s.IsPosted(fp); posted {
		t.Fatal("fresh store should have nothing posted")
	}
	if err := s.MarkPosted(fp, 999, 7); err != nil {
		t.Fatal(err)
	}
	if posted, _ := s.IsPosted(fp); !posted {
		t.Fatal("expected fingerprint to be posted")
	}
	// MarkPosted must be idempotent (re-run after crash).
	if err := s.MarkPosted(fp, 999, 7); err != nil {
		t.Fatalf("second MarkPosted: %v", err)
	}
}

func TestClimbStatsLookup(t *testing.T) {
	s := open(t)
	err := s.PutClimbStats([]aurora.ClimbStat{
		{ClimbUUID: "c1", Angle: 40, DisplayDifficulty: 18.4}, // rounds to 18 = V4
	})
	if err != nil {
		t.Fatal(err)
	}
	v, ok, err := s.ClimbVGrade("c1", 40)
	if err != nil || !ok || v != 4 {
		t.Fatalf("ClimbVGrade = %d,%v,%v want 4,true,nil", v, ok, err)
	}
	if _, ok, _ := s.ClimbVGrade("missing", 40); ok {
		t.Fatal("missing climb should not resolve")
	}
	// Upsert overwrites.
	s.PutClimbStats([]aurora.ClimbStat{{ClimbUUID: "c1", Angle: 40, DisplayDifficulty: 22.0}})
	if v, _, _ := s.ClimbVGrade("c1", 40); v != 6 {
		t.Fatalf("after upsert V = %d want 6", v)
	}
}

func TestCursor(t *testing.T) {
	s := open(t)
	if c, _ := s.GetCursor("climb_stats"); c != "" {
		t.Fatalf("fresh cursor = %q want empty", c)
	}
	s.SetCursor("climb_stats", "2026-08-01 00:00:00.000000")
	if c, _ := s.GetCursor("climb_stats"); c != "2026-08-01 00:00:00.000000" {
		t.Fatalf("cursor = %q", c)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./store/`
Expected: FAIL (undefined).

- [ ] **Step 3: Implement**

`store/store.go`:

```go
// Package store persists sync state in SQLite.
package store

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"

	"tension-strava-sync/aurora"
	"tension-strava-sync/grades"
)

type Store struct{ db *sql.DB }

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	schema := `
	CREATE TABLE IF NOT EXISTS sessions (
		fingerprint TEXT PRIMARY KEY,
		strava_activity_id INTEGER NOT NULL,
		rpe INTEGER NOT NULL,
		posted_at TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS climb_stats (
		climb_uuid TEXT NOT NULL,
		angle INTEGER NOT NULL,
		display_difficulty REAL NOT NULL,
		PRIMARY KEY (climb_uuid, angle)
	);
	CREATE TABLE IF NOT EXISTS cursors (
		name TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);`
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func Fingerprint(userID int, start time.Time) string {
	return fmt.Sprintf("%d-%d", userID, start.Unix())
}

func (s *Store) IsPosted(fp string) (bool, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM sessions WHERE fingerprint = ?`, fp).Scan(&n)
	return n > 0, err
}

func (s *Store) MarkPosted(fp string, stravaID int64, rpe int) error {
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO sessions (fingerprint, strava_activity_id, rpe, posted_at) VALUES (?, ?, ?, ?)`,
		fp, stravaID, rpe, time.Now().Format(time.RFC3339))
	return err
}

func (s *Store) PutClimbStats(stats []aurora.ClimbStat) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	for _, cs := range stats {
		if _, err := tx.Exec(
			`INSERT OR REPLACE INTO climb_stats (climb_uuid, angle, display_difficulty) VALUES (?, ?, ?)`,
			cs.ClimbUUID, cs.Angle, cs.DisplayDifficulty); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) ClimbVGrade(climbUUID string, angle int) (int, bool, error) {
	var display float64
	err := s.db.QueryRow(
		`SELECT display_difficulty FROM climb_stats WHERE climb_uuid = ? AND angle = ?`,
		climbUUID, angle).Scan(&display)
	if err == sql.ErrNoRows {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	v, ok := grades.VFromDisplay(display)
	return v, ok, nil
}

func (s *Store) GetCursor(name string) (string, error) {
	var v string
	err := s.db.QueryRow(`SELECT value FROM cursors WHERE name = ?`, name).Scan(&v)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return v, err
}

func (s *Store) SetCursor(name, value string) error {
	_, err := s.db.Exec(`INSERT OR REPLACE INTO cursors (name, value) VALUES (?, ?)`, name, value)
	return err
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./store/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add store/
git commit -m "feat: add SQLite state store with climb stats cache"
```

---

### Task 8: Strava OAuth and publisher

**Files:**
- Create: `strava/oauth.go`, `strava/publish.go`
- Test: `strava/strava_test.go`

**Interfaces:**
- Consumes: `config.StravaConfig`, `config.Dir()`.
- Produces:

```go
type Tokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
}
func TokensPath() (string, error)                       // <dir>/strava-tokens.json
func LoadTokens() (Tokens, error)
func SaveTokens(t Tokens) error                          // 0600
func Connect(cfg config.StravaConfig, openURL func(string) error) (Tokens, error)
	// serves http://localhost:8723/callback, opens authorize URL, exchanges code

type Client struct { /* cfg, tokens, baseURL */ }
func NewClient(cfg config.StravaConfig, t Tokens) *Client
func NewClientWithBaseURL(cfg config.StravaConfig, t Tokens, apiBase, oauthBase string) *Client // for tests
func (c *Client) EnsureFresh() error                     // refresh when ExpiresAt within 5 min; saves tokens
type Activity struct {
	Name           string
	Description    string
	StartDateLocal time.Time
	ElapsedSeconds int
}
func (c *Client) CreateActivity(a Activity) (int64, error)
	// returns Strava activity ID; returns ErrRateLimited on HTTP 429
var ErrRateLimited = errors.New("strava rate limit hit")
```

- [ ] **Step 1: Write the failing test**

`strava/strava_test.go`:

```go
package strava

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"tension-strava-sync/config"
)

func TestCreateActivity(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/activities" || r.Method != "POST" {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer at1" {
			t.Errorf("auth header = %q", got)
		}
		r.ParseForm()
		if r.Form.Get("sport_type") != "RockClimbing" {
			t.Errorf("sport_type = %q", r.Form.Get("sport_type"))
		}
		if r.Form.Get("name") != "Hard board session · 18 climbs, top V7" {
			t.Errorf("name = %q", r.Form.Get("name"))
		}
		if r.Form.Get("elapsed_time") != "5400" {
			t.Errorf("elapsed_time = %q", r.Form.Get("elapsed_time"))
		}
		w.Write([]byte(`{"id": 1234567}`))
	}))
	defer srv.Close()

	c := NewClientWithBaseURL(config.StravaConfig{}, Tokens{
		AccessToken: "at1", ExpiresAt: time.Now().Add(time.Hour).Unix(),
	}, srv.URL, srv.URL)
	id, err := c.CreateActivity(Activity{
		Name:           "Hard board session · 18 climbs, top V7",
		Description:    "RPE 8/10",
		StartDateLocal: time.Date(2026, 8, 1, 18, 0, 0, 0, time.Local),
		ElapsedSeconds: 5400,
	})
	if err != nil {
		t.Fatal(err)
	}
	if id != 1234567 {
		t.Fatalf("id = %d", id)
	}
}

func TestCreateActivityRateLimited(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(429)
	}))
	defer srv.Close()
	c := NewClientWithBaseURL(config.StravaConfig{}, Tokens{
		AccessToken: "at1", ExpiresAt: time.Now().Add(time.Hour).Unix(),
	}, srv.URL, srv.URL)
	_, err := c.CreateActivity(Activity{Name: "x", StartDateLocal: time.Now(), ElapsedSeconds: 60})
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("err = %v want ErrRateLimited", err)
	}
}

func TestEnsureFreshRefreshesExpiredToken(t *testing.T) {
	t.Setenv("TENSION_STRAVA_SYNC_DIR", t.TempDir())
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/token" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		r.ParseForm()
		if r.Form.Get("grant_type") != "refresh_token" || r.Form.Get("refresh_token") != "rt1" {
			t.Errorf("bad refresh form: %v", r.Form)
		}
		w.Write([]byte(`{"access_token":"at2","refresh_token":"rt2","expires_at":9999999999}`))
	}))
	defer srv.Close()
	c := NewClientWithBaseURL(config.StravaConfig{ClientID: "id", ClientSecret: "sec"},
		Tokens{AccessToken: "at1", RefreshToken: "rt1", ExpiresAt: time.Now().Unix() - 100},
		srv.URL, srv.URL)
	if err := c.EnsureFresh(); err != nil {
		t.Fatal(err)
	}
	if c.tokens.AccessToken != "at2" || c.tokens.RefreshToken != "rt2" {
		t.Fatalf("tokens not refreshed: %+v", c.tokens)
	}
	saved, err := LoadTokens()
	if err != nil || saved.AccessToken != "at2" {
		t.Fatalf("refreshed tokens not persisted: %+v %v", saved, err)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./strava/`
Expected: FAIL (undefined).

- [ ] **Step 3: Implement**

`strava/oauth.go`:

```go
// Package strava handles Strava OAuth and activity publishing.
package strava

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"tension-strava-sync/config"
)

const (
	DefaultAPIBase   = "https://www.strava.com/api/v3"
	DefaultOAuthBase = "https://www.strava.com/oauth"
	callbackAddr     = "localhost:8723"
)

type Tokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
}

func TokensPath() (string, error) {
	dir, err := config.Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "strava-tokens.json"), nil
}

func LoadTokens() (Tokens, error) {
	path, err := TokensPath()
	if err != nil {
		return Tokens{}, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Tokens{}, fmt.Errorf("no Strava tokens; run `tension-strava-sync connect strava` first: %w", err)
	}
	var t Tokens
	if err := json.Unmarshal(data, &t); err != nil {
		return Tokens{}, err
	}
	return t, nil
}

func SaveTokens(t Tokens) error {
	path, err := TokensPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(t, "", "  ")
	return os.WriteFile(path, data, 0o600)
}

// Connect runs the authorization-code flow on localhost and returns tokens.
func Connect(cfg config.StravaConfig, openURL func(string) error) (Tokens, error) {
	codeCh := make(chan string, 1)
	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "missing code", http.StatusBadRequest)
			return
		}
		fmt.Fprintln(w, "Strava connected. You can close this tab.")
		codeCh <- code
	})
	srv := &http.Server{Addr: callbackAddr, Handler: mux}
	go srv.ListenAndServe()
	defer srv.Shutdown(context.Background())

	authURL := DefaultOAuthBase + "/authorize?" + url.Values{
		"client_id":     {cfg.ClientID},
		"redirect_uri":  {"http://" + callbackAddr + "/callback"},
		"response_type": {"code"},
		"scope":         {"activity:write"},
	}.Encode()
	if err := openURL(authURL); err != nil {
		return Tokens{}, err
	}

	select {
	case code := <-codeCh:
		return exchange(cfg, DefaultOAuthBase, url.Values{
			"client_id":     {cfg.ClientID},
			"client_secret": {cfg.ClientSecret},
			"code":          {code},
			"grant_type":    {"authorization_code"},
		})
	case <-time.After(5 * time.Minute):
		return Tokens{}, fmt.Errorf("timed out waiting for Strava authorization")
	}
}

func exchange(cfg config.StravaConfig, oauthBase string, form url.Values) (Tokens, error) {
	resp, err := http.Post(oauthBase+"/token", "application/x-www-form-urlencoded",
		strings.NewReader(form.Encode()))
	if err != nil {
		return Tokens{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Tokens{}, fmt.Errorf("token exchange failed: HTTP %d", resp.StatusCode)
	}
	var t Tokens
	if err := json.NewDecoder(resp.Body).Decode(&t); err != nil {
		return Tokens{}, err
	}
	if err := SaveTokens(t); err != nil {
		return Tokens{}, err
	}
	return t, nil
}
```

`strava/publish.go`:

```go
package strava

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"tension-strava-sync/config"
)

var ErrRateLimited = errors.New("strava rate limit hit")

type Client struct {
	cfg       config.StravaConfig
	tokens    Tokens
	apiBase   string
	oauthBase string
	http      *http.Client
}

func NewClient(cfg config.StravaConfig, t Tokens) *Client {
	return NewClientWithBaseURL(cfg, t, DefaultAPIBase, DefaultOAuthBase)
}

func NewClientWithBaseURL(cfg config.StravaConfig, t Tokens, apiBase, oauthBase string) *Client {
	return &Client{cfg: cfg, tokens: t, apiBase: apiBase, oauthBase: oauthBase,
		http: &http.Client{Timeout: 30 * time.Second}}
}

// EnsureFresh refreshes the access token when it expires within 5 minutes.
func (c *Client) EnsureFresh() error {
	if time.Now().Unix() < c.tokens.ExpiresAt-300 {
		return nil
	}
	t, err := exchange(c.cfg, c.oauthBase, url.Values{
		"client_id":     {c.cfg.ClientID},
		"client_secret": {c.cfg.ClientSecret},
		"refresh_token": {c.tokens.RefreshToken},
		"grant_type":    {"refresh_token"},
	})
	if err != nil {
		return err
	}
	c.tokens = t
	return nil
}

type Activity struct {
	Name           string
	Description    string
	StartDateLocal time.Time
	ElapsedSeconds int
}

func (c *Client) CreateActivity(a Activity) (int64, error) {
	if err := c.EnsureFresh(); err != nil {
		return 0, err
	}
	form := url.Values{
		"name":             {a.Name},
		"sport_type":       {"RockClimbing"},
		"start_date_local": {a.StartDateLocal.Format("2006-01-02T15:04:05Z")},
		"elapsed_time":     {strconv.Itoa(a.ElapsedSeconds)},
		"description":      {a.Description},
		"trainer":          {"0"},
	}
	req, err := http.NewRequest("POST", c.apiBase+"/activities", strings.NewReader(form.Encode()))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Bearer "+c.tokens.AccessToken)
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return 0, ErrRateLimited
	}
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("create activity failed: HTTP %d", resp.StatusCode)
	}
	var out struct {
		ID int64 `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return 0, err
	}
	return out.ID, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./strava/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add strava/
git commit -m "feat: add Strava OAuth flow and activity publisher"
```

---

### Task 9: CLI pipeline (connect, preview, sync)

**Files:**
- Create: `cmd/tension-strava-sync/main.go`, `cmd/tension-strava-sync/sync.go`

**Interfaces:**
- Consumes: everything above.
- Produces: the `tension-strava-sync` binary with subcommands `connect tension`, `connect strava`, `preview`, `sync`; flags `--all` and `--since YYYY-MM-DD` on preview/sync.

Pipeline (shared by preview and sync, in `sync.go`):

1. Load config, open store at `<dir>/state.db`, load Aurora session from Keychain (error tells the user to run `connect tension`).
2. `SyncUser` for ascents + bids.
3. If any bid's `(climb_uuid, angle)` is missing from the climb_stats cache, run `SyncClimbStats` with the stored cursor and upsert + save cursor.
4. Convert rows to `session.Climb`: ascents use `grades.V(difficulty)`; bids use `store.ClimbVGrade` with -1 fallback; parse times via `aurora.ParseTime`; expand nothing (one Climb per row, `Tries` = bid_count).
5. `session.Build`, then filter by cutoff: `--all` = none; `--since` = sessions starting after the date; default = sessions starting today or later when the store has no rows yet, otherwise no cutoff (idempotency skips old posted ones).
6. Score each session against the full session list as history (exclude the target itself).
7. Preview prints one line per session; sync posts unposted sessions oldest-first, marks each in the store, stops cleanly on `ErrRateLimited` with a "run again in 15 minutes" message.
8. `sync --all` prints the preview table first and asks `Post N activities to Strava? [y/N]`.

- [ ] **Step 1: Implement main.go**

`cmd/tension-strava-sync/main.go`:

```go
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
  install-schedule   run sync every 4 hours via launchd`)
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
```

- [ ] **Step 2: Implement sync.go**

`cmd/tension-strava-sync/sync.go`:

```go
package main

import (
	"bufio"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"tension-strava-sync/aurora"
	"tension-strava-sync/config"
	"tension-strava-sync/effort"
	"tension-strava-sync/grades"
	"tension-strava-sync/session"
	"tension-strava-sync/store"
	"tension-strava-sync/strava"
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
	st, err := store.Open(filepath.Join(dir, "state.db"))
	if err != nil {
		return err
	}
	defer st.Close()

	auroraSess, ok := aurora.LoadToken()
	if !ok {
		return fmt.Errorf("not connected to Tension; run `tension-strava-sync connect tension`")
	}

	client := aurora.NewClient("")
	ascents, bids, err := client.SyncUser(auroraSess.Token)
	if err != nil {
		return err
	}
	fmt.Printf("Fetched %d ascents, %d attempts from Tension.\n", len(ascents), len(bids))

	if err := ensureClimbStats(client, st, auroraSess.Token, bids); err != nil {
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
			fp:     store.Fingerprint(auroraSess.UserID, s.Start),
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

// ensureClimbStats refreshes the climb_stats cache when any bid's climb is unknown.
func ensureClimbStats(client *aurora.Client, st *store.Store, token string, bids []aurora.Bid) error {
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
		return nil
	}
	cursor, err := st.GetCursor("climb_stats")
	if err != nil {
		return err
	}
	fmt.Println("Refreshing climb grade data (first run can take a minute)...")
	stats, newCursor, err := client.SyncClimbStats(token, cursor)
	if err != nil {
		return err
	}
	if err := st.PutClimbStats(stats); err != nil {
		return err
	}
	return st.SetCursor("climb_stats", newCursor)
}

func toClimbs(ascents []aurora.Ascent, bids []aurora.Bid, st *store.Store) ([]session.Climb, error) {
	var out []session.Climb
	for _, a := range ascents {
		ts, err := aurora.ParseTime(a.ClimbedAt)
		if err != nil {
			return nil, err
		}
		v, ok := grades.V(a.Difficulty)
		if !ok {
			v = -1
		}
		out = append(out, session.Climb{Time: ts, VGrade: v, Kind: session.Send, Tries: a.BidCount})
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
		out = append(out, session.Climb{Time: ts, VGrade: v, Kind: session.Attempt, Tries: b.BidCount})
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
		if posted, err := st.IsPosted(store.Fingerprint(userID, s.Start)); err != nil {
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
			Name:           s.result.Title,
			Description:    s.result.Summary,
			StartDateLocal: s.sess.Start,
			ElapsedSeconds: int(s.sess.End.Sub(s.sess.Start).Seconds()),
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
		posted++
		fmt.Printf("Posted: %s (activity %d)\n", s.result.Title, id)
	}
	fmt.Printf("Done. %d new activities posted.\n", posted)
	return nil
}
```

- [ ] **Step 3: Add dependency and build**

```bash
go get golang.org/x/term@latest
go build ./...
```

Expected: builds cleanly.

- [ ] **Step 4: Smoke test the binary**

```bash
go run ./cmd/tension-strava-sync
```

Expected: usage text listing all five commands, exit code 2.

```bash
TENSION_STRAVA_SYNC_DIR=$(mktemp -d) go run ./cmd/tension-strava-sync preview
```

Expected: error mentioning config.toml (no config in the temp dir).

- [ ] **Step 5: Run all tests**

Run: `go test ./...`
Expected: all packages PASS.

- [ ] **Step 6: Commit**

```bash
git add cmd/ go.mod go.sum
git commit -m "feat: add CLI with connect, preview, and sync commands"
```

---

### Task 10: launchd schedule installer

**Files:**
- Create: `cmd/tension-strava-sync/schedule.go`

**Interfaces:**
- Consumes: nothing new.
- Produces: `runInstallSchedule() error` (already dispatched from `main.go`).
  Writes `~/Library/LaunchAgents/com.tension-strava-sync.plist` running `sync` every 4 hours, then loads it.

- [ ] **Step 1: Implement**

`cmd/tension-strava-sync/schedule.go`:

```go
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
```

- [ ] **Step 2: Build and vet**

```bash
go build ./... && go vet ./...
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add cmd/tension-strava-sync/schedule.go
git commit -m "feat: add launchd schedule installer"
```

---

### Task 11: Live end-to-end verification (with Will)

This task needs Will present: it uses his real Tension credentials and Strava account.
Nothing is posted until the final step, and the final step posts one recent session first, not the full backfill.

- [ ] **Step 1: Install the binary and connect Tension**

```bash
go install ./cmd/tension-strava-sync
tension-strava-sync connect tension
```

Expected: "Connected to Tension as user NNNN."
If the login response shape differs from the fixture assumptions (fields missing, non-200), capture the raw response with `curl -i -X POST https://tensionboardapp2.com/sessions -H 'Content-Type: application/json' -d '{"username":"...","password":"...","tou":"accepted","pp":"accepted","ua":"app"}'`, adjust `aurora`, update the test fixtures to match reality, and re-run Task 3's tests.

- [ ] **Step 2: Preview full history**

```bash
tension-strava-sync preview --all
```

Expected: fetch counts, then one line per historical session with plausible dates, climb counts, grades, and RPE spread (not all 6s, not all 10s).
Sanity-check against Will's memory of recent sessions; tune `effort.DefaultConfig` if scores feel wrong.

- [ ] **Step 3: Connect Strava and post a single recent session**

```bash
tension-strava-sync connect strava
tension-strava-sync sync --since <date of most recent session>
```

Expected: one activity posted; verify on strava.com that title, description, date, and duration render correctly.
Delete the test activity from Strava afterwards if Will prefers, and clear its row: `sqlite3 ~/.tension-strava-sync/state.db "DELETE FROM sessions"` (only safe at this point because exactly one test activity has ever been posted; after real use, delete by fingerprint instead).

- [ ] **Step 4: Full backfill**

```bash
tension-strava-sync sync --all
```

Expected: preview table, confirm prompt, then posting with rate-limit pauses if history exceeds ~190 sessions.
Re-run `sync --all` after 15 minutes if rate-limited; it resumes where it stopped.

- [ ] **Step 5: Install the schedule**

```bash
tension-strava-sync install-schedule
```

Expected: plist written and loaded; `launchctl list | grep tension` shows the job.

- [ ] **Step 6: Final commit and tag**

```bash
git add -A
git commit -m "chore: finalize v0.1"
git tag v0.1.0
```
