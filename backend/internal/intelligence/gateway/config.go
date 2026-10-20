package gateway

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type Secret string

func (Secret) String() string               { return "[REDACTED]" }
func (Secret) GoString() string             { return "[REDACTED]" }
func (Secret) LogValue() slog.Value         { return slog.StringValue("[REDACTED]") }
func (Secret) MarshalJSON() ([]byte, error) { return []byte(`"[REDACTED]"`), nil }

type Price struct {
	Version                      string  `json:"version,omitempty"`
	InputUSDPerMillion           float64 `json:"input_usd_per_million"`
	CachedInputUSDPerMillion     float64 `json:"cached_input_usd_per_million"`
	CacheWriteInputUSDPerMillion float64 `json:"cache_write_input_usd_per_million"`
	OutputUSDPerMillion          float64 `json:"output_usd_per_million"`
}

type Config struct {
	Enabled                bool
	APIKey                 Secret
	ArtifactKey            Secret // Separate base64-encoded AES-256 key for private proposals.
	DefaultModel           string
	Models                 map[Feature]string
	FallbackModel          string // Reserved configuration; no automatic fallback requests.
	Features               map[Feature]bool
	RequestTimeout         time.Duration
	TaskTimeouts           map[Feature]time.Duration
	MaxRetries             int
	MaxInputChars          int
	MaxOutputTokens        int64
	MaxConcurrent          int
	GlobalPerMinute        int
	FeaturePerMinute       int
	TenantPerMinute        int
	UserPerMinute          int
	GlobalPerDay           int
	UserPerDay             int
	Prices                 map[string]Price
	DailyBudgetUSD         float64
	MonthlyBudgetUSD       float64
	TenantDailyBudgetUSD   float64
	TenantMonthlyBudgetUSD float64
	BudgetAlertFraction    float64
}

