package evaluation

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

type fakeProvider func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error)

func (f fakeProvider) Generate(ctx context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
	return f(ctx, r)
}
func TestRunnerStopsAfterInjectedClaimWithoutRetry(t *testing.T) {
	suite := loadTest(t)
	cases := suite.Cases[1:3]
	raw, _ := os.ReadFile("../../../../config/ai-pricing.v1.json")
	cat, e := gateway.LoadPricingCatalog(raw, time.Date(2026, 10, 17, 0, 0, 0, 0, time.UTC))
	if e != nil {
		t.Fatal(e)
	}
	cfg := gateway.DefaultConfig()
	cfg.Enabled = true
	cfg.Features[gateway.JDParser] = true
	cfg.Prices = cat.Models
	cfg.MaxOutputTokens = 6144
	cfg.MaxRetries = 0
	b := &Budget{Cases: cases, Model: cfg.DefaultModel, Version: cat.Version, Price: cat.Models[cfg.DefaultModel], Cap: .25}
	calls := 0
	provider := fakeProvider(func(_ context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
		calls++
		var m map[string]any
		_ = json.Unmarshal(cases[0].OracleOutput(), &m)
		m["skills"] = []string{"Rust"}
		bad, _ := json.Marshal(m)
		return gateway.ProviderResult{Model: r.Model, Output: string(bad), Status: "completed", UsageKnown: true}, nil
	})
	g, e := gateway.NewService(cfg, provider, gateway.Options{Gate: Gate{}, Budget: b, LimiterFactory: func(int, time.Duration) gateway.Limiter { return ConfiguredLimiter{} }})
	if e != nil {
		t.Fatal(e)
	}
	v, _ := candidate.CanonicalContractValidator()
	pending := 0
	results, e := Run(context.Background(), g, cases, suite.Taxonomy, v, func(r Record) error {
		if r.Status == "pending_before_provider" {
			pending++
		}
		return nil
	})
	if e == nil || calls != 1 || pending != 1 || len(results) != 1 || !results[0].InjectionViolation {
		t.Fatal("injection continued", e, calls, pending)
	}
}
