package config

import (
	"testing"
	"time"
)

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
			AccessTokenTTL:    15 * time.Minute,
			RefreshTokenTTL:   24 * time.Hour,
			OTPTTL:            10 * time.Minute,
			OTPResendInterval: 60 * time.Second,
			AccessCookieName:  "sw_access",
			RefreshCookieName: "sw_refresh",
		},
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected oversized DB pool to be rejected")
	}
}

func validProductionConfig() Config {
	return Config{
		Environment: "production",
		Database: DatabaseConfig{
			URL:      "postgres://db.example/sapienworx?sslmode=require",
			MaxConns: 6,
			MinConns: 0,
		},
		HTTP: HTTPConfig{
			MaxBodyBytes:   2 << 20,
			AllowedOrigins:    []string{"https://app.sapienworx.com"},
			TrustedProxyCIDRs: []string{"10.0.0.0/8"},
		},
		Auth: AuthConfig{
			JWTSecret:         "01234567890123456789012345678901",
			OTPSecret:         "abcdefghijklmnopqrstuvwxyzABCDEF",
			AccessTokenTTL:    15 * time.Minute,
			RefreshTokenTTL:   30 * 24 * time.Hour,
			OTPTTL:            10 * time.Minute,
			OTPResendInterval: 60 * time.Second,
			OTPIPLimit:        8,
			OTPIPWindow:       10 * time.Minute,
			LoginIPLimit:      12,
			LoginIPWindow:     5 * time.Minute,
			CookieSecure:      true,
			AccessCookieName:  "sw_access",
			RefreshCookieName: "sw_refresh",
		},
		AWS: AWSConfig{S3PresignTTL: 5 * time.Minute},
	}
}

func TestValidateProductionSecurityBaseline(t *testing.T) {
	cfg := validProductionConfig()
	if err := cfg.Validate(); err != nil {
		t.Fatalf("valid production config rejected: %v", err)
	}
}

func TestValidateRejectsInsecureProductionSettings(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*Config)
	}{
		{name: "insecure cookie", mutate: func(cfg *Config) { cfg.Auth.CookieSecure = false }},
		{name: "shared auth secrets", mutate: func(cfg *Config) { cfg.Auth.OTPSecret = cfg.Auth.JWTSecret }},
		{name: "http cors origin", mutate: func(cfg *Config) { cfg.HTTP.AllowedOrigins = []string{"http://app.sapienworx.com"} }},
		{name: "database tls disabled", mutate: func(cfg *Config) { cfg.Database.URL = "postgres://db.example/sapienworx?sslmode=disable" }},
		{name: "invalid trusted proxy", mutate: func(cfg *Config) { cfg.HTTP.TrustedProxyCIDRs = []string{"not-a-cidr"} }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cfg := validProductionConfig()
			test.mutate(&cfg)
			if err := cfg.Validate(); err == nil {
				t.Fatal("expected insecure production config to be rejected")
			}
		})
	}
}
