package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment string
	HTTP        HTTPConfig
	Database    DatabaseConfig
	Auth        AuthConfig
}

type HTTPConfig struct {
	Address           string
	ReadTimeout       time.Duration
	ReadHeaderTimeout time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration
	ShutdownTimeout   time.Duration
	AllowedOrigins    []string
	MaxBodyBytes      int64
}

type DatabaseConfig struct {
	URL             string
	MaxConns        int32
	MinConns        int32
	MaxConnLifetime time.Duration
	MaxConnIdleTime time.Duration
	HealthTimeout   time.Duration
}

type AuthConfig struct {
	Issuer         string
	Audience       string
	JWTSecret      string
	AccessTokenTTL time.Duration
	ClockSkew      time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Environment: env("APP_ENV", "development"),
		HTTP: HTTPConfig{
			Address:           ":" + env("API_PORT", "8080"),
			ReadTimeout:       durationEnv("HTTP_READ_TIMEOUT", 15*time.Second),
			ReadHeaderTimeout: durationEnv("HTTP_READ_HEADER_TIMEOUT", 5*time.Second),
			WriteTimeout:      durationEnv("HTTP_WRITE_TIMEOUT", 30*time.Second),
			IdleTimeout:       durationEnv("HTTP_IDLE_TIMEOUT", 60*time.Second),
			ShutdownTimeout:   durationEnv("HTTP_SHUTDOWN_TIMEOUT", 15*time.Second),
			AllowedOrigins:    csvEnv("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000"}),
			MaxBodyBytes:      int64Env("HTTP_MAX_BODY_BYTES", 2<<20),
		},
		Database: DatabaseConfig{
			URL:             strings.TrimSpace(os.Getenv("DATABASE_URL")),
			MaxConns:        int32Env("DB_MAX_CONNS", 10),
			MinConns:        int32Env("DB_MIN_CONNS", 1),
			MaxConnLifetime: durationEnv("DB_MAX_CONN_LIFETIME", 30*time.Minute),
			MaxConnIdleTime: durationEnv("DB_MAX_CONN_IDLE_TIME", 5*time.Minute),
			HealthTimeout:   durationEnv("DB_HEALTH_TIMEOUT", 2*time.Second),
		},
		Auth: AuthConfig{
			Issuer:         env("JWT_ISSUER", "sapienworx-api"),
			Audience:       env("JWT_AUDIENCE", "sapienworx-web"),
			JWTSecret:      strings.TrimSpace(os.Getenv("JWT_SECRET")),
			AccessTokenTTL: durationEnv("JWT_ACCESS_TOKEN_TTL", 15*time.Minute),
			ClockSkew:      durationEnv("JWT_CLOCK_SKEW", 30*time.Second),
		},
	}

	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (c Config) Validate() error {
	var problems []string
	if c.Database.URL == "" {
		problems = append(problems, "DATABASE_URL is required")
	}
	if len(c.Auth.JWTSecret) < 32 {
		problems = append(problems, "JWT_SECRET must be at least 32 bytes")
	}
	if c.Database.MinConns < 0 || c.Database.MaxConns < 1 || c.Database.MinConns > c.Database.MaxConns {
		problems = append(problems, "database pool bounds are invalid")
	}
	if c.HTTP.MaxBodyBytes < 1024 {
		problems = append(problems, "HTTP_MAX_BODY_BYTES must be at least 1024")
	}
	if c.Auth.AccessTokenTTL <= 0 {
		problems = append(problems, "JWT_ACCESS_TOKEN_TTL must be positive")
	}
	if len(problems) > 0 {
		return errors.New(strings.Join(problems, "; "))
	}
	return nil
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func csvEnv(key string, fallback []string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if item := strings.TrimSpace(part); item != "" {
			result = append(result, item)
		}
	}
	if len(result) == 0 {
		return fallback
	}
	return result
}

func int64Env(key string, fallback int64) int64 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func int32Env(key string, fallback int32) int32 {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 32)
	if err != nil {
		return fallback
	}
	return int32(parsed)
}

func (c Config) String() string {
	return fmt.Sprintf("env=%s http=%s db_pool=%d/%d", c.Environment, c.HTTP.Address, c.Database.MinConns, c.Database.MaxConns)
}
