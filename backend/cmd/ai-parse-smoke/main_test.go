package main

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

type fakeProvider func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error)

func (f fakeProvider) Generate(ctx context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
	return f(ctx, r)
}
func TestSmokeIsOptInAndNeverEchoesCredentials(t *testing.T) {
	credential := "synthetic-smoke-key-not-valid"
	values := map[string]string{"APP_ENV": "development", "AI_ENABLED": "true", "AI_JOB_PARSER_ENABLED": "true", "OPENAI_API_KEY": credential, "AI_MODEL_PRICING_JSON": `{"gpt-6-luna":{"input_usd_per_million":0.1,"cached_input_usd_per_million":0.01,"output_usd_per_million":0.5}}`}
	calls := 0
	factory := func(gateway.Secret) (gateway.Provider, error) {
		return fakeProvider(func(_ context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
			calls++
			if r.Feature != gateway.JDParser || r.Schema == nil || r.MaxOutputTokens != 512 || r.Input != syntheticJD {
				t.Fatal("smoke accepted arbitrary work")
			}
			var schema map[string]any
			_ = json.Unmarshal(r.Schema.JSON, &schema)
			fields := map[string]any{}
			for key := range schema["properties"].(map[string]any) {
				fields[key] = nil
			}
			fields["title"] = "Platform Engineer"
			fields["skills"] = []string{"Go", "PostgreSQL"}
			raw, _ := json.Marshal(fields)
			return gateway.ProviderResult{Model: r.Model, Output: string(raw), Status: "completed", UsageKnown: true, Usage: gateway.Usage{InputTokens: 100, OutputTokens: 100, TotalTokens: 200}, RequestID: "req_synthetic_smoke"}, nil
		}), nil
	}
	getenv := func(key string) string { return values[key] }
	var out bytes.Buffer
	if run(nil, getenv, &out, factory) != nil || calls != 0 || !strings.Contains(out.String(), "SKIPPED") {
		t.Fatal("uninvoked smoke made a call")
	}
	if run([]string{"--confirm-billable-openai-test"}, getenv, &out, factory) != nil || calls != 0 {
		t.Fatal("missing environment guard made a call")
	}
	values["AI_REAL_PROVIDER_SMOKE"] = "true"
	out.Reset()
	if err := run([]string{"--confirm-billable-openai-test"}, getenv, &out, factory); err != nil || calls != 1 {
		t.Fatal("fixed mock smoke failed", err)
	}
	if strings.Contains(out.String(), credential) || strings.Contains(out.String(), syntheticJD) || strings.Contains(out.String(), "\"title\"") {
		t.Fatal("sensitive smoke output")
	}
	values["APP_ENV"] = "beta"
	if run([]string{"--confirm-billable-openai-test"}, getenv, &out, factory) == nil || calls != 1 {
		t.Fatal("live environment smoke allowed")
	}
}
func TestSmokeBudgetCapsRetriesAndUnknownPrices(t *testing.T) {
	for _, a := range []gateway.Admission{{MaxAttempts: 2}, {MaxAttempts: 1, MaxOutputTokens: 1024}, {MaxAttempts: 1, MaxOutputTokens: 512, PricingKnown: false}} {
		b := smokeBudget{remaining: 1}
		if _, err := b.Reserve(context.Background(), a); err == nil {
			t.Fatal("unsafe smoke budget admitted")
		}
	}
}
