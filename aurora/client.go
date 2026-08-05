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
	// The live API returns 201 Created on successful login.
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
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
	Ascents     []Ascent    `json:"ascents"`
	Bids        []Bid       `json:"bids"`
	ClimbStats  []ClimbStat `json:"climb_stats"`
	Climbs      []ClimbRow  `json:"climbs"`
	UserSyncs   []syncMark  `json:"user_syncs"`
	SharedSyncs []syncMark  `json:"shared_syncs"`
	Complete    bool        `json:"_complete"`
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

// SyncShared pulls the shared climb tables incrementally: climb_stats
// (difficulty per climb+angle) and climbs (name per climb). Pass previously
// returned cursors ("" for a full pull); updated cursors come back for the
// caller to persist.
func (c *Client) SyncShared(token, statsSince, climbsSince string) ([]ClimbStat, []ClimbRow, string, string, error) {
	if statsSince == "" {
		statsSince = epochSyncDate
	}
	if climbsSince == "" {
		climbsSince = epochSyncDate
	}
	cursors := map[string]string{"climb_stats": statsSince, "climbs": climbsSince}
	var stats []ClimbStat
	var climbs []ClimbRow
	err := c.syncTables(token, cursors, func(p syncPage) {
		stats = append(stats, p.ClimbStats...)
		climbs = append(climbs, p.Climbs...)
	})
	return stats, climbs, cursors["climb_stats"], cursors["climbs"], err
}
