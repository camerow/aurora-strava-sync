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

// ClimbRow is the slice of the shared climbs table we cache: name per climb.
type ClimbRow struct {
	UUID string `json:"uuid"`
	Name string `json:"name"`
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
