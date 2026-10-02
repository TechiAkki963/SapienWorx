package messaging

import "testing"

func TestValidateSequenceInput(t *testing.T) {
	valid := OutreachSequenceInput{
		Name: "Priority follow-up",
		Steps: []OutreachSequenceStepInput{
			{TemplateID: "72000000-0000-4000-8000-000000000001", DelayHours: 0},
			{TemplateID: "72000000-0000-4000-8000-000000000002", DelayHours: 48},
		},
	}
	if err := validateSequenceInput(valid); err != nil {
		t.Fatalf("valid sequence rejected: %v", err)
	}

	firstDelayed := valid
	firstDelayed.Steps = append([]OutreachSequenceStepInput(nil), valid.Steps...)
	firstDelayed.Steps[0].DelayHours = 1
	if err := validateSequenceInput(firstDelayed); err == nil {
		t.Fatal("expected first step delay to be rejected")
	}

	instantFollowup := valid
	instantFollowup.Steps = append([]OutreachSequenceStepInput(nil), valid.Steps...)
	instantFollowup.Steps[1].DelayHours = 0
	if err := validateSequenceInput(instantFollowup); err == nil {
		t.Fatal("expected zero-delay follow-up to be rejected")
	}
}

func TestValidateSequenceInputCapsSteps(t *testing.T) {
	steps := make([]OutreachSequenceStepInput, 13)
	for i := range steps {
		steps[i] = OutreachSequenceStepInput{
			TemplateID: "72000000-0000-4000-8000-000000000001",
			DelayHours: 24,
		}
	}
	steps[0].DelayHours = 0
	if err := validateSequenceInput(OutreachSequenceInput{Name: "Too many", Steps: steps}); err == nil {
		t.Fatal("expected sequence with more than 12 steps to be rejected")
	}
}
