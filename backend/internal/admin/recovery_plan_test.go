package admin

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestRecoveryRejectsCaseEquivalentSelfWithoutDatabase(t *testing.T) {
	s := NewService(nil)
	id := "abcdef00-0000-4000-8000-000000000001"
	if _, err := s.PlanMFARecovery(context.Background(), id, strings.ToUpper(id)); !errors.Is(err, ErrInvalid) {
		t.Fatal("case-equivalent self inspection accepted")
	}
	if err := s.RecoverMFA(context.Background(), id, strings.ToUpper(id), "CASE-900", "Identity checked independently"); !errors.Is(err, ErrInvalid) {
		t.Fatal("case-equivalent self recovery accepted")
	}
}
