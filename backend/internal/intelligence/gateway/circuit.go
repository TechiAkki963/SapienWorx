package gateway

import (
	"context"
	"errors"
	"time"
)

func (s *Service) beginProviderCall() bool {
	s.healthMu.Lock()
	defer s.healthMu.Unlock()
	if time.Now().Before(s.openUntil) || s.probe {
		return false
	}
	if !s.openUntil.IsZero() {
		s.probe = true
	}
	return true
}
func (s *Service) endProviderCall(err error) {
	s.healthMu.Lock()
	defer s.healthMu.Unlock()
	s.probe = false
	var e *Error
	if err == nil {
		s.providerState = "healthy"
		s.consecutiveFailures = 0
		s.openUntil = time.Time{}
		return
	}
	if !errors.As(err, &e) {
		return
	}
	if errorReason(e) == ProviderCancelled || errorReason(e) == TelemetryStop {
		return
	}
	switch e.Code {
	case ProviderUnavailable, Timeout, AuthenticationError, InvalidResponse, SchemaValidationFailed, RateLimited:
		s.consecutiveFailures++
		s.providerState = "degraded"
		if e.Code == AuthenticationError || s.consecutiveFailures >= 3 {
			s.openUntil = time.Now().Add(30 * time.Second)
			s.providerState = "unavailable"
		}
	}
}

// Authorize guards cache admission as well as paid calls. Product services must
// still prove resource ownership before constructing Scope.
func (s *Service) Authorize(ctx context.Context, feature Feature) error {
	scope := ScopeFromContext(ctx)
	if !validScope(scope) || !roleFeature(scope.Role, feature) {
		return failure(InvalidRequest)
	}
	if !s.cfg.Enabled || !s.cfg.Features[feature] {
		return failure(Disabled)
	}
	if s.provider == nil {
		return failure(ProviderUnavailable)
	}
	if s.options.Gate == nil {
		return failure(Disabled)
	}
	return normalizeAuthorization(s.options.Gate.Allow(ctx, scope, feature))
}
func normalizeAuthorization(err error) error {
	if err == nil {
		return nil
	}
	return normalizeGateError(err)
}

// ModelFor returns only the configured model name, never credentials.
func (s *Service) ModelFor(feature Feature) string { return s.cfg.model(feature) }
