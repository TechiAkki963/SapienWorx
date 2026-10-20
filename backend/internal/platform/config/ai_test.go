package config

import (
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func TestAIStartupWithoutKeyAndHTTPDeadlineCoherence(t *testing.T) {
	cfg := validProductionConfig()
	cfg.AI = gateway.DefaultConfig()
	cfg.AI.Enabled = true
	cfg.HTTP.WriteTimeout = 30 * time.Second
	if err := cfg.Validate(); err != nil {
		t.Fatal("missing provider key must preserve application startup")
	}
	cfg.AI.APIKey = gateway.Secret("unit-test-provider-credential-not-valid")
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	cfg.HTTP.WriteTimeout = time.Second
	if cfg.Validate() == nil {
		t.Fatal("AI may outlive HTTP write deadline")
	}
	cfg.AI.Enabled = false
	cfg.AI.APIKey = ""
	if err := cfg.Validate(); err != nil {
		t.Fatal("disabled AI changed existing startup")
	}
}
