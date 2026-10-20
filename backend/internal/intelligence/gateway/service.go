package gateway

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

type Options struct {
	Gate            Gate
	LimiterFactory  LimiterFactory
	Budget          Budget
	AttemptObserver AttemptObserver
	Observer        Observer
}

type Service struct {
	cfg                                                                       Config
	provider                                                                  Provider
	options                                                                   Options
	concurrency                                                               chan struct{}
	globalMinute, globalDay, featureMinute, tenantMinute, userMinute, userDay Limiter
	metrics                                                                   *Metrics
	wait                                                                      func(context.Context, time.Duration) error
	healthMu                                                                  sync.Mutex
	providerState                                                             string
	consecutiveFailures                                                       int
	openUntil                                                                 time.Time
	probe                                                                     bool
}

func NewService(cfg Config, provider Provider, options Options) (*Service, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if cfg.Enabled && (options.Gate == nil || options.LimiterFactory == nil) {
		return nil, failure(ConfigurationError)
	}
	// Freeze mutable caller configuration and discard this copy of the credential.
	copyConfig := cfg
	copyConfig.APIKey = ""
	copyConfig.ArtifactKey = ""
	copyConfig.TaskTimeouts = map[Feature]time.Duration{}
	for f, d := range cfg.TaskTimeouts {
		copyConfig.TaskTimeouts[f] = d
	}
	copyConfig.Models = map[Feature]string{}
	copyConfig.Features = map[Feature]bool{}
	copyConfig.Prices = map[string]Price{}
	for k, v := range cfg.Models {
		copyConfig.Models[k] = v
	}
	for k, v := range cfg.Features {
		copyConfig.Features[k] = v
	}
	for k, v := range cfg.Prices {
		copyConfig.Prices[k] = v
	}
	s := &Service{cfg: copyConfig, provider: provider, options: options, metrics: NewMetrics(), wait: waitContext, providerState: "configured"}
	if cfg.Enabled {
		s.concurrency = make(chan struct{}, cfg.MaxConcurrent)
		f := options.LimiterFactory
		s.globalMinute = f(cfg.GlobalPerMinute, time.Minute)
		s.globalDay = f(cfg.GlobalPerDay, 24*time.Hour)
		s.featureMinute = f(cfg.FeaturePerMinute, time.Minute)
		s.tenantMinute = f(cfg.TenantPerMinute, time.Minute)
		s.userMinute = f(cfg.UserPerMinute, time.Minute)
		s.userDay = f(cfg.UserPerDay, 24*time.Hour)
		if s.globalMinute == nil || s.globalDay == nil || s.featureMinute == nil || s.tenantMinute == nil || s.userMinute == nil || s.userDay == nil {
			return nil, failure(ConfigurationError)
		}
	}
	return s, nil
}

func (s *Service) Health() Health {
	state := "disabled"
	if s.cfg.Enabled {
		s.healthMu.Lock()
		state = s.providerState
		s.healthMu.Unlock()
		if s.provider == nil {
			state = "not_configured"
		}
	}
	return Health{State: state, Provider: "openai", Model: safeModel(s.cfg.DefaultModel)}
}
func (s *Service) Metrics() []Metric { return s.metrics.Snapshot() }

var uuid = regexp.MustCompile(`(?i)^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$`)
var providerRequestID = regexp.MustCompile(`^req_[a-zA-Z0-9_-]{1,100}$`)

func validScope(scope Scope) bool {
	if !uuid.MatchString(scope.UserID) || !uuid.MatchString(scope.RequestID) {
		return false
	}
	if scope.TenantID != "" && !uuid.MatchString(scope.TenantID) {
		return false
	}
	switch scope.Role {
	case "recruiter":
		return scope.TenantID != ""
	case "candidate", "internal":
		return scope.TenantID == ""
	case "master_admin":
		return true
	}
	return false
}

func roleFeature(role string, feature Feature) bool {
	switch feature {
	case GeneralInternal:
		return role == "internal" || role == "master_admin"
	case CVParser, JobSearchQuery:
		return role == "candidate"
	case JDParser, JDGenerator, CandidateSearchQuery:
		return role == "recruiter"
	case MatchExplanation:
		return role == "candidate" || role == "recruiter"
	}
	return false
}

