package recruiter

import (
	"strings"
	"testing"
	"time"
)

func TestSavedSearchDiscoveryFiltersPreserveSourcingContract(t *testing.T) {
	since := time.Date(2026, 10, 2, 13, 30, 0, 0, time.UTC)
	filters := map[string]any{
		"q":               "Go AND PostgreSQL",
		"location":        "Mumbai",
		"min_experience":  "3",
		"max_experience":  float64(8),
		"max_notice_days": "30",
		"industry":        "Logistics",
		"sort":            "least_notice",
	}
	got := savedSearchDiscoveryFilters(filters, since)
	if got.Query != "Go AND PostgreSQL" || got.Location != "Mumbai" || got.MinExperience != 3 || got.MaxExperience != 8 || got.MaxNoticeDays != 30 || !got.HasMaxNotice || got.Industry != "Logistics" || got.Sort != "least_notice" {
		t.Fatalf("unexpected saved-search filter mapping: %+v", got)
	}
	if got.UpdatedSince != "2026-10-02" || got.Page != 1 {
		t.Fatalf("unexpected alert window: %+v", got)
	}
}

func TestSavedSearchURLUsesOnlySupportedFilters(t *testing.T) {
	href := savedSearchURL(map[string]any{
		"q":             "nurse",
		"location":      "Navi Mumbai",
		"private_email": "must-not-leak@example.test",
	})
	if !strings.HasPrefix(href, "/recruiter/discover?") || !strings.Contains(href, "q=nurse") || !strings.Contains(href, "location=Navi+Mumbai") {
		t.Fatalf("unexpected alert href: %s", href)
	}
	if strings.Contains(href, "private_email") || strings.Contains(href, "must-not-leak") {
		t.Fatalf("unsupported/private filter leaked into alert href: %s", href)
	}
}
