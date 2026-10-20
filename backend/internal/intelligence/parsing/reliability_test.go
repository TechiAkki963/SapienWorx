package parsing

import (
	"context"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func TestProviderRetryCompletesOnlyOneOwnedParseArtifact(t *testing.T) {
	calls := 0
	s, store := testService(t, func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error) {
		return gateway.ProviderResult{}, nil
	})
	cfg := gateway.DefaultConfig()
	cfg.Enabled = true
	cfg.Features[gateway.JDParser] = true
	cfg.MaxRetries = 1
	g, err := gateway.NewService(cfg, providerFunc(func(ctx context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
		calls++
		if calls == 1 {
			return gateway.ProviderResult{}, &gateway.Error{Code: gateway.Timeout, Reason: gateway.ProviderTimeout, Transient: true}
		}
		return output(jobOutput("Synthetic reliability role")), nil
	}), gateway.Options{Gate: allowGate{}, LimiterFactory: func(int, time.Duration) gateway.Limiter { return allowLimit{} }})
	if err != nil {
		t.Fatal(err)
	}
	s.Gateway = g
	ctx := testContext("recruiter", 1)
	text := "Synthetic reliability role in Bengaluru. Hybrid full-time, 3 to 5 years. Skill Golang."
	a, err := s.ParseJob(ctx, text, true)
	if err != nil || a.Status != "requires_review" || calls != 2 || len(store.items) != 1 {
		t.Fatal("retry duplicated artifact or failed", err)
	}
	b, err := s.ParseJob(ctx, text, true)
	if err != nil || b.ID != a.ID || calls != 2 || len(store.items) != 1 {
		t.Fatal("cached retry paid again or duplicated artifact")
	}
}
