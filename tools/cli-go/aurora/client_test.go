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
		w.WriteHeader(http.StatusCreated) // live API returns 201 on login success
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
