package candidate

import "testing"

func TestCalculateProfileCompletionUsesProfileEvidence(t *testing.T) {
	profile := Profile{FullName: "Candidate", Headline: stringPointer("Engineer"), NoticePeriodDays: intPointer(30)}
	if got := calculateProfileCompletion(profile, map[string]any{}, false); got != 23 {
		t.Fatalf("expected identity and headline evidence (23), got %d", got)
	}

	details := map[string]any{
		"professional_summary": "Builds reliable services.",
		"employment":           []any{map[string]any{"company": "Example", "job_title": "Engineer"}},
		"education":            []any{map[string]any{"level": "Bachelor", "university": "Example University"}},
		"it_skills":            []any{map[string]any{"name": "Go"}, map[string]any{"name": "SQL"}, map[string]any{"name": "PostgreSQL"}},
		"projects":             "A relevant project",
		"professional_links":   "https://example.com",
		"preferred_locations":  "Mumbai",
	}
	if got := calculateProfileCompletion(profile, details, true); got != 100 {
		t.Fatalf("expected a complete evidenced profile to score 100, got %d", got)
	}
}

func TestCalculateProfileCompletionDoesNotCountEmptyRecords(t *testing.T) {
	details := map[string]any{
		"employment": []any{map[string]any{"company": "", "job_title": ""}},
		"education":  []any{map[string]any{"university": ""}},
		"it_skills":  []any{map[string]any{"name": ""}},
	}
	if got := calculateProfileCompletion(Profile{FullName: "Candidate"}, details, false); got != 15 {
		t.Fatalf("expected empty records not to add completion, got %d", got)
	}
}

func TestReferenceCompletionDeduplicatesSkillsAndExcludesPrivateInformation(t *testing.T) {
	details := map[string]any{
		"key_skills":    []any{"Go", " go ", "PostgreSQL"},
		"it_skills":     []any{map[string]any{"name": "GO"}},
		"date_of_birth": "2000-02-29", "disability_percentage": "40",
		"military_service_number": "SYNTHETIC-ONLY", "fixed_salary": "1000000",
	}
	profile := Profile{FullName: "Candidate"}
	if got := calculateProfileCompletion(profile, details, false); got != 22 {
		t.Fatalf("duplicate skills and private fields must not inflate completion: got %d", got)
	}
	details["key_skills"] = []any{"Go", "PostgreSQL", "TypeScript"}
	details["work_samples"] = []any{map[string]any{"title": "Synthetic sample"}}
	details["online_profiles"] = []any{map[string]any{"url": "https://example.test/portfolio"}}
	if got := calculateProfileCompletion(profile, details, false); got != 40 {
		t.Fatalf("reference professional evidence should retain existing section weights: got %d", got)
	}
}

func stringPointer(value string) *string { return &value }
func intPointer(value int) *int          { return &value }
