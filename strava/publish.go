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

var (
	ErrRateLimited = errors.New("strava rate limit hit")
	// ErrNotFound means the activity no longer exists on Strava (deleted).
	ErrNotFound = errors.New("strava activity not found")
)

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
	// PerceivedExertion (1-10) feeds Strava's native RPE field so effort
	// trends chart over time; 0 omits the field.
	PerceivedExertion int
}

// SetPerceivedExertion patches an existing activity's RPE. Strava's create
// endpoint ignores perceived_exertion; only the update endpoint honors it.
// prefer_perceived_exertion makes Strava use it for relative effort.
func (c *Client) SetPerceivedExertion(activityID int64, rpe int) error {
	if err := c.EnsureFresh(); err != nil {
		return err
	}
	form := url.Values{
		"perceived_exertion":        {strconv.Itoa(rpe)},
		"prefer_perceived_exertion": {"true"},
	}
	req, err := http.NewRequest("PUT",
		fmt.Sprintf("%s/activities/%d", c.apiBase, activityID),
		strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Bearer "+c.tokens.AccessToken)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusTooManyRequests {
		return ErrRateLimited
	}
	if resp.StatusCode == http.StatusNotFound {
		return ErrNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("set perceived exertion failed: HTTP %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) CreateActivity(a Activity) (int64, error) {
	if err := c.EnsureFresh(); err != nil {
		return 0, err
	}
	form := url.Values{
		"name":       {a.Name},
		"sport_type": {"RockClimbing"},
		// the literal Z suffix is deliberate - Strava's start_date_local takes wall-clock time and
		// ignores the zone designator; do not switch to RFC3339 with a real offset
		"start_date_local": {a.StartDateLocal.Format("2006-01-02T15:04:05Z")},
		"elapsed_time":     {strconv.Itoa(a.ElapsedSeconds)},
		"description":      {a.Description},
		"trainer":          {"0"},
	}
	if a.PerceivedExertion > 0 {
		form.Set("perceived_exertion", strconv.Itoa(a.PerceivedExertion))
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
