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

func TestSetPerceivedExertion(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/activities/1234567" || r.Method != "PUT" {
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
		}
		r.ParseForm()
		if r.Form.Get("perceived_exertion") != "7" || r.Form.Get("prefer_perceived_exertion") != "true" {
			t.Errorf("bad form: %v", r.Form)
		}
		w.Write([]byte(`{"id": 1234567}`))
	}))
	defer srv.Close()
	c := NewClientWithBaseURL(config.StravaConfig{}, Tokens{
		AccessToken: "at1", ExpiresAt: time.Now().Add(time.Hour).Unix(),
	}, srv.URL, srv.URL)
	if err := c.SetPerceivedExertion(1234567, 7); err != nil {
		t.Fatal(err)
	}
}
