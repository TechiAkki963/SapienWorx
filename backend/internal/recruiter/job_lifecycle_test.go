package recruiter

import "testing"

func TestJobLifecycleTransitions(t *testing.T) {
	allowed := [][2]string{
		{"draft","active"}, {"draft","archived"},
		{"active","paused"}, {"active","closed"},
		{"paused","active"}, {"paused","closed"}, {"paused","archived"},
		{"closed","active"}, {"closed","archived"},
		{"expired","active"}, {"expired","archived"},
	}
	for _, pair := range allowed {
		if !canTransitionJobStatus(pair[0],pair[1]) {
			t.Fatalf("expected %s -> %s to be allowed",pair[0],pair[1])
		}
	}
	blocked := [][2]string{
		{"draft","paused"}, {"active","archived"}, {"active","draft"},
		{"archived","active"}, {"closed","paused"},
	}
	for _, pair := range blocked {
		if canTransitionJobStatus(pair[0],pair[1]) {
			t.Fatalf("expected %s -> %s to be blocked",pair[0],pair[1])
		}
	}
}
