package privacy

import "testing"

func TestValidPrivacyRequestTransition(t *testing.T) {
	tests := []struct {
		name string
		from string
		to   string
		want bool
	}{
		{name: "received starts work", from: "received", to: "in_progress", want: true},
		{name: "received goes to review", from: "received", to: "awaiting_review", want: true},
		{name: "work goes to review", from: "in_progress", to: "awaiting_review", want: true},
		{name: "review resumes work", from: "awaiting_review", to: "in_progress", want: true},
		{name: "work completes", from: "in_progress", to: "fulfilled", want: true},
		{name: "same state is idempotent", from: "in_progress", to: "in_progress", want: true},
		{name: "cannot skip received to fulfilled", from: "received", to: "fulfilled", want: false},
		{name: "fulfilled is terminal", from: "fulfilled", to: "in_progress", want: false},
		{name: "rejected is terminal", from: "rejected", to: "in_progress", want: false},
		{name: "cancelled is terminal", from: "cancelled", to: "received", want: false},
		{name: "unknown state rejected", from: "unknown", to: "in_progress", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := validPrivacyRequestTransition(tt.from, tt.to); got != tt.want {
				t.Fatalf("validPrivacyRequestTransition(%q, %q) = %v, want %v", tt.from, tt.to, got, tt.want)
			}
		})
	}
}

func TestValidPrivacyRequestStatus(t *testing.T) {
	for _, status := range []string{"received", "in_progress", "awaiting_review", "fulfilled", "rejected", "cancelled"} {
		if !validPrivacyRequestStatus(status) {
			t.Fatalf("expected %q to be valid", status)
		}
	}
	if validPrivacyRequestStatus("failed") {
		t.Fatal("unexpected unsupported privacy request status")
	}
}
