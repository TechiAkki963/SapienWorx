package gateway

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
)

const testCredential = "unit-test-provider-credential-not-valid"

func configured() Config {
	c := DefaultConfig()
	c.Enabled = true
	c.APIKey = Secret(testCredential)
	return c
}

func TestAIConfiguration(t *testing.T) {
	for _, tc := range []struct {
		name   string
		values map[string]string
		code   Code
	}{
		{"disabled no key", nil, ""},
		{"enabled missing key", map[string]string{"AI_ENABLED": "true"}, ""},
		{"configured", map[string]string{"AI_ENABLED": "true", "OPENAI_API_KEY": testCredential}, ""},
		{"invalid switch", map[string]string{"AI_ENABLED": "tru"}, ConfigurationError},
		{"invalid timeout", map[string]string{"AI_REQUEST_TIMEOUT_SECONDS": "oops"}, ConfigurationError},
		{"invalid retry", map[string]string{"AI_ENABLED": "true", "OPENAI_API_KEY": testCredential, "AI_MAX_RETRIES": "50"}, ConfigurationError},
		{"invalid model", map[string]string{"AI_ENABLED": "true", "OPENAI_API_KEY": testCredential, "OPENAI_DEFAULT_MODEL": "bad model"}, ConfigurationError},
		{"newline credential", map[string]string{"AI_ENABLED": "true", "OPENAI_API_KEY": testCredential + "\n"}, ConfigurationError},
		{"unbounded concurrency", map[string]string{"AI_ENABLED": "true", "OPENAI_API_KEY": testCredential, "AI_MAX_CONCURRENT_REQUESTS": "0"}, ConfigurationError},
		{"invalid pricing", map[string]string{"AI_MODEL_PRICING_JSON": "not json"}, ConfigurationError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, err := LoadConfig(func(key string) string { return tc.values[key] })
			if tc.code != "" {
				if err == nil || err.Error() != string(tc.code) {
					t.Fatal("expected safe configuration error")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if c.DefaultModel != "gpt-6-luna" || c.RequestTimeout != 20*time.Second {
				t.Fatal("unexpected defaults")
			}
			for _, f := range features {
				if c.Features[f] {
					t.Fatal("downstream AI activated by default")
				}
			}
		})
	}
}

func TestAIConfigurationRoutingAndBounds(t *testing.T) {
	values := map[string]string{"AI_ENABLED": "true", "OPENAI_API_KEY": testCredential, "AI_MODEL_DEFAULT": "alternate-model", "AI_MODEL_CV_PARSER": "parser-model", "AI_MODEL_SEARCH_QUERY": "search-model", "AI_MODEL_FALLBACK": "fallback-model", "AI_MODEL_PRICING_JSON": `{"alternate-model":{"input_usd_per_million":1,"cached_input_usd_per_million":0.2,"output_usd_per_million":2}}`}
	c, err := LoadConfig(func(key string) string { return values[key] })
	if err != nil {
		t.Fatal(err)
	}
	if c.model(CVParser) != "parser-model" || c.model(JobSearchQuery) != "search-model" || c.model(GeneralInternal) != "alternate-model" {
		t.Fatal("model routing failed")
	}
	for _, mutate := range []func(*Config){func(c *Config) { c.RequestTimeout = 0 }, func(c *Config) { c.RequestTimeout = time.Minute }, func(c *Config) { c.MaxRetries = -1 }, func(c *Config) { c.MaxInputChars = 0 }, func(c *Config) { c.MaxOutputTokens = 0 }, func(c *Config) { c.GlobalPerDay = 0 }, func(c *Config) { c.Models[Feature("unregistered")] = "x" }, func(c *Config) { c.Prices["gpt-6-luna"] = Price{InputUSDPerMillion: -1} }} {
		c := configured()
		mutate(&c)
		if c.Validate() == nil {
			t.Fatal("invalid enabled configuration accepted")
		}
	}
}

func TestCredentialFormattingCannotExposeKey(t *testing.T) {
	c := configured()
	raw, _ := json.Marshal(c)
	for _, formatted := range []string{fmt.Sprint(c), fmt.Sprintf("%+v", c), fmt.Sprintf("%#v", c), fmt.Sprintf("%+v", c.APIKey), fmt.Sprintf("%#v", c.APIKey), string(raw)} {
		if strings.Contains(formatted, testCredential) {
			t.Fatal("credential exposed through formatting")
		}
	}
}
