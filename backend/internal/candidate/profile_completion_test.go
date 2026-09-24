package candidate

import "testing"

func TestCalculateProfileCompletionUsesProfileEvidence(t *testing.T) {
	profile := Profile{FullName: "Candidate", Headline: stringPointer("Engineer"), NoticePeriodDays: intPointer(30)}
	if got := calculateProfileCompletion(profile, map[string]any{}, false); got != 23 {
		t.Fatalf("expected identity and headline evidence (23), got %d", got)
	}

	details := map[string]any{
		"professional_summary": "Builds reliable services.",
		"employment": []any{map[string]any{"company": "Example", "job_title": "Engineer"}},
		"education":  []any{map[string]any{"level": "Bachelor", "university": "Example University"}},
		"it_skills":  []any{map[string]any{"name": "Go"}, map[string]any{"name": "SQL"}, map[string]any{"name": "PostgreSQL"}},
		"projects":   "A relevant project",
		"professional_links": "https://example.com",
		"preferred_locations": "Mumbai",
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

func stringPointer(value string) *string { return &value }
func intPointer(value int) *int { return &value }
