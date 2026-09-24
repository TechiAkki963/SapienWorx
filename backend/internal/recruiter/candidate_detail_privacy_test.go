package recruiter

import "testing"

func TestRecruiterVisibleCandidateDetailsExcludesSensitiveFields(t *testing.T) {
	input := map[string]any{
		"professional_summary": "Builds reliable systems.",
		"gender": "Prefer not to say",
		"date_of_birth": "1990-01-01",
		"current_salary_amount": 1200000,
		"permanent_address": "Private address",
		"employment": []any{map[string]any{
			"company": "Example Ltd",
			"job_title": "Engineer",
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
