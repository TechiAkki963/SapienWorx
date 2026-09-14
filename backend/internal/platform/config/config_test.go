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
	if cfg.Database.MaxConns != 6 || cfg.Database.MinConns != 0 {
		t.Fatalf("database pool = %d/%d, want 0/6", cfg.Database.MinConns, cfg.Database.MaxConns)
	}
}

func TestValidateRejectsOversizedMicroPool(t *testing.T) {
	cfg := Config{
		Database: DatabaseConfig{URL: "postgres://localhost/sapienworx", MaxConns: 9, MinConns: 0},
		HTTP:     HTTPConfig{MaxBodyBytes: 1024},
		Auth: AuthConfig{
			JWTSecret:         "01234567890123456789012345678901",
			OTPSecret:         "01234567890123456789012345678901",
			AccessTokenTTL:    1,
			RefreshTokenTTL:   1,
			OTPTTL:            1,
			OTPResendInterval: 10,
			AccessCookieName:  "sw_access",
			RefreshCookieName: "sw_refresh",
		},
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected oversized DB pool to be rejected")
	}
}
