package company

import (
	"testing"
	"time"
)

func TestSubscriptionLifecyclePreservesCoreContinuity(t *testing.T) {
	start := time.Date(2026, 9, 9, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0)
	five := int64(5)
	base := Subscription{Managed: true, PlanName: "Talent", State: "active", PeriodStart: &start, PeriodEnd: &end, Features: map[string]bool{"talent.discovery": true}, Capacity: map[string]*int64{"recruiters": &five}, FreeCapacity: map[string]*int64{"recruiters": &five}, LimitsApproved: true}
	for _, test := range []struct {
		name, state string
		cancel      bool
		at          time.Time
		want        string
		talent      bool
	}{{"paid", "active", false, end.Add(-time.Second), "active", true}, {"failed payment grace", "past_due", false, end, "grace", true}, {"grace exact boundary", "past_due", false, end.Add(7 * 24 * time.Hour), "free", false}, {"voluntary cancellation still paid", "active", true, end.Add(-time.Second), "cancellation_scheduled", true}, {"voluntary cancellation no grace", "past_due", true, end, "free", false}, {"expiry without payment failure", "active", false, end, "free", false}, {"before contract", "active", false, start.Add(-time.Second), "free", false}} {
		t.Run(test.name, func(t *testing.T) {
			policy := base
			policy.State = test.state
			policy.CancelAtEnd = test.cancel
			effective := Resolve(policy, nil, test.at)
			if effective.State != test.want || effective.Allows("talent.discovery") != test.talent || !effective.DataPreserved {
				t.Fatalf("unexpected effective state %+v", effective)
			}
		})
	}
}
func TestExistingAccessAndUnapprovedCommercialLimits(t *testing.T) {
	zero := int64(0)
	legacy := Resolve(Subscription{Managed: false, PlanName: "Unconfigured", State: "free", Capacity: map[string]*int64{"recruiters": &zero}, LimitsApproved: true}, nil, time.Now())
	if !legacy.Allows("talent.discovery") || legacy.Limit("recruiters", false) != nil {
		t.Fatal("legacy access changed")
	}
	configured := Resolve(Subscription{Managed: true, PlanName: "Free", State: "free", FreeCapacity: map[string]*int64{"recruiters": &zero}}, nil, time.Now())
	if configured.Limit("recruiters", false) != nil {
		t.Fatal("example limits became enforced")
	}
}
func TestTemporaryGrantsExpireAndDoNotMutatePlan(t *testing.T) {
	now := time.Now().UTC()
	begin := now.Add(-time.Hour)
	end := now.Add(time.Hour)
	five, three := int64(5), int64(3)
	on := true
	policy := Subscription{Managed: true, PlanName: "Talent", State: "active", PeriodStart: &begin, PeriodEnd: &end, Capacity: map[string]*int64{"recruiters": &five}, LimitsApproved: true}
	grants := []Override{{Key: "recruiters", Additional: &three, ExpiresAt: now.Add(time.Minute)}, {Key: "talent.discovery", Enabled: &on, ExpiresAt: now.Add(time.Minute)}}
	first := Resolve(policy, grants, now)
	if *first.Capacity["recruiters"] != 8 || !first.Allows("talent.discovery") {
		t.Fatal("grant not applied")
	}
	second := Resolve(policy, grants, now.Add(time.Minute))
	if *second.Capacity["recruiters"] != 5 || second.Allows("talent.discovery") || *policy.Capacity["recruiters"] != 5 {
		t.Fatal("grant persisted or modified base plan")
	}
}
func TestSubscriptionRejectsInvalidAllocationAndDates(t *testing.T) {
	bad := int64(-1)
	start := time.Now()
	end := start.Add(-time.Hour)
	for _, policy := range []Subscription{{Managed: true, PlanName: "Talent", State: "active", PeriodStart: &start, PeriodEnd: &end}, {PlanName: "Free", State: "free", Features: map[string]bool{"core.delete_data": true}}, {PlanName: "Free", State: "free", Capacity: map[string]*int64{"recruiters": &bad}}} {
		if ValidateSubscription(policy) == nil {
			t.Fatal("invalid policy accepted")
		}
	}
}
