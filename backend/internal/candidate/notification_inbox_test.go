package candidate

import "testing"

func TestNotificationDestinationRestrictsNavigation(t *testing.T) {
	for _, raw := range []string{"/candidate", "/candidate/jobs/123", "/candidate/inbox?thread=123", "/candidate/settings"} {
		if got := NotificationDestination("message", &raw); got == nil || *got != raw {
			t.Fatalf("rejected candidate destination %q", raw)
		}
	}
	for _, raw := range []string{"https://evil.test", "//evil.test/candidate", "javascript:alert(1)", "/recruiter/candidates/123", "/candidate/../admin", "/candidateevil", "/candidate/%2e%2e/admin", "/candidate\\evil", "/candidate/\nfoo"} {
		if got := NotificationDestination("message", &raw); got != nil {
			t.Fatalf("accepted unsafe destination %q", raw)
		}
	}
	raw := "https://manual-meeting.example.test/room"
	if got := NotificationDestination("interview", &raw); got == nil || *got != "/candidate/interviews" {
		t.Fatal("interview notifications must preserve detail navigation")
	}
}
