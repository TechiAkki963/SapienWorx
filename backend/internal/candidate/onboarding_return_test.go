package candidate

import "testing"

func TestOnboardingReturnPathIsBounded(t *testing.T) {
	for _, path := range []string{"/referrals", "/candidate/jobs/valid-job", "/jobs/valid-job"} {
		if !onboardingJobPath.MatchString(path) {
			t.Errorf("expected bounded return path %q", path)
		}
	}
	for _, path := range []string{"https://evil.test/referrals", "//evil.test", "/referrals?next=https://evil.test", "/referrals/other", "/referrals#token=secret", "/candidate/profile", "/jobs/../profile"} {
		if onboardingJobPath.MatchString(path) {
			t.Errorf("unsafe return accepted %q", path)
		}
	}
}
