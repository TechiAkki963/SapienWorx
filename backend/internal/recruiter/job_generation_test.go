package recruiter

import (
	"context"
	"testing"
	"time"
)

func TestGenerationReviewSurvivesExpiryAndInvalidatesOnEdits(t *testing.T) {
	s := &Service{}
	in := DetailedJobInput{Title: "Role", Description: "Reviewed prose", Skills: []string{"Go"}}
	now := time.Now().UTC()
	meta := JobGenerationMetadata{GenerationID: "original", GeneratedByAI: true, ReviewedBy: "reviewer", ReviewedAt: &now, ContentHash: JobGenerationContentHash(in)}
	if !generationAllowsPublish(meta) {
		t.Fatal("reviewed manual save blocked")
	}
	in.Description = "Changed prose"
	next, err := s.generationForSave(context.Background(), "current-editor", "tenant", in, meta)
	if err != nil || !next.RequiresReview || generationAllowsPublish(next) {
		t.Fatal("removing provenance pointer bypassed review")
	}
	in.AIGenerationID = "original"
	in.AIGenerationReviewed = true
	next, err = s.generationForSave(context.Background(), "current-editor", "tenant", in, meta)
	if err != nil || next.RequiresReview || next.ReviewedBy != "current-editor" || !generationAllowsPublish(next) {
		t.Fatal("durable review after expiry")
	}
	in.AIGenerationID = "foreign-new-operation"
	if _, err = s.generationForSave(context.Background(), "current-editor", "tenant", in, meta); err != ErrAIReviewRequired {
		t.Fatal("new unverified operation")
	}
}

func TestGenerationContentHashAndManualFlow(t *testing.T) {
	a := DetailedJobInput{Title: "Engineer", Description: "Prose", Skills: []string{"Go"}}
	b := a
	b.Title = " Engineer "
	b.Description = " Prose "
	b.InternalNotes = "Private"
	b.Publish = true
	if JobGenerationContentHash(a) != JobGenerationContentHash(b) {
		t.Fatal("normalization/private-state drift")
	}
	b.Skills = []string{"SQL"}
	if JobGenerationContentHash(a) == JobGenerationContentHash(b) {
		t.Fatal("requirements not bound")
	}
	meta, err := (&Service{}).generationForSave(context.Background(), "user", "tenant", a, JobGenerationMetadata{})
	if err != nil || !generationAllowsPublish(meta) {
		t.Fatal("manual job requires AI")
	}
}
