package messaging

import (
	"errors"
	"testing"
)

func TestValidateOutreachSequenceRequiresCooldownSafeDelays(t *testing.T) {
	input:=OutreachSequenceInput{Name:"Engineering nurture",Steps:[]OutreachSequenceStepInput{
		{DelayDays:0,SubjectTemplate:"Hi {{CandidateName}}",BodyTemplate:"Discuss {{JobTitle}}"},
		{DelayDays:14,SubjectTemplate:"Following up",BodyTemplate:"Checking in again"},
	}}
	if err:=validateOutreachSequence(input); err!=nil { t.Fatalf("expected valid sequence: %v",err) }
	input.Steps[1].DelayDays=7
	if err:=validateOutreachSequence(input); !errors.Is(err,ErrInvalidInput) { t.Fatalf("expected cooldown-safe validation failure, got %v",err) }
}

func TestValidateOutreachSequenceRequiresImmediateFirstStep(t *testing.T) {
	input:=OutreachSequenceInput{Name:"Bad",Steps:[]OutreachSequenceStepInput{{DelayDays:14,SubjectTemplate:"Hello",BodyTemplate:"Message"}}}
	if err:=validateOutreachSequence(input); !errors.Is(err,ErrInvalidInput) { t.Fatalf("expected first-step delay failure, got %v",err) }
}