func (s *Service) Generate(ctx context.Context, request GenerationRequest) (result GenerationResult, returned error) {
	started := time.Now()
	scope, _ := ctx.Value(scopeKey{}).(Scope)
	result.Provider = "openai"
	result.Model = safeModel(s.cfg.model(request.Feature))
	result.Status = "failed"
	result.Cost = Cost{Currency: "USD"}
	defer func() {
		result.Latency = time.Since(started)
		obs := Observation{Feature: request.Feature, Provider: result.Provider, Model: result.Model, At: time.Now().UTC(), Latency: result.Latency, Usage: result.Usage, Cost: result.Cost, Success: result.Success, Attempts: result.Attempts, ProviderRequestID: result.ProviderRequestID}
		if !validFeature(obs.Feature) {
			obs.Feature = "unknown"
		}
		if uuid.MatchString(scope.RequestID) {
			obs.RequestID = scope.RequestID
		}
		if uuid.MatchString(scope.TenantID) {
			obs.TenantID = scope.TenantID
		}
		if uuid.MatchString(scope.UserID) {
			obs.ActorID = scope.UserID
		}
		var safe *Error
		if errors.As(returned, &safe) {
			obs.ErrorCode = safe.Code
			obs.Reason = errorReason(safe)
			obs.ProviderStatus = safe.ProviderStatus
		}
		s.metrics.Observe(ctx, obs)
		if s.options.Observer != nil {
			s.options.Observer.Observe(context.WithoutCancel(ctx), obs)
		}
	}()
	if !s.cfg.Enabled || (request.Feature != GeneralInternal && !s.cfg.Features[request.Feature]) {
		return result, failure(Disabled)
	}
	if s.provider == nil {
		return result, failure(ProviderUnavailable)
	}
	ctx, cancel := context.WithTimeout(ctx, s.cfg.OperationTimeout(request.Feature))
	defer cancel()
	if ctx.Err() != nil {
		return result, contextFailure(ctx)
	}
	if !validFeature(request.Feature) || !validScope(scope) || !roleFeature(scope.Role, request.Feature) || request.TenantID != "" && request.TenantID != scope.TenantID {
		return result, failure(InvalidRequest)
	}
	if request.ProviderPreference != "" && request.ProviderPreference != "auto" && request.ProviderPreference != "openai" {
		return result, failure(InvalidRequest)
	}
	if request.ServiceTier != "" && request.ServiceTier != "default" {
		return result, failure(InvalidRequest)
	}
	if request.Model != "" && request.Model != result.Model {
		return result, failure(InvalidRequest)
	}
	if !utf8.ValidString(request.Input) || !utf8.ValidString(request.Instructions) || strings.TrimSpace(request.Input) == "" || len(request.Input)+len(request.Instructions) > s.cfg.MaxInputChars*4 || utf8.RuneCountInString(request.Input)+utf8.RuneCountInString(request.Instructions) > s.cfg.MaxInputChars {
		return result, failure(InvalidRequest)
	}
	limit := request.MaxOutputTokens
	if limit == 0 {
		limit = s.cfg.MaxOutputTokens
	}
	if limit < 16 || limit > s.cfg.MaxOutputTokens {
		return result, failure(InvalidRequest)
	}
	validator, err := compileSchema(request.Schema)
	if err != nil {
		return result, err
	}
	if err = s.options.Gate.Allow(ctx, scope, request.Feature); err != nil {
		return result, normalizeGateError(err)
	}
	// Global bounds run first, bounding identity-map growth in the shared limiter.
	checks := []struct {
		limiter Limiter
		key     string
	}{{s.globalMinute, "ai:minute"}, {s.globalDay, "ai:day"}, {s.featureMinute, "ai:feature:" + string(request.Feature)}, {s.userMinute, "ai:user:" + scope.UserID}, {s.userDay, "ai:userday:" + scope.UserID}}
	if scope.TenantID != "" {
		checks = append(checks, struct {
			limiter Limiter
			key     string
		}{s.tenantMinute, "ai:tenant:" + scope.TenantID})
	}
	for _, check := range checks {
		if allowed, retry := check.limiter.Allow(check.key); !allowed {
			return result, &Error{Code: RateLimited, RetryAfter: retry}
		}
	}
	select {
	case s.concurrency <- struct{}{}:
		defer func() { <-s.concurrency }()
	default:
		return result, &Error{Code: RateLimited, RetryAfter: time.Second}
	}
	if !s.beginProviderCall() {
		return result, failure(ProviderUnavailable)
	}
	defer func() { s.endProviderCall(returned) }()
	var validate func(string) error
	if validator != nil {
		validate = func(output string) error { return validateOutput(validator, output) }
	}
	return s.generateAttempts(ctx, request, scope, limit, result, validate)
}

