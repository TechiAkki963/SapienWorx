package messaging

import (
	"errors"
	"strings"
	"testing"
)

func TestNormalizeBulkCandidateIDs(t *testing.T) {
	first := "11111111-1111-4111-8111-111111111111"
	second := "22222222-2222-4222-8222-222222222222"
	got, err := normalizeBulkCandidateIDs([]string{first, " " + first + " ", second})
	if err != nil {
		t.Fatalf("normalizeBulkCandidateIDs returned error: %v", err)
	}
	if len(got) != 2 || got[0] != first || got[1] != second {
		t.Fatalf("unexpected normalized IDs: %#v", got)
	}
}

func TestNormalizeBulkCandidateIDsRejectsInvalidAndOversize(t *testing.T) {
	if _, err := normalizeBulkCandidateIDs([]string{"not-a-uuid"}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for malformed UUID, got %v", err)
	}
	ids := make([]string, MaxBulkInMailRecipients+1)
	for i := range ids {
		ids[i] = "11111111-1111-4111-8111-111111111111"
	}
	if _, err := normalizeBulkCandidateIDs(ids); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput for oversized batch, got %v", err)
	}
}

func TestContainsTemplateVariableMatchesOnlyPlaceholder(t *testing.T) {
	if containsTemplateVariable("We use the JobTitle taxonomy internally.", "JobTitle") {
		t.Fatal("ordinary JobTitle prose must not be treated as a placeholder")
	}
	if !containsTemplateVariable("Discuss our {{ JobTitle }} opportunity", "JobTitle") {
		t.Fatal("expected exact JobTitle placeholder to be detected")
	}
}

func TestRenderBulkTemplate(t *testing.T) {
	got := renderBulkTemplate("Hi {{CandidateName}}, see {{ JobTitle }}.", "Asha $1", "Platform Engineer")
	want := "Hi Asha $1, see Platform Engineer."
	if got != want {
		t.Fatalf("renderBulkTemplate = %q, want %q", got, want)
	}
}

func TestValidateBulkTemplateText(t *testing.T) {
	if err := validateBulkTemplateText("Hi {{CandidateName}}", maxMessageLength); err != nil {
		t.Fatalf("expected supported placeholder to validate: %v", err)
	}
	if err := validateBulkTemplateText("Hi {{Unknown}}", maxMessageLength); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected unknown placeholder to fail, got %v", err)
	}
	if err := validateBulkTemplateText(strings.Repeat("x", maxMessageLength+1), maxMessageLength); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected oversized body to fail, got %v", err)
	}
}

func TestBulkPayloadHashIsStableAndPayloadBound(t *testing.T) {
	ids := []string{
		"11111111-1111-4111-8111-111111111111",
		"22222222-2222-4222-8222-222222222222",
	}
	first, err := bulkPayloadHash(ids, "", "", "Hello", "Hi {{CandidateName}}")
	if err != nil {
		t.Fatal(err)
	}
	second, err := bulkPayloadHash(ids, "", "", "Hello", "Hi {{CandidateName}}")
	if err != nil {
		t.Fatal(err)
	}
	changed, err := bulkPayloadHash(ids, "", "", "Different", "Hi {{CandidateName}}")
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Fatal("same canonical bulk request produced different hashes")
	}
	if first == changed {
		t.Fatal("different bulk payload reused the same hash")
	}
}

func TestBulkIdempotencyKeyValidation(t *testing.T) {
	for _, value := range []string{"12345678", "batch:2026-10-02.01", "550e8400-e29b-41d4-a716-446655440000"} {
		if !idempotencyKeyPattern.MatchString(value) {
			t.Fatalf("valid idempotency key rejected: %q", value)
		}
	}
	for _, value := range []string{"short", "has spaces", strings.Repeat("x", 129)} {
		if idempotencyKeyPattern.MatchString(value) {
			t.Fatalf("invalid idempotency key accepted: %q", value)
		}
	}
}

func TestNewServiceWithPolicyFallsBackToSafeDefaults(t *testing.T) {
	service := NewServiceWithPolicy(nil, AntiSpamPolicy{})
	defaults := DefaultAntiSpamPolicy()
	if service.antiSpamPolicy != defaults {
		t.Fatalf("policy = %+v, want %+v", service.antiSpamPolicy, defaults)
	}
}

func TestRateLimitErrorWrapsSentinel(t *testing.T) {
	err := &RateLimitError{}
	if !errors.Is(err, ErrRateLimited) {
		t.Fatal("RateLimitError must wrap ErrRateLimited")
	}
}
