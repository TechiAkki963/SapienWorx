package config

import "testing"

func validBetaConfig() Config {
	c := validProductionConfig()
	c.Environment = "beta"
	c.Auth.CookieDomain = ""
	c.Auth.Issuer = "sapienworx-beta-api"
	c.Auth.Audience = "sapienworx-beta-web"
	c.HTTP.AllowedOrigins = []string{"https://beta.sapienworx.com"}
	c.Database.URL = "postgres://sapienworx_app:isolated@db.example/sapienworx_beta?sslmode=require"
	c.AWS.S3Bucket = "sapienworx-beta-documents-123456789012-ap-south-1"
	return c
}

func TestBetaRejectsProductionConfiguration(t *testing.T) {
	if err := validBetaConfig().Validate(); err != nil {
		t.Fatal(err)
	}
	for name, mutate := range map[string]func(*Config){
		"insecure cookie":     func(c *Config) { c.Auth.CookieSecure = false },
		"parent domain":       func(c *Config) { c.Auth.CookieDomain = "sapienworx.com" },
		"issuer":              func(c *Config) { c.Auth.Issuer = "sapienworx-api" },
		"audience":            func(c *Config) { c.Auth.Audience = "sapienworx-web" },
		"production origin":   func(c *Config) { c.HTTP.AllowedOrigins = []string{"https://sapienworx.com"} },
		"mixed origins":       func(c *Config) { c.HTTP.AllowedOrigins = append(c.HTTP.AllowedOrigins, "https://sapienworx.com") },
		"production database": func(c *Config) { c.Database.URL = "postgres://db.example/sapienworx?sslmode=require" },
		"implicit TLS":        func(c *Config) { c.Database.URL = "postgres://db.example/sapienworx_beta" },
		"TLS disabled":        func(c *Config) { c.Database.URL = "postgres://db.example/sapienworx_beta?sslmode=disable" },
		"host override":       func(c *Config) { c.Database.URL += "&host=production.example" },
		"database override":   func(c *Config) { c.Database.URL += "&dbname=sapienworx" },
		"production bucket":   func(c *Config) { c.AWS.S3Bucket = "sapienworx-production-documents-123456789012-ap-south-1" },
		"reused secret":       func(c *Config) { c.Auth.OTPSecret = c.Auth.JWTSecret },
	} {
		t.Run(name, func(t *testing.T) {
			c := validBetaConfig()
			mutate(&c)
			if err := c.Validate(); err == nil {
				t.Fatal("unsafe beta configuration accepted")
			}
		})
	}
}