func resolvedModelMatches(configured, actual string) bool {
	if configured == actual {
		return true
	}
	// An API alias may resolve to its dated snapshot, never another model family.
	suffix := strings.TrimPrefix(actual, configured+"-")
	if suffix == actual {
		return false
	}
	_, err := time.Parse("2006-01-02", suffix)
	return err == nil
}

func normalizeGateError(err error) *Error {
	var e *Error
	if errors.As(err, &e) && e.Code == Disabled {
		return failure(Disabled)
	}
	return failure(ProviderUnavailable)
}
func safeError(e *Error) *Error {
	valid := false
	for _, c := range []Code{Disabled, ConfigurationError, AuthenticationError, RateLimited, Timeout, ProviderUnavailable, InvalidRequest, InvalidResponse, SchemaValidationFailed, BudgetExceeded, UnknownError} {
		valid = valid || c == e.Code
	}
	if !valid {
		return failure(UnknownError)
	}
	r := *e
	r.Reason = errorReason(e)
	r.Transient = e.Transient && (e.Code == RateLimited || e.Code == ProviderUnavailable || e.Code == Timeout)
	if r.Reason != ProviderTimeout && r.Reason != ProviderRateLimited && r.Reason != ProviderConnectionError && r.Reason != ProviderServerError && r.Reason != ProviderNotAvailable {
		r.Transient = false
	}
	if r.ProviderStatus < 100 || r.ProviderStatus > 599 {
		r.ProviderStatus = 0
	}
	if r.RetryAfter < 0 {
		r.RetryAfter = 0
	}
	return &r
}
func validUsage(u Usage) bool {
	// Bound each untrusted counter before adding or subtracting. Otherwise two
	// large cache counters can overflow and produce a valid-looking negative sum.
	return u.InputTokens >= 0 && u.InputTokens <= 10000000 &&
		u.CachedInputTokens >= 0 && u.CachedInputTokens <= u.InputTokens &&
		u.CacheWriteInputTokens >= 0 && u.CacheWriteInputTokens <= u.InputTokens &&
		u.CachedInputTokens+u.CacheWriteInputTokens <= u.InputTokens &&
		u.OutputTokens >= 0 && u.OutputTokens <= 1000000 &&
		u.TotalTokens == u.InputTokens+u.OutputTokens
}
func addUsage(total *Usage, u Usage) {
	total.InputTokens += u.InputTokens
	total.CachedInputTokens += u.CachedInputTokens
	total.CacheWriteInputTokens += u.CacheWriteInputTokens
	total.OutputTokens += u.OutputTokens
	total.TotalTokens += u.TotalTokens
}
func estimateCost(u Usage, p Price, known bool) Cost {
	c := Cost{Known: known, Currency: "USD", PricingVersion: p.Version}
	if known {
		c.InputUSD = float64(u.InputTokens-u.CachedInputTokens-u.CacheWriteInputTokens) * p.InputUSDPerMillion / 1e6
		c.CachedInputUSD = float64(u.CachedInputTokens) * p.CachedInputUSDPerMillion / 1e6
		c.CacheWriteInputUSD = float64(u.CacheWriteInputTokens) * p.CacheWriteInputUSDPerMillion / 1e6
		c.OutputUSD = float64(u.OutputTokens) * p.OutputUSDPerMillion / 1e6
		c.EstimatedUSD = c.InputUSD + c.CachedInputUSD + c.CacheWriteInputUSD + c.OutputUSD
		if u.CacheWriteInputTokens > 0 && p.CacheWriteInputUSDPerMillion == 0 {
			c.Known = false
		}
	}
	return c
}
func waitContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
