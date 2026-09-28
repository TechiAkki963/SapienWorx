package admin

import (
	"errors"
	"testing"
	"time"
)

func TestDashboardWindow(t *testing.T) {
	now := time.Date(2026, 9, 28, 16, 30, 0, 0, time.FixedZone("IST", 19800))
	for _, tc := range []struct{ period, from, to, want string }{
		{"", "", "", "2026-09-22"}, {"today", "", "", "2026-09-28"},
		{"7d", "", "", "2026-09-22"}, {"30d", "", "", "2026-08-30"},
		{"month", "", "", "2026-09-01"}, {"quarter", "", "", "2026-07-01"},
		{"custom", "2026-09-26", "2026-09-27", "2026-09-26"},
	} {
		t.Run(tc.period+tc.from, func(t *testing.T) {
			_, from, to, err := dashboardWindow(now, tc.period, tc.from, tc.to)
			if err != nil || from.Format("2006-01-02") != tc.want || from.Location() != time.UTC {
				t.Fatalf("%v %v", from, err)
			}
			wantEnd := now.UTC()
			if tc.period == "custom" {
				wantEnd = time.Date(2026, 9, 28, 0, 0, 0, 0, time.UTC)
			}
			if !to.Equal(wantEnd) {
				t.Fatalf("end %v, want %v", to, wantEnd)
			}
		})
	}
	for _, tc := range [][3]string{{"invalid", "", ""}, {"custom", "2026-09-28", "2026-09-27"}, {"custom", "oops", "2026-09-28"}, {"custom", "2026-09-28", "2026-09-29"}, {"custom", "2025-09-26", "2026-09-28"}} {
		if _, _, _, err := dashboardWindow(now, tc[0], tc[1], tc[2]); !errors.Is(err, ErrInvalid) {
			t.Fatalf("accepted %v", tc)
		}
	}
	_, from, _, err := dashboardWindow(time.Date(2027, 1, 1, 0, 0, 0, 0, time.UTC), "7d", "", "")
	if err != nil || from.Format("2006-01-02") != "2026-12-26" {
		t.Fatal("year boundary incorrect")
	}
}
