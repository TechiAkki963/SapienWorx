package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"
)

// Feature is a server-owned operation, never a caller-supplied prompt category.
type Feature string

const (
	CVParser             Feature = "cv_parser"
	JDParser             Feature = "job_parser"
	JDGenerator          Feature = "jd_generator"
	CandidateSearchQuery Feature = "candidate_search_query"
	JobSearchQuery       Feature = "job_search_query"
	MatchExplanation     Feature = "match_explanation"
	GeneralInternal      Feature = "general_internal"
)

var features = []Feature{CVParser, JDParser, JDGenerator, CandidateSearchQuery, JobSearchQuery, MatchExplanation, GeneralInternal}

// Scope must be constructed by authorized application code, after RBAC and
// resource ownership checks. It is intentionally not sent to the provider.
type Scope struct {
	RequestID string
	UserID    string
	TenantID  string // Empty for a candidate's own account or local internal smoke.
	Role      string
}

type scopeKey struct{}

func WithScope(ctx context.Context, scope Scope) context.Context {
	return context.WithValue(ctx, scopeKey{}, scope)
}

// ScopeFromContext is for trusted server-side services, never JSON input.
func ScopeFromContext(ctx context.Context) Scope {
	scope, _ := ctx.Value(scopeKey{}).(Scope)
	return scope
}

type OutputSchema struct {
	Name string
	JSON json.RawMessage
}

type GenerationRequest struct {
	ServiceTier        string // Empty preserves provider default; "default" pins Standard pricing.
	ProviderPreference string // Server-owned: empty/auto selects the approved default.
	Feature            Feature
	Model              string
	Instructions       string
	Input              string
	Schema             *OutputSchema
	MaxOutputTokens    int64
	// Optional assertion for a tenant-owned operation. Cannot override Scope.
	TenantID string
}

// ProviderRequest deliberately contains no tenant, user, session or auth data.
type ProviderRequest struct {
	ServiceTier        string
	ProviderPreference string
	Feature            Feature
	Model              string
	Instructions       string
	Input              string
	Schema             *OutputSchema
	MaxOutputTokens    int64
}

type Usage struct {
	InputTokens           int64 `json:"input_tokens"`
	CachedInputTokens     int64 `json:"cached_input_tokens"`
	CacheWriteInputTokens int64 `json:"cache_write_input_tokens"`
	OutputTokens          int64 `json:"output_tokens"`
	TotalTokens           int64 `json:"total_tokens"`
}

type Cost struct {
	PricingVersion     string  `json:"pricing_version,omitempty"`
	InputUSD           float64 `json:"input_usd"`
	CachedInputUSD     float64 `json:"cached_input_usd"`
	CacheWriteInputUSD float64 `json:"cache_write_input_usd"`
	OutputUSD          float64 `json:"output_usd"`
	Known              bool    `json:"known"`
	Currency           string  `json:"currency"`
	EstimatedUSD       float64 `json:"estimated_usd"`
}

type GenerationResult struct {
	AttemptDetails    []AttemptObservation `json:"-"` // Internal metadata, never product response content.
	Success           bool                 `json:"success"`
	Provider          string               `json:"provider"`
	Model             string               `json:"model"`
	ResolvedModel     string               `json:"resolved_model,omitempty"`
	Output            string               `json:"output"`
	Structured        json.RawMessage      `json:"structured,omitempty"`
	Usage             Usage                `json:"usage"`
	UsageComplete     bool                 `json:"usage_complete"`
	Cost              Cost                 `json:"cost"`
	Latency           time.Duration        `json:"-"`
	ProviderRequestID string               `json:"provider_request_id,omitempty"`
	Status            string               `json:"status"`
	Attempts          int                  `json:"attempts"`
}

type ProviderResult struct {
	Provider   string
	Model      string
	Output     string
	Usage      Usage
	UsageKnown bool
	RequestID  string
	Status     string
}

// Provider-specific SDK types must remain inside the adapter package.
type Provider interface {
	Generate(context.Context, ProviderRequest) (ProviderResult, error)
}

type Gate interface {
	Allow(context.Context, Scope, Feature) error
}
type Limiter interface {
	Allow(string) (bool, time.Duration)
}
type LimiterFactory func(int, time.Duration) Limiter

type Admission struct {
	LogicalCaseID      string
	AttemptNumber      int
	Scope              Scope
	Feature            Feature
	Model              string
	MaxInputCharacters int
	MaxInputBytes      int
	MaxOutputTokens    int64
	MaxAttempts        int
	Pricing            Price
	PricingKnown       bool
}

// The gateway reserves and reconciles each provider attempt separately, including
// retries. Unknown usage consumes that attempt's full worst-case reservation.
// A nil Budget adds no monetary cap; it must not be described as a billing limit.
type Budget interface {
	Reserve(context.Context, Admission) (Reservation, error)
}
type Reservation interface {
	Finish(context.Context, Usage, Cost)
}

type Observation struct {
	Reason            Reason
	Feature           Feature
	ActorID           string
	Model             string
	Provider          string
	RequestID         string
	TenantID          string
	ProviderRequestID string
	At                time.Time
	Latency           time.Duration
	Usage             Usage
	Cost              Cost
	Success           bool
	ErrorCode         Code
	ProviderStatus    int
	Attempts          int
}

// Observer receives metadata only. Implementations must be bounded and must not
// turn telemetry failure into a repeated provider request.
type Observer interface {
	Observe(context.Context, Observation)
}

type Health struct {
	State    string `json:"state"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

type Code string

const (
	Disabled               Code = "AI_DISABLED"
	ConfigurationError     Code = "AI_CONFIGURATION_ERROR"
	AuthenticationError    Code = "AI_AUTHENTICATION_ERROR"
	RateLimited            Code = "AI_RATE_LIMITED"
	Timeout                Code = "AI_TIMEOUT"
	ProviderUnavailable    Code = "AI_PROVIDER_UNAVAILABLE"
	InvalidRequest         Code = "AI_INVALID_REQUEST"
	InvalidResponse        Code = "AI_INVALID_RESPONSE"
	SchemaValidationFailed Code = "AI_SCHEMA_VALIDATION_FAILED"
	BudgetExceeded         Code = "AI_BUDGET_EXCEEDED"
	UnknownError           Code = "AI_UNKNOWN_ERROR"
)

// Error never wraps provider payloads, SDK errors, prompts or credentials.
type Error struct {
	Reason         Reason        `json:"-"`
	Code           Code          `json:"code"`
	ProviderStatus int           `json:"-"`
	RetryAfter     time.Duration `json:"-"`
	Transient      bool          `json:"-"`
}

func (e *Error) Error() string                  { return string(e.Code) }
func (e *Error) Format(state fmt.State, _ rune) { _, _ = fmt.Fprint(state, e.Error()) }
func (e *Error) LogValue() slog.Value           { return slog.StringValue(e.Error()) }
func failure(code Code) *Error                  { return &Error{Code: code} }
