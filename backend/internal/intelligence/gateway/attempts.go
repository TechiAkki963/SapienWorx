package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"math/rand/v2"
	"strings"
	"time"
	"unicode/utf8"
)

func (s *Service) generateAttempts(ctx context.Context, request GenerationRequest, scope Scope, limit int64, result GenerationResult, validate func(string) error) (GenerationResult, error) {
	price, known := s.cfg.Prices[result.Model]
	payloadBytes := len(request.Input) + len(request.Instructions)
	if request.Schema != nil {
		payloadBytes += len(request.Schema.JSON)
	}
	providerRequest := ProviderRequest{ServiceTier: request.ServiceTier, ProviderPreference: request.ProviderPreference, Feature: request.Feature, Model: result.Model, Instructions: request.Instructions, Input: request.Input, MaxOutputTokens: limit}
	if request.Schema != nil {
		providerRequest.Schema = &OutputSchema{Name: request.Schema.Name, JSON: append(json.RawMessage(nil), request.Schema.JSON...)}
	}
	result.UsageComplete = true
	for attempt := 1; attempt <= s.cfg.MaxRetries+1; attempt++ {
		if ctx.Err() != nil {
			return result, contextFailure(ctx)
		}
		if attempt > 1 {
			if err := s.options.Gate.Allow(ctx, scope, request.Feature); err != nil {
				return result, normalizeGateError(err)
			}
		}
		var reservation Reservation
		if s.options.Budget != nil {
			var err error
			reservation, err = s.options.Budget.Reserve(ctx, Admission{Scope: scope, Feature: request.Feature, Model: result.Model, MaxInputCharacters: utf8.RuneCountInString(request.Input) + utf8.RuneCountInString(request.Instructions), MaxInputBytes: payloadBytes + 4096, MaxOutputTokens: limit, MaxAttempts: 1, Pricing: price, PricingKnown: known, LogicalCaseID: LogicalCaseFromContext(ctx), AttemptNumber: attempt})
			if err != nil || reservation == nil {
				return result, &Error{Code: BudgetExceeded, Reason: BudgetStop}
			}
		}
		finish := func(usage Usage, cost Cost) {
			if reservation != nil {
				finishCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Second)
				defer cancel()
				reservation.Finish(finishCtx, usage, cost)
			}
		}
		obs := AttemptObservation{LogicalCaseID: LogicalCaseFromContext(ctx), RequestID: scope.RequestID, Task: TaskName(request.Feature), AttemptNumber: attempt, Model: result.Model, PayloadBytes: payloadBytes, EstimatedInputTokens: (payloadBytes+3)/4 + 128, ConfiguredTimeoutMS: s.cfg.AttemptTimeout(request.Feature).Milliseconds(), Status: "pending_before_provider"}
		if s.options.AttemptObserver != nil {
			if err := s.options.AttemptObserver.ObserveAttempt(ctx, obs); err != nil {
				finish(Usage{}, Cost{Known: true, Currency: "USD"})
				return result, &Error{Code: ProviderUnavailable, Reason: TelemetryStop}
			}
		}
		if ctx.Err() != nil {
			finish(Usage{}, Cost{Known: true, Currency: "USD"})
			return result, contextFailure(ctx)
		}
		attemptCtx, cancel := context.WithTimeout(context.WithValue(ctx, attemptKey{}, attempt), s.cfg.AttemptTimeout(request.Feature))
		started := time.Now()
		result.Attempts++
		response, providerErr := s.provider.Generate(attemptCtx, providerRequest)
		obs.ElapsedMS = time.Since(started).Milliseconds()
		var normalized *Error
		if ctx.Err() != nil {
			normalized = contextFailure(ctx)
		} else if attemptCtx.Err() != nil {
			normalized = &Error{Code: Timeout, Reason: ProviderTimeout, Transient: true}
		} else if providerErr != nil {
			if !errors.As(providerErr, &normalized) {
				normalized = failure(UnknownError)
			}
			normalized = safeError(normalized)
		}
		cancel()
		if response.Provider != "" && providerName.MatchString(response.Provider) {
			result.Provider = response.Provider
		}
		usageValid := validUsage(response.Usage)
		if usageValid {
			obs.Usage = response.Usage
			obs.UsageKnown = response.UsageKnown
			addUsage(&result.Usage, response.Usage)
		} else {
			normalized = failure(InvalidResponse)
		}
		result.UsageComplete = result.UsageComplete && obs.UsageKnown
		obs.Cost = estimateCost(obs.Usage, price, known && obs.UsageKnown)
		result.Cost = estimateCost(result.Usage, price, known)
		result.Cost.Known = result.Cost.Known && result.UsageComplete
		if providerRequestID.MatchString(response.RequestID) {
			result.ProviderRequestID = response.RequestID
			obs.ProviderRequestID = response.RequestID
		}
		if normalized == nil {
			if !response.UsageKnown || !resolvedModelMatches(result.Model, response.Model) || response.Status != "completed" || strings.TrimSpace(response.Output) == "" || !utf8.ValidString(response.Output) || len(response.Output) > int(limit)*32 {
				normalized = failure(InvalidResponse)
			} else if validate != nil {
				if err := validate(response.Output); err != nil {
					if !errors.As(err, &normalized) {
						normalized = failure(InvalidResponse)
					}
				}
			}
		}
		// Reconcile this attempt BEFORE a retry can reserve another allowance.
		// Unknown usage consumes the full reservation in both budget implementations.
		finish(obs.Usage, obs.Cost)
		var delay time.Duration
		willRetry := false
		obs.Status = "completed"
		if normalized != nil {
			normalized = safeError(normalized)
			obs.Status = "failed"
			obs.Classification = normalized.Reason
			obs.Retryable = normalized.Transient
			if normalized.Transient && attempt <= s.cfg.MaxRetries && ctx.Err() == nil {
				delay = time.Duration(250*(1<<(attempt-1))) * time.Millisecond
				delay = delay/2 + time.Duration(rand.Int64N(int64(delay/2)+1))
				if normalized.RetryAfter > delay {
					delay = normalized.RetryAfter
				}
				// Never shorten a provider's Retry-After to fit our backoff cap.
				willRetry = delay <= MaxRetryDelay
				if until, ok := ctx.Deadline(); ok && time.Until(until) <= delay {
					willRetry = false
				}
				if willRetry {
					obs.RetryDelayMS = delay.Milliseconds()
				}
			}
		}
		result.AttemptDetails = append(result.AttemptDetails, obs)
		if s.options.AttemptObserver != nil {
			observeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), time.Second)
			err := s.options.AttemptObserver.ObserveAttempt(observeCtx, obs)
			cancel()
			if err != nil {
				return result, &Error{Code: ProviderUnavailable, Reason: TelemetryStop}
			}
		}
		if normalized == nil {
			result.Output = response.Output
			if request.Schema != nil {
				result.Structured = json.RawMessage(response.Output)
			}
			result.ResolvedModel = response.Model
			result.Success = true
			result.Status = "completed"
			return result, nil
		}
		if !willRetry {
			return result, normalized
		}
		if err := s.wait(ctx, delay); err != nil {
			if ctx.Err() != nil {
				return result, contextFailure(ctx)
			}
			return result, &Error{Code: Timeout, Reason: ProviderCancelled}
		}
	}
	return result, failure(UnknownError)
}
