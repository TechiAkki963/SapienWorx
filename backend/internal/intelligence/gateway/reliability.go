package gateway

import (
	"context"
	"errors"
	"time"
)

// Closed internal vocabulary. Public Error formatting/JSON still exposes Code only.
type Reason string

const (
	ProviderTimeout          Reason = "provider_timeout"
	ProviderRateLimited      Reason = "provider_rate_limited"
	ProviderAuthFailure      Reason = "provider_auth_failure"
	ProviderBadRequest       Reason = "provider_bad_request"
	ProviderServerError      Reason = "provider_server_error"
	ProviderConnectionError  Reason = "provider_connection_error"
	ProviderSchemaError      Reason = "provider_schema_error"
	ProviderCancelled        Reason = "provider_cancelled"
	ProviderNotAvailable     Reason = "provider_unavailable"
	ProviderInvalidResponse  Reason = "provider_invalid_response"
	ProviderSecurityRejected Reason = "provider_security_rejected"
	BudgetStop               Reason = "BUDGET_STOP"
	TelemetryStop            Reason = "telemetry_stop"
	ProviderUnknown          Reason = "provider_unknown"
)

func errorReason(e *Error) Reason {
	switch e.Reason {
	case ProviderTimeout, ProviderRateLimited, ProviderAuthFailure, ProviderBadRequest, ProviderServerError, ProviderConnectionError, ProviderSchemaError, ProviderCancelled, ProviderNotAvailable, ProviderInvalidResponse, ProviderSecurityRejected, BudgetStop, TelemetryStop, ProviderUnknown:
		return e.Reason
	}
	switch e.Code {
	case Timeout:
		return ProviderTimeout
	case RateLimited:
		return ProviderRateLimited
	case AuthenticationError:
		return ProviderAuthFailure
	case InvalidRequest, ConfigurationError:
		return ProviderBadRequest
	case SchemaValidationFailed:
		return ProviderSchemaError
	case InvalidResponse:
		return ProviderInvalidResponse
	case Disabled:
		return ProviderSecurityRejected
	case BudgetExceeded:
		return BudgetStop
	case ProviderUnavailable:
		return ProviderNotAvailable
	default:
		return ProviderUnknown
	}
}

func contextFailure(ctx context.Context) *Error {
	if errors.Is(ctx.Err(), context.Canceled) {
		return &Error{Code: Timeout, Reason: ProviderCancelled}
	}
	return &Error{Code: Timeout, Reason: ProviderTimeout}
}

func TaskName(f Feature) string {
	switch f {
	case JDParser:
		return "job.parse"
	case CVParser:
		return "cv.parse"
	case JDGenerator:
		return "job.generate_description"
	case CandidateSearchQuery, JobSearchQuery:
		return "search.parse_query"
	default:
		return string(f)
	}
}

type caseKey struct{}
type attemptKey struct{}

// This label is local to the fixed synthetic evaluator, never sent to OpenAI.
func WithLogicalCase(ctx context.Context, id string) context.Context {
	if len(id) != 5 || (id[:3] != "cv-" && id[:3] != "jd-") || id[3] < '0' || id[3] > '9' || id[4] < '0' || id[4] > '9' {
		return ctx
	}
	return context.WithValue(ctx, caseKey{}, id)
}
func LogicalCaseFromContext(ctx context.Context) string {
	id, _ := ctx.Value(caseKey{}).(string)
	return id
}
func AttemptNumberFromContext(ctx context.Context) int {
	n, _ := ctx.Value(attemptKey{}).(int)
	return n
}

type AttemptObservation struct {
	LogicalCaseID        string `json:"logical_case_id,omitempty"`
	RequestID            string `json:"request_id"`
	Task                 string `json:"task"`
	AttemptNumber        int    `json:"attempt_number"`
	Model                string `json:"model"`
	PayloadBytes         int    `json:"payload_bytes"` // instructions + input + schema, excluding JSON envelope
	EstimatedInputTokens int    `json:"estimated_input_tokens"`
	ConfiguredTimeoutMS  int64  `json:"configured_timeout_ms"`
	ElapsedMS            int64  `json:"elapsed_ms"`
	ProviderRequestID    string `json:"provider_request_id,omitempty"`
	Classification       Reason `json:"classification"`
	Retryable            bool   `json:"retryable"`
	RetryDelayMS         int64  `json:"retry_delay_ms"`
	Status               string `json:"status"`
	Usage                Usage  `json:"usage"`
	UsageKnown           bool   `json:"usage_known"`
	Cost                 Cost   `json:"cost"`
}

// A failed pending/completion journal write stops further paid attempts.
type AttemptObserver interface {
	ObserveAttempt(context.Context, AttemptObservation) error
}
type AttemptObserverFunc func(context.Context, AttemptObservation) error

func (f AttemptObserverFunc) ObserveAttempt(ctx context.Context, a AttemptObservation) error {
	return f(ctx, a)
}

const MaxRetryDelay = 5 * time.Second

// Task overrides are per-attempt; the operation also bounds retries and backoff.
// Unmeasured tasks inherit the existing total RequestTimeout, not invented SLOs.
func (c Config) AttemptTimeout(f Feature) time.Duration {
	if d := c.TaskTimeouts[f]; d != 0 {
		return d
	}
	return c.RequestTimeout
}
func (c Config) OperationTimeout(f Feature) time.Duration {
	if d := c.TaskTimeouts[f]; d != 0 {
		return time.Duration(c.MaxRetries+1)*d + time.Duration(c.MaxRetries)*MaxRetryDelay
	}
	return c.RequestTimeout
}
func (c Config) MaxOperationTimeout() time.Duration {
	d := c.RequestTimeout
	for f, enabled := range c.Features {
		if enabled && c.OperationTimeout(f) > d {
			d = c.OperationTimeout(f)
		}
	}
	return d
}
