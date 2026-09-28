package engine

import "testing"

func TestSkillOverlap(t *testing.T) {
	score, matched := skillOverlap([]string{"go","postgresql","aws"}, []string{"go","aws","kubernetes"})
	if score < 0.66 || score > 0.67 {
		t.Fatalf("unexpected score: %v", score)
	}
	if len(matched) != 2 || matched[0] != "go" || matched[1] != "aws" {
		t.Fatalf("unexpected matched skills: %#v", matched)
	}
}

func TestExperienceFit(t *testing.T) {
	max := 72
	if got := experienceFit(60, 36, &max); got != 1 {
		t.Fatalf("expected full fit, got %v", got)
	}
	if got := experienceFit(18, 36, &max); got >= 1 || got <= 0 {
		t.Fatalf("expected partial fit, got %v", got)
	}
}

func TestAvailabilityFit(t *testing.T) {
	fifteen := 15
	ninety := 90
	if availabilityFit(&fifteen) != 1 {
		t.Fatal("15 day notice should be full availability")
	}
	if availabilityFit(&ninety) >= availabilityFit(&fifteen) {
		t.Fatal("longer notice should not score above shorter notice")
	}
}

func TestFeedbackLabels(t *testing.T) {
	hired := feedbackLabel("application.stage_changed", map[string]any{"stage":"hired"})
	rejected := feedbackLabel("application.stage_changed", map[string]any{"stage":"rejected"})
	if hired == nil || *hired != 1 {
		t.Fatalf("unexpected hired label: %#v", hired)
	}
	if rejected == nil || *rejected >= 0 {
		t.Fatalf("unexpected rejected label: %#v", rejected)
	}
}

func TestLexicalRelevanceIsBounded(t *testing.T) {
	got := lexicalRelevance("Senior Backend Engineer", "Backend Engineer")
	if got < 0 || got > 1 {
		t.Fatalf("score out of range: %v", got)
	}
}
