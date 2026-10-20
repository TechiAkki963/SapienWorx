package gateway

import (
	"context"
	"log/slog"
	"sort"
	"sync"
)

// Metrics are process-local bounded aggregates, not a durable billing ledger.
type Metric struct {
	Feature               Feature `json:"feature"`
	Model                 string  `json:"model"`
	ProviderAttempts      uint64  `json:"ai_provider_attempts_total"`
	Requests              uint64  `json:"ai_requests_total"`
	Success               uint64  `json:"ai_requests_success_total"`
	Failed                uint64  `json:"ai_requests_failed_total"`
	DurationMS            int64   `json:"ai_request_duration_ms_total"`
	InputTokens           int64   `json:"ai_input_tokens_total"`
	CachedInputTokens     int64   `json:"ai_cached_input_tokens_total"`
	CacheWriteInputTokens int64   `json:"ai_cache_write_input_tokens_total"`
	OutputTokens          int64   `json:"ai_output_tokens_total"`
	EstimatedUSD          float64 `json:"ai_estimated_cost_usd"`
	Unpriced              uint64  `json:"ai_unpriced_requests_total"`
	RateLimited           uint64  `json:"ai_rate_limited_total"`
	Timeouts              uint64  `json:"ai_timeout_total"`
}
type metricKey struct {
	feature Feature
	model   string
}
type Metrics struct {
	mu    sync.Mutex
	items map[metricKey]Metric
}

func NewMetrics() *Metrics { return &Metrics{items: map[metricKey]Metric{}} }
func (m *Metrics) Observe(_ context.Context, o Observation) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := metricKey{o.Feature, o.Model}
	v := m.items[key]
	v.Feature = o.Feature
	v.Model = o.Model
	v.Requests++
	v.ProviderAttempts += uint64(o.Attempts)
	v.DurationMS += o.Latency.Milliseconds()
	if o.Success {
		v.Success++
	} else {
		v.Failed++
	}
	v.InputTokens += o.Usage.InputTokens
	v.CachedInputTokens += o.Usage.CachedInputTokens
	v.CacheWriteInputTokens += o.Usage.CacheWriteInputTokens
	v.OutputTokens += o.Usage.OutputTokens
	v.EstimatedUSD += o.Cost.EstimatedUSD
	if o.Attempts > 0 && !o.Cost.Known {
		v.Unpriced++
	}
	if o.ErrorCode == RateLimited {
		v.RateLimited++
	}
	if o.ErrorCode == Timeout {
		v.Timeouts++
	}
	m.items[key] = v
}
func (m *Metrics) Snapshot() []Metric {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Metric, 0, len(m.items))
	for _, v := range m.items {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Feature != out[j].Feature {
			return out[i].Feature < out[j].Feature
		}
		return out[i].Model < out[j].Model
	})
	return out
}

type LogObserver struct{ Logger *slog.Logger }

// Attempt metadata is supplied by the gateway, not arbitrary provider strings.
// This event contains no prompt, document, response body or credential.
func (l LogObserver) ObserveAttempt(ctx context.Context, a AttemptObservation) error {
	if l.Logger != nil {
		l.Logger.InfoContext(ctx, "ai.provider.attempt", "logical_case_id", a.LogicalCaseID, "request_id", a.RequestID, "task", a.Task, "attempt_number", a.AttemptNumber, "model", a.Model, "payload_bytes", a.PayloadBytes, "estimated_input_tokens", a.EstimatedInputTokens, "configured_timeout_ms", a.ConfiguredTimeoutMS, "elapsed_ms", a.ElapsedMS, "provider_request_id", a.ProviderRequestID, "classification", a.Classification, "retryable", a.Retryable, "retry_delay_ms", a.RetryDelayMS, "status", a.Status, "usage_known", a.UsageKnown, "input_tokens", a.Usage.InputTokens, "cached_input_tokens", a.Usage.CachedInputTokens, "cache_write_input_tokens", a.Usage.CacheWriteInputTokens, "output_tokens", a.Usage.OutputTokens, "total_tokens", a.Usage.TotalTokens, "cost_known", a.Cost.Known, "estimated_cost_usd", a.Cost.EstimatedUSD)
	}
	return nil
}

func (l LogObserver) Observe(ctx context.Context, o Observation) {
	if l.Logger == nil {
		return
	}
	event := "ai.request.completed"
	if !o.Success {
		event = "ai.request.failed"
	}
	l.Logger.InfoContext(ctx, event, "provider", o.Provider, "feature", o.Feature, "model", o.Model, "request_id", o.RequestID, "tenant_id", o.TenantID, "provider_request_id", o.ProviderRequestID, "duration_ms", o.Latency.Milliseconds(), "input_tokens", o.Usage.InputTokens, "cached_input_tokens", o.Usage.CachedInputTokens, "cache_write_input_tokens", o.Usage.CacheWriteInputTokens, "output_tokens", o.Usage.OutputTokens, "total_tokens", o.Usage.TotalTokens, "cost_known", o.Cost.Known, "estimated_cost_usd", o.Cost.EstimatedUSD, "success", o.Success, "error_code", o.ErrorCode, "provider_status", o.ProviderStatus, "attempts", o.Attempts, "internal_reason", o.Reason)
}
