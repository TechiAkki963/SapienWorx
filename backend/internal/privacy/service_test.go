package privacy

import (
	"testing"
	"time"
)

func TestPrivacyDueAtUsesCalendarMonth(t *testing.T) {
	start := time.Date(2026, time.January, 31, 10, 30, 0, 0, time.UTC)
	want := start.AddDate(0, 1, 0)
	if got := privacyDueAt(start); !got.Equal(want) {
		t.Fatalf("privacyDueAt(%s)=%s want calendar month %s", start, got, want)
	}
}

func TestSafeExportSectionsRemainExplicit(t *testing.T) {
	for _, section := range []string{"account", "profile", "applications", "saved_jobs", "notifications", "messages", "consents", "privacy_requests"} {
		if _, ok := SafeExportSections[section]; !ok {
			t.Fatalf("required safe export section %q missing", section)
		}
	}
	if _, ok := SafeExportSections["*"]; ok {
		t.Fatal("wildcard export section must never be allowed")
	}
}
