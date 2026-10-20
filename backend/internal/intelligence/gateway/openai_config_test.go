package gateway

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestCredentialsCannotBeCopiedIntoModelOrPricingMetadata(t *testing.T) {
	for _, values := range []map[string]string{
		{"OPENAI_API_KEY": testCredential, "OPENAI_DEFAULT_MODEL": "model-" + testCredential},
		{"OPENAI_API_KEY": testCredential, "AI_MODEL_PRICING_JSON": `{"model-` + testCredential + `":{"input_usd_per_million":1}}`},
	} {
		_, err := LoadConfig(func(k string) string { return values[k] })
		if err == nil || strings.Contains(err.Error(), testCredential) {
			t.Fatal("credential accepted as metadata or included in error")
		}
	}
	cfg := configured()
	cfg.Prices[testCredential] = Price{}
	raw, err := json.Marshal(cfg)
	if err != nil || strings.Contains(string(raw), testCredential) {
		t.Fatal("configuration JSON leaked credential material")
	}
}

func TestAllSafeProviderStatusStates(t *testing.T) {
	disabled, err := NewService(DefaultConfig(), nil, Options{})
	if err != nil || disabled.Health().State != "disabled" {
		t.Fatal("disabled startup failed")
	}
	cfg := configured()
	missing := newTestService(t, cfg, nil, Options{})
	if missing.Health().State != "not_configured" {
		t.Fatal("missing provider status incorrect")
	}
	cfg.MaxRetries = 0
	failing := newTestService(t, cfg, providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) {
		return ProviderResult{}, &Error{Code: ProviderUnavailable}
	}), Options{})
	if failing.Health().State != "configured" {
		t.Fatal("configured status incorrect")
	}
	_, _ = failing.Generate(scopeContext(), simpleRequest())
	if failing.Health().State != "degraded" {
		t.Fatal("degraded status incorrect")
	}
	_, _ = failing.Generate(scopeContext(), simpleRequest())
	_, _ = failing.Generate(scopeContext(), simpleRequest())
	if failing.Health().State != "unavailable" {
		t.Fatal("unavailable status incorrect")
	}
	healthy := newTestService(t, cfg, providerFunc(successProvider), Options{})
	_, err = healthy.Generate(scopeContext(), simpleRequest())
	if err != nil || healthy.Health().State != "healthy" {
		t.Fatal("healthy status incorrect")
	}
}

func TestOpenAIExplicitDisabledVetoesLegacyEnable(t *testing.T) {
	values := map[string]string{"AI_ENABLED": "true", "OPENAI_ENABLED": "false", "OPENAI_API_KEY": testCredential}
	cfg, err := LoadConfig(func(k string) string { return values[k] })
	if err != nil || cfg.Enabled {
		t.Fatal("OPENAI_ENABLED=false did not veto legacy enable")
	}
	calls := 0
	s, err := NewService(cfg, providerFunc(func(context.Context, ProviderRequest) (ProviderResult, error) { calls++; return ProviderResult{}, nil }), Options{})
	if err != nil || s.Health().State != "disabled" {
		t.Fatal("disabled provider prevented startup")
	}
	_, err = s.Generate(scopeContext(), simpleRequest())
	assertCode(t, err, Disabled)
	if calls != 0 {
		t.Fatal("disabled provider was called")
	}
}

func TestOpenAIModelConfigurationHasPriorityAndNoFeatureActivation(t *testing.T) {
	values := map[string]string{"OPENAI_ENABLED": "false", "AI_MODEL_DEFAULT": "legacy-model", "OPENAI_DEFAULT_MODEL": "configured-model", "OPENAI_PARSER_MODEL": "parser-model", "OPENAI_GENERATION_MODEL": "generation-model"}
	cfg, err := LoadConfig(func(k string) string { return values[k] })
	if err != nil || cfg.DefaultModel != "configured-model" || cfg.model(CVParser) != "parser-model" || cfg.model(JDParser) != "parser-model" || cfg.model(JDGenerator) != "generation-model" {
		t.Fatal("canonical model configuration not respected")
	}
	for _, enabled := range cfg.Features {
		if enabled {
			t.Fatal("model configuration activated a feature")
		}
	}
	values["OPENAI_ENABLED"] = "invalid"
	if _, err := LoadConfig(func(k string) string { return values[k] }); err == nil {
		t.Fatal("invalid enable switch accepted")
	}
}
