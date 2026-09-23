package config

import (
	"errors"
	"fmt"
	"net/netip"
	"net/url"
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
	AWS         AWSConfig
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
	TrustedProxyCIDRs []string
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
	Issuer               string
	Audience             string
	JWTSecret            string
	AccessTokenTTL       time.Duration
	RefreshTokenTTL      time.Duration
	ClockSkew            time.Duration
	OTPSecret            string
	OTPTTL               time.Duration
	OTPResendInterval    time.Duration
	OTPIPLimit           int
	OTPIPWindow          time.Duration
	LoginIPLimit         int
	LoginIPWindow        time.Duration
	ApplicationIPLimit   int
	ApplicationIPWindow  time.Duration
	ApplicationUserLimit int
	CookieDomain         string
	CookieSecure         bool
	AccessCookieName     string
	RefreshCookieName    string
}

type AWSConfig struct {
	Region       string
	S3Bucket     string
	S3PresignTTL time.Duration
}

func Load() (Config, error) {
	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	otpSecret := strings.TrimSpace(os.Getenv("AUTH_OTP_HMAC_SECRET"))
	if otpSecret == "" {
		otpSecret = jwtSecret
	}
	environment := env("APP_ENV", "development")
	cfg := Config{
		Environment: environment,
		HTTP: HTTPConfig{
			Address:           ":" + env("API_PORT", "8080"),
			ReadTimeout:       durationEnv("HTTP_READ_TIMEOUT", 15*time.Second),
			ReadHeaderTimeout: durationEnv("HTTP_READ_HEADER_TIMEOUT", 5*time.Second),
			WriteTimeout:      durationEnv("HTTP_WRITE_TIMEOUT", 30*time.Second),
			IdleTimeout:       durationEnv("HTTP_IDLE_TIMEOUT", 60*time.Second),
			ShutdownTimeout:   durationEnv("HTTP_SHUTDOWN_TIMEOUT", 15*time.Second),
			AllowedOrigins:    csvEnv("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000"}),
			MaxBodyBytes:      int64Env("HTTP_MAX_BODY_BYTES", 2<<20),
			TrustedProxyCIDRs: csvEnv("HTTP_TRUSTED_PROXY_CIDRS", nil),
		},
		Database: DatabaseConfig{
			URL:             strings.TrimSpace(os.Getenv("DATABASE_URL")),
			MaxConns:        int32Env("DB_MAX_CONNS", 6),
			MinConns:        int32Env("DB_MIN_CONNS", 0),
			MaxConnLifetime: durationEnv("DB_MAX_CONN_LIFETIME", 20*time.Minute),
			MaxConnIdleTime: durationEnv("DB_MAX_CONN_IDLE_TIME", 2*time.Minute),
			HealthTimeout:   durationEnv("DB_HEALTH_TIMEOUT", 2*time.Second),
		},
		Auth: AuthConfig{
			Issuer:               env("JWT_ISSUER", "sapienworx-api"),
			Audience:             env("JWT_AUDIENCE", "sapienworx-web"),
			JWTSecret:            jwtSecret,
			AccessTokenTTL:       durationEnv("JWT_ACCESS_TOKEN_TTL", 15*time.Minute),
			RefreshTokenTTL:      durationEnv("AUTH_REFRESH_TOKEN_TTL", 30*24*time.Hour),
			ClockSkew:            durationEnv("JWT_CLOCK_SKEW", 30*time.Second),
			OTPSecret:            otpSecret,
			OTPTTL:               durationEnv("AUTH_OTP_TTL", 10*time.Minute),
			OTPResendInterval:    durationEnv("AUTH_OTP_RESEND_INTERVAL", 60*time.Second),
			OTPIPLimit:           intEnv("AUTH_OTP_IP_LIMIT", 8),
			OTPIPWindow:          durationEnv("AUTH_OTP_IP_WINDOW", 10*time.Minute),
			LoginIPLimit:         intEnv("AUTH_LOGIN_IP_LIMIT", 12),
			LoginIPWindow:        durationEnv("AUTH_LOGIN_IP_WINDOW", 5*time.Minute),
			ApplicationIPLimit:   intEnv("AUTH_APPLICATION_IP_LIMIT", 60),
			ApplicationIPWindow:  durationEnv("AUTH_APPLICATION_IP_WINDOW", 5*time.Minute),
			ApplicationUserLimit: intEnv("AUTH_APPLICATION_USER_LIMIT", 12),
			CookieDomain:         strings.TrimSpace(os.Getenv("AUTH_COOKIE_DOMAIN")),
			CookieSecure:         boolEnv("AUTH_COOKIE_SECURE", environment == "production"),
			AccessCookieName:     env("AUTH_ACCESS_COOKIE_NAME", "sw_access"),
			RefreshCookieName:    env("AUTH_REFRESH_COOKIE_NAME", "sw_refresh"),
		},
		AWS: AWSConfig{
			Region:       env("AWS_REGION", "ap-south-1"),
			S3Bucket:     strings.TrimSpace(os.Getenv("S3_BUCKET")),
			S3PresignTTL: durationEnv("S3_PRESIGN_TTL", 5*time.Minute),
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
	if len(c.Auth.OTPSecret) < 32 {
		problems = append(problems, "AUTH_OTP_HMAC_SECRET must be at least 32 bytes or inherit a valid JWT_SECRET")
	}
	if c.Database.MinConns < 0 || c.Database.MaxConns < 1 || c.Database.MinConns > c.Database.MaxConns {
		problems = append(problems, "database pool bounds are invalid")
	}
	if c.Database.MaxConns > 8 {
		problems = append(problems, "DB_MAX_CONNS must not exceed 8 on the micro-instance deployment profile")
	}
	if c.Database.MinConns > 2 {
		problems = append(problems, "DB_MIN_CONNS must not exceed 2 on the micro-instance deployment profile")
	}
	if c.HTTP.MaxBodyBytes < 1024 {
		problems = append(problems, "HTTP_MAX_BODY_BYTES must be at least 1024")
	}
	for _, cidr := range c.HTTP.TrustedProxyCIDRs {
		if _, err := netip.ParsePrefix(strings.TrimSpace(cidr)); err != nil {
			problems = append(problems, "HTTP_TRUSTED_PROXY_CIDRS must contain only valid CIDR prefixes")
			break
		}
	}
	if c.Auth.AccessTokenTTL <= 0 || c.Auth.RefreshTokenTTL <= 0 || c.Auth.OTPTTL <= 0 {
		problems = append(problems, "authentication token lifetimes must be positive")
	}
	if c.Auth.OTPResendInterval < 10*time.Second {
		problems = append(problems, "AUTH_OTP_RESEND_INTERVAL must be at least 10 seconds")
	}
	if c.Auth.ApplicationIPLimit < 1 || c.Auth.ApplicationUserLimit < 1 || c.Auth.ApplicationIPWindow < time.Minute {
		problems = append(problems, "application rate-limit settings are invalid")
	}
	if c.Auth.OTPIPLimit < 1 || c.Auth.OTPIPWindow < time.Minute || c.Auth.LoginIPLimit < 1 || c.Auth.LoginIPWindow < time.Minute {
		problems = append(problems, "authentication rate-limit settings are invalid")
	}
	if c.Auth.AccessCookieName == "" || c.Auth.RefreshCookieName == "" {
		problems = append(problems, "authentication cookie names are required")
	}
	if c.AWS.S3PresignTTL < time.Minute || c.AWS.S3PresignTTL > 15*time.Minute {
		problems = append(problems, "S3_PRESIGN_TTL must be between 1m and 15m")
	}
	if strings.EqualFold(strings.TrimSpace(c.Environment), "production") {
		if !c.Auth.CookieSecure {
			problems = append(problems, "AUTH_COOKIE_SECURE must be true in production")
		}
		if c.Auth.JWTSecret == c.Auth.OTPSecret {
			problems = append(problems, "AUTH_OTP_HMAC_SECRET must be distinct from JWT_SECRET in production")
		}
		for _, origin := range c.HTTP.AllowedOrigins {
			parsed, err := url.Parse(strings.TrimSpace(origin))
			if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
				problems = append(problems, "CORS_ALLOWED_ORIGINS must contain only valid https origins in production")
				break
			}
		}
		if parsed, err := url.Parse(c.Database.URL); err == nil && strings.EqualFold(parsed.Query().Get("sslmode"), "disable") {
			problems = append(problems, "DATABASE_URL must not disable TLS in production")
		}
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

func intEnv(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func boolEnv(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func (c Config) String() string {
	return fmt.Sprintf("env=%s http=%s db_pool=%d/%d s3=%t", c.Environment, c.HTTP.Address, c.Database.MinConns, c.Database.MaxConns, c.AWS.S3Bucket != "")
}
