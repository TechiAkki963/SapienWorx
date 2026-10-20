package gateway

import (
	"encoding/json"
	"testing"
	"time"
)

func TestBetaRolloutFailsClosedAndKeepsTenantCohortsStable(t *testing.T) {
	actor := "92000000-0000-4000-8000-000000000001"
	tenant := "92000000-0000-4000-8000-000000000002"
	scope := Scope{UserID: actor, TenantID: tenant, Role: "recruiter", RequestID: "92000000-0000-4000-8000-000000000003"}
	for _, tc := range []struct {
		raw   string
		allow bool
	}{
		{`{}`, false}, {`{"beta_rollout":{"stage":"off"}}`, false},
		{`{"beta_rollout":{"stage":"internal","actor_ids":["` + actor + `"]}}`, true},
		{`{"beta_rollout":{"stage":"internal","tenant_ids":["` + tenant + `"]}}`, false},
		{`{"beta_rollout":{"stage":"tenants","tenant_ids":["` + tenant + `"]}}`, true},
		{`{"beta_rollout":{"stage":"tenants","tenant_ids":["bad"]}}`, false},
		{`{"beta_rollout":{"stage":"percentage","percentage":11}}`, false},
		{`{"beta_rollout":{"stage":"all_beta","percentage":100}}`, true},
		{`{"beta_rollout":{"stage":"all_beta","percentage":1}}`, false},
	} {
		if got := BetaRolloutAllowed(json.RawMessage(tc.raw), scope); got != tc.allow {
			t.Fatal("rollout policy mismatch", tc.raw)
		}
	}
	raw := json.RawMessage(`{"beta_rollout":{"stage":"percentage","percentage":5}}`)
	before := BetaRolloutAllowed(raw, scope)
	scope.UserID = "92000000-0000-4000-8000-000000000004"
	if BetaRolloutAllowed(raw, scope) != before {
		t.Fatal("same company split across buckets")
	}
	scope.Role = "candidate"
	scope.TenantID = ""
	if BetaRolloutAllowed(json.RawMessage(`{"beta_rollout":{"stage":"tenants","tenant_ids":["`+tenant+`"]}}`), scope) {
		t.Fatal("candidate forged tenant cohort")
	}
}

func TestGeneratorUsesHardenedThirtySecondDefault(t *testing.T) {
	if DefaultConfig().AttemptTimeout(JDGenerator) != 30*time.Second {
		t.Fatal("generation deadline regressed")
	}
}
