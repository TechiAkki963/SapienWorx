package config

import "testing"

func TestValidateRejectsMissingSecrets(t *testing.T) {
	cfg := Config{}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected invalid empty config")
	}
}

func TestLoadUsesEnvironment(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://localhost/sapienworx")
	t.Setenv("JWT_SECRET", "01234567890123456789012345678901")
	t.Setenv("API_PORT", "9090")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.HTTP.Address != ":9090" {
		t.Fatalf("address = %q, want :9090", cfg.HTTP.Address)
	}
}
