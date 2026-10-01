package recruiter

import (
	"strings"
	"testing"
)

func TestRecruiterVisibleCandidateDetailsExcludesSensitiveFields(t *testing.T) {
	input := map[string]any{
		"professional_summary":  "Builds reliable systems.",
		"gender":                "Prefer not to say",
		"date_of_birth":         "1990-01-01",
		"current_salary_amount": 1200000,
		"permanent_address":     "Private address",
		"employment": []any{map[string]any{
			"company":        "Example Ltd",
			"job_title":      "Engineer",
			"current_salary": "1200000",
		}},
	}

	got := recruiterVisibleCandidateDetails(input)
	if got["professional_summary"] != "Builds reliable systems." {
		t.Fatalf("expected allowed summary to remain, got %#v", got)
	}
	for _, key := range []string{"gender", "date_of_birth", "current_salary_amount", "permanent_address"} {
		if _, exists := got[key]; exists {
			t.Errorf("sensitive field %q was exposed", key)
		}
	}
	employment := got["employment"].([]map[string]any)
	if len(employment) != 1 || employment[0]["company"] != "Example Ltd" {
		t.Fatalf("expected allow-listed employment to remain, got %#v", employment)
	}
	if _, exists := employment[0]["current_salary"]; exists {
		t.Error("employment salary was exposed")
	}
}

func TestRecruiterVisibleCandidateDetailsSanitizesProfessionalRecords(t *testing.T) {
	input := map[string]any{
		"projects":           []any{map[string]any{"title": "Payments migration", "description": "Moved payment flows.", "private_note": "do not expose"}},
		"accomplishments":    []any{map[string]any{"title": "Top performer", "issuer": "Example Ltd", "private_note": "hidden"}},
		"professional_links": []any{map[string]any{"label": "Portfolio", "url": "https://example.com", "token": "secret"}},
	}
	got := recruiterVisibleCandidateDetails(input)
	for _, tc := range []struct {
		key, forbidden string
	}{
		{"projects", "private_note"},
		{"accomplishments", "private_note"},
		{"professional_links", "token"},
	} {
		records := got[tc.key].([]map[string]any)
		if len(records) != 1 {
			t.Fatalf("expected one sanitized %s record, got %#v", tc.key, records)
		}
		if _, exists := records[0][tc.forbidden]; exists {
			t.Errorf("unexpected field %q exposed in %s", tc.forbidden, tc.key)
		}
	}
}

func TestCandidatePrivacyPredicatesFailClosed(t *testing.T) {
	for name, predicate := range map[string]string{
		"discovery": candidateDiscoverablePredicate,
		"contact":   candidateContactPublicPredicate,
	} {
		if !strings.Contains(predicate, "='true'") && name == "discovery" {
			t.Fatalf("%s predicate must require explicit true", name)
		}
		if strings.Contains(predicate, "::boolean") {
			t.Fatalf("%s predicate must not cast profile JSON text to boolean", name)
		}
	}
}

func TestMaskCandidatePhoneHidesEntireNumber(t *testing.T) {
	for _, input := range []string{"+919876543210", "9876543210", "1234"} {
		if got := maskCandidatePhone(input); got != "••••••••••" {
			t.Fatalf("maskCandidatePhone(%q)=%q want fully hidden mask", input, got)
		}
	}
}
