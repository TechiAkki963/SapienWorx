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
	got, err := savedSearchDiscoveryFilters(filters, since)
	if err != nil {
		t.Fatal(err)
	}
	if got.Query != "Go AND PostgreSQL" || got.Location != "Mumbai" || got.MinExperience != 3 || got.MaxExperience != 8 || got.MaxNoticeDays != 30 || !got.HasMaxNotice || got.Industry != "Logistics" || got.Sort != "least_notice" {
		t.Fatalf("unexpected saved-search filter mapping: %+v", got)
	}
	if got.UpdatedSince != "2026-10-02T13:30:00Z" || got.Page != 1 {
		t.Fatalf("unexpected alert window: %+v", got)
	}
}

func TestSavedSearchURLUsesOpaqueOwnedID(t *testing.T) {
	href := savedSearchURL("owned-search-id")
	if href != "/recruiter/discover?search_id=owned-search-id" {
		t.Fatalf("unexpected alert href: %s", href)
	}
	if strings.Contains(href, "q=") || strings.Contains(href, "location=") {
		t.Fatalf("unsupported/private filter leaked into alert href: %s", href)
	}
}

func TestSavedSearchRejectsRestrictedCriteriaAndPreservesDecimalWindow(t *testing.T) {
	if _, err := canonicalSearchFilters(map[string]any{"min_salary": "1"}); err != ErrSearchRestricted {
		t.Fatalf("salary restriction: %v", err)
	}
	if _, err := canonicalSearchFilters(map[string]any{"private_email": "hidden@example.test"}); err != ErrInvalid {
		t.Fatalf("private field: %v", err)
	}
	got, err := savedSearchDiscoveryFilters(map[string]any{"min_experience": 2.5, "max_experience": "7.25", "ug_mode": "none", "verified_email": true, "updated_since": "2026-10-06"}, time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC))
	if err != nil || got.MinExperience != 2.5 || got.MaxExperience != 7.25 || got.Criteria["verified_email"] != "true" || got.Criteria["ug_mode"] != "none" || got.UpdatedSince != "2026-10-06T00:00:00Z" {
		t.Fatalf("criteria widened: %+v %v", got, err)
	}
}
