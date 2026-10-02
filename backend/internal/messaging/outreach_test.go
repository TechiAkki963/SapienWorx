package messaging

import (
	"strings"
	"testing"
)

func TestValidateSequenceInput(t *testing.T) {
	valid := SequenceInput{
		Name:        "Qualified candidate follow-up",
		Description: "Two-step recruiter outreach.",
		StopOnReply: true,
		Steps: []SequenceStepInput{
			{DelayHours: 0, SubjectTemplate: "{{JobTitle}} opportunity", BodyTemplate: "Hi {{CandidateName}}, let us discuss {{JobTitle}}."},
			{DelayHours: 48, SubjectTemplate: "Following up on {{JobTitle}}", BodyTemplate: "Hi {{CandidateName}}, following up on {{JobTitle}}."},
		},
	}
	if err := validateSequenceInput(valid); err != nil {
		t.Fatalf("valid sequence rejected: %v", err)
	}

	invalidFirstDelay := valid
	invalidFirstDelay.Steps = append([]SequenceStepInput(nil), valid.Steps...)
	invalidFirstDelay.Steps[0].DelayHours = 1
	if err := validateSequenceInput(invalidFirstDelay); err == nil {
		t.Fatal("expected first-step delay to be rejected")
	}

	invalidFollowUp := valid
	invalidFollowUp.Steps = append([]SequenceStepInput(nil), valid.Steps...)
	invalidFollowUp.Steps[1].DelayHours = 0
	if err := validateSequenceInput(invalidFollowUp); err == nil {
		t.Fatal("expected zero-hour follow-up to be rejected")
	}

	tooMany := valid
	tooMany.Steps = make([]SequenceStepInput, MaxSequenceSteps+1)
	for i := range tooMany.Steps {
		tooMany.Steps[i] = SequenceStepInput{DelayHours: 24, SubjectTemplate: "Subject", BodyTemplate: "Message"}
	}
	tooMany.Steps[0].DelayHours = 0
	if err := validateSequenceInput(tooMany); err == nil {
		t.Fatal("expected too many steps to be rejected")
	}

	unsupportedVariable := valid
	unsupportedVariable.Steps = append([]SequenceStepInput(nil), valid.Steps...)
	unsupportedVariable.Steps[0].BodyTemplate = "Hi {{CandidateEmail}}"
	if err := validateSequenceInput(unsupportedVariable); err == nil {
		t.Fatal("expected unsupported template variable to be rejected")
	}
}

func TestLimitOutreachError(t *testing.T) {
	long := strings.Repeat("x", 300)
	if got := limitOutreachError(long); len(got) != 240 {
		t.Fatalf("len(limitOutreachError) = %d, want 240", len(got))
	}
	if got := limitOutreachError("  failure  "); got != "failure" {
		t.Fatalf("limitOutreachError = %q, want failure", got)
	}
}

func TestValueOrEmpty(t *testing.T) {
	if got := valueOrEmpty(nil); got != "" {
		t.Fatalf("valueOrEmpty(nil) = %q", got)
	}
	value := "job-id"
	if got := valueOrEmpty(&value); got != value {
		t.Fatalf("valueOrEmpty = %q, want %q", got, value)
	}
}
