// Package strava handles Strava OAuth and activity publishing.
package strava

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
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
	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		return Tokens{}, err
	}
	state := hex.EncodeToString(stateBytes)

	codeCh := make(chan string, 1)
	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("state") != state {
			http.Error(w, "invalid state", http.StatusBadRequest)
			return
		}
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "missing code", http.StatusBadRequest)
			return
		}
		fmt.Fprintln(w, "Strava connected. You can close this tab.")
		codeCh <- code
	})
	ln, err := net.Listen("tcp", callbackAddr)
	if err != nil {
		return Tokens{}, fmt.Errorf("cannot listen on %s (already in use?): %w", callbackAddr, err)
	}
	srv := &http.Server{Handler: mux}
	go srv.Serve(ln)
	defer srv.Shutdown(context.Background())

	authURL := DefaultOAuthBase + "/authorize?" + url.Values{
		"client_id":     {cfg.ClientID},
		"redirect_uri":  {"http://" + callbackAddr + "/callback"},
		"response_type": {"code"},
		// activity:read_all is needed alongside write: Strava's update
		// endpoint 404s on activities the token cannot read (private
		// activities in particular), even with write scope.
		"scope": {"activity:write,activity:read_all"},
		"state": {state},
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