var modelName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$`)

func DefaultConfig() Config {
	return Config{DefaultModel: "gpt-6-luna", Models: map[Feature]string{}, Features: map[Feature]bool{},
		RequestTimeout: 20 * time.Second, TaskTimeouts: map[Feature]time.Duration{JDParser: 20 * time.Second, CVParser: 30 * time.Second, JDGenerator: 30 * time.Second}, MaxRetries: 1, MaxInputChars: 32000, MaxOutputTokens: 1024,
		MaxConcurrent: 2, GlobalPerMinute: 30, FeaturePerMinute: 20, TenantPerMinute: 20,
		UserPerMinute: 6, GlobalPerDay: 1000, UserPerDay: 100, Prices: map[string]Price{},
		DailyBudgetUSD: 1, MonthlyBudgetUSD: 10, TenantDailyBudgetUSD: .1, TenantMonthlyBudgetUSD: 2, BudgetAlertFraction: .8}
}

// LoadConfig follows the application's environment-based typed configuration.
// New AI settings are parsed strictly so a typo cannot silently weaken limits.
func LoadConfig(getenv func(string) string) (Config, error) {
	c := DefaultConfig()
	var invalid bool
	boolean := func(key string, fallback bool) bool {
		v := getenv(key)
		if v == "" {
			return fallback
		}
		b, err := strconv.ParseBool(v)
		invalid = invalid || err != nil
		return b
	}
	integer := func(key string, fallback int) int {
		v := getenv(key)
		if v == "" {
			return fallback
		}
		n, err := strconv.Atoi(v)
		invalid = invalid || err != nil
		return n
	}
	// OPENAI_ENABLED is authoritative when present, including an explicit false.
	// Keep the legacy switch only for existing environment-only configurations.
	if getenv("OPENAI_ENABLED") != "" {
		c.Enabled = boolean("OPENAI_ENABLED", false)
	} else {
		c.Enabled = boolean("AI_ENABLED", false)
	}
	c.APIKey = Secret(getenv("OPENAI_API_KEY"))
	c.ArtifactKey = Secret(getenv("AI_ARTIFACT_ENCRYPTION_KEY"))
	if v := getenv("AI_MODEL_DEFAULT"); v != "" {
		c.DefaultModel = v
	}
	if v := getenv("OPENAI_DEFAULT_MODEL"); v != "" {
		c.DefaultModel = v
	}
	c.FallbackModel = getenv("AI_MODEL_FALLBACK")
	for feature, key := range map[Feature]string{CVParser: "AI_MODEL_CV_PARSER", JDGenerator: "AI_MODEL_JD_GENERATOR", CandidateSearchQuery: "AI_MODEL_SEARCH_QUERY", JobSearchQuery: "AI_MODEL_SEARCH_QUERY", MatchExplanation: "AI_MODEL_MATCH_EXPLANATION"} {
		if v := getenv(key); v != "" {
			c.Models[feature] = v
		}
	}
	if v := getenv("OPENAI_PARSER_MODEL"); v != "" {
		c.Models[CVParser], c.Models[JDParser] = v, v
	}
	if v := getenv("OPENAI_GENERATION_MODEL"); v != "" {
		c.Models[JDGenerator] = v
	}
	c.Features[JDParser] = boolean("AI_JOB_PARSER_ENABLED", false)
	c.Features[CVParser] = boolean("AI_CV_PARSER_ENABLED", false)
	c.Features[JDGenerator] = boolean("AI_JD_GENERATOR_ENABLED", false)
	c.Features[CandidateSearchQuery] = boolean("AI_PROMPT_SEARCH_ENABLED", false)
	c.Features[JobSearchQuery] = c.Features[CandidateSearchQuery]
	c.Features[MatchExplanation] = boolean("AI_MATCH_EXPLANATION_ENABLED", false)
	c.RequestTimeout = time.Duration(integer("AI_REQUEST_TIMEOUT_SECONDS", 20)) * time.Second
	c.MaxRetries = integer("AI_MAX_RETRIES", 1)
	for f, key := range map[Feature]string{CVParser: "AI_CV_PARSE_TIMEOUT_SECONDS", JDParser: "AI_JOB_PARSE_TIMEOUT_SECONDS", JDGenerator: "AI_JD_GENERATE_TIMEOUT_SECONDS", CandidateSearchQuery: "AI_SEARCH_PARSE_TIMEOUT_SECONDS", JobSearchQuery: "AI_SEARCH_PARSE_TIMEOUT_SECONDS"} {
		if getenv(key) != "" {
			n := integer(key, 0)
			if n < 1 || n > 120 {
				invalid = true
			} else {
				c.TaskTimeouts[f] = time.Duration(n) * time.Second
			}
		}
	}
	c.MaxInputChars = integer("AI_MAX_INPUT_CHARS", 32000)
	c.MaxOutputTokens = int64(integer("AI_MAX_OUTPUT_TOKENS", 1024))
	c.MaxConcurrent = integer("AI_MAX_CONCURRENT_REQUESTS", 2)
	c.GlobalPerMinute = integer("AI_GLOBAL_REQUESTS_PER_MINUTE", 30)
	c.FeaturePerMinute = integer("AI_FEATURE_REQUESTS_PER_MINUTE", 20)
	c.TenantPerMinute = integer("AI_TENANT_REQUESTS_PER_MINUTE", 20)
	c.UserPerMinute = integer("AI_USER_REQUESTS_PER_MINUTE", 6)
	c.GlobalPerDay = integer("AI_GLOBAL_DAILY_REQUEST_LIMIT", 1000)
	c.UserPerDay = integer("AI_USER_DAILY_REQUEST_LIMIT", 100)
	for key, dest := range map[string]*float64{
		"AI_DAILY_BUDGET_USD": &c.DailyBudgetUSD, "AI_MONTHLY_BUDGET_USD": &c.MonthlyBudgetUSD,
		"AI_TENANT_DAILY_BUDGET_USD": &c.TenantDailyBudgetUSD, "AI_TENANT_MONTHLY_BUDGET_USD": &c.TenantMonthlyBudgetUSD,
		"AI_BUDGET_ALERT_FRACTION": &c.BudgetAlertFraction,
	} {
		if value := getenv(key); value != "" {
			n, err := strconv.ParseFloat(value, 64)
			invalid = invalid || err != nil
			*dest = n
		}
	}
	if raw := getenv("AI_MODEL_PRICING_JSON"); raw != "" {
		if len(raw) > 16384 || json.Unmarshal([]byte(raw), &c.Prices) != nil {
			invalid = true
		}
	}
	if invalid {
		return Config{}, failure(ConfigurationError)
	}
	// Reject accidental credentials in metadata even when generation is disabled.
	for _, m := range append([]string{c.DefaultModel, c.FallbackModel}, modelValues(c.Models)...) {
		if m != "" && (!modelName.MatchString(m) || strings.HasPrefix(m, "sk-") || (c.APIKey != "" && strings.Contains(m, string(c.APIKey)))) {
			return Config{}, failure(ConfigurationError)
		}
	}
	for m := range c.Prices {
		if !modelName.MatchString(m) || strings.HasPrefix(m, "sk-") || (c.APIKey != "" && strings.Contains(m, string(c.APIKey))) {
			return Config{}, failure(ConfigurationError)
		}
		version := c.Prices[m].Version
		if version != "" && (!modelName.MatchString(version) || strings.HasPrefix(version, "sk-") || c.APIKey != "" && strings.Contains(version, string(c.APIKey))) {
			return Config{}, failure(ConfigurationError)
		}
	}
	if err := c.Validate(); err != nil {
		return Config{}, err
	}
	return c, nil
}

func (c Config) Validate() error {
	if !c.Enabled {
		return nil
	} // Existing disabled app needs neither key nor AI configuration.
	if len(c.TaskTimeouts) > len(features) {
		return failure(ConfigurationError)
	}
	for f, d := range c.TaskTimeouts {
		if !validFeature(f) || d < time.Second || d > 120*time.Second {
			return failure(ConfigurationError)
		}
	}
	if len(c.APIKey) > 1024 || strings.ContainsAny(string(c.APIKey), " \t\r\n") || !modelName.MatchString(c.DefaultModel) ||
		c.RequestTimeout < time.Second || c.RequestTimeout > 25*time.Second || c.MaxRetries < 0 || c.MaxRetries > 3 ||
		c.MaxInputChars < 1 || c.MaxInputChars > 200000 || c.MaxOutputTokens < 16 || c.MaxOutputTokens > 8192 || c.MaxConcurrent < 1 || c.MaxConcurrent > 16 {
		return failure(ConfigurationError)
	}
	for _, amount := range []float64{c.DailyBudgetUSD, c.MonthlyBudgetUSD, c.TenantDailyBudgetUSD, c.TenantMonthlyBudgetUSD} {
		if math.IsNaN(amount) || math.IsInf(amount, 0) || amount <= 0 || amount > 10000 {
			return failure(ConfigurationError)
		}
	}
	if math.IsNaN(c.BudgetAlertFraction) || !(c.BudgetAlertFraction > 0 && c.BudgetAlertFraction <= 1) {
		return failure(ConfigurationError)
	}
	for _, v := range []int{c.GlobalPerMinute, c.FeaturePerMinute, c.TenantPerMinute, c.UserPerMinute, c.GlobalPerDay, c.UserPerDay} {
		if v < 1 || v > 100000 {
			return failure(ConfigurationError)
		}
	}
	if len(c.Models) > len(features) || len(c.Prices) > 16 {
		return failure(ConfigurationError)
	}
	for f, m := range c.Models {
		if !validFeature(f) || !modelName.MatchString(m) {
			return failure(ConfigurationError)
		}
	}
	for f := range c.Features {
		if !validFeature(f) {
			return failure(ConfigurationError)
		}
	}
	if c.FallbackModel != "" && !modelName.MatchString(c.FallbackModel) {
		return failure(ConfigurationError)
	}
	for m, p := range c.Prices {
		if !modelName.MatchString(m) {
			return failure(ConfigurationError)
		}
		if p.Version != "" && (!modelName.MatchString(p.Version) || strings.HasPrefix(p.Version, "sk-") || c.APIKey != "" && strings.Contains(p.Version, string(c.APIKey))) {
			return failure(ConfigurationError)
		}
		for _, v := range []float64{p.InputUSDPerMillion, p.CachedInputUSDPerMillion, p.CacheWriteInputUSDPerMillion, p.OutputUSDPerMillion} {
			if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 || v > 100000 {
				return failure(ConfigurationError)
			}
		}
		if p.CachedInputUSDPerMillion > p.InputUSDPerMillion {
			return failure(ConfigurationError)
		}
	}
	return nil
}

func validFeature(f Feature) bool {
	for _, v := range features {
		if f == v {
			return true
		}
	}
	return false
}

func modelValues(models map[Feature]string) []string {
	out := make([]string, 0, len(models))
	for _, value := range models {
		out = append(out, value)
	}
	return out
}
func (c Config) model(f Feature) string {
	if m := c.Models[f]; m != "" {
		return m
	}
	return c.DefaultModel
}

// ModelRoutes returns a copy for trusted governance checks; it contains no keys.
func (c Config) ModelRoutes() map[Feature]string {
	out := map[Feature]string{}
	for _, feature := range features {
		out[feature] = c.model(feature)
	}
	return out
}
func (c Config) String() string {
	return fmt.Sprintf("ai_enabled=%t model=%s", c.Enabled, safeModel(c.DefaultModel))
}
func (c Config) GoString() string     { return c.String() }
func (c Config) LogValue() slog.Value { return slog.StringValue(c.String()) }

// Never serialize the configuration's arbitrary maps or credential material.
func (c Config) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Enabled    bool `json:"enabled"`
		Configured bool `json:"configured"`
	}{c.Enabled, c.APIKey != ""})
}
func safeModel(m string) string {
	if modelName.MatchString(m) && !strings.HasPrefix(m, "sk-") {
		return m
	}
	return "unconfigured"
}
