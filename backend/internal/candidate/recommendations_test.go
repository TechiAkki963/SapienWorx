package candidate

import "testing"

func TestTaxonomyRecommendationExplanation(t *testing.T) {
	got := taxonomyRecommendationExplanation(3, 5)

	if got["basis"] != "workforce_taxonomy" {
		t.Fatalf("basis = %v, want workforce_taxonomy", got["basis"])
	}
	if got["matched_competencies"] != 3 {
		t.Fatalf("matched_competencies = %v, want 3", got["matched_competencies"])
	}
	if got["required_competencies"] != 5 {
		t.Fatalf("required_competencies = %v, want 5", got["required_competencies"])
	}
	if got["unmatched_competencies"] != 2 {
		t.Fatalf("unmatched_competencies = %v, want 2", got["unmatched_competencies"])
	}
}

func TestTaxonomyRecommendationExplanationNeverReturnsNegativeUnmatched(t *testing.T) {
	got := taxonomyRecommendationExplanation(4, 3)
	if got["unmatched_competencies"] != 0 {
		t.Fatalf("unmatched_competencies = %v, want 0", got["unmatched_competencies"])
	}
}
