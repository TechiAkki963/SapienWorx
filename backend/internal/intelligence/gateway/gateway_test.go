package gateway

import "testing"

func TestRedactSensitiveKeysRecursively(t *testing.T) {
	input := map[string]any{
		"job_id": "123",
		"email":  "candidate@example.com",
		"nested": map[string]any{
			"token": "secret",
			"score": 87,
		},
	}
	out := redact(input)
	if out["email"] != "[REDACTED]" {
		t.Fatalf("email was not redacted: %#v", out)
	}
	nested, ok := out["nested"].(map[string]any)
	if !ok || nested["token"] != "[REDACTED]" {
		t.Fatalf("nested token was not redacted: %#v", out)
	}
	if nested["score"] != 87 {
		t.Fatalf("non-sensitive metadata changed: %#v", out)
	}
	if got := redactionCount(input); got != 2 {
		t.Fatalf("expected 2 redactions, got %d", got)
	}
}
