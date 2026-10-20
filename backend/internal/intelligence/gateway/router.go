package gateway

import (
	"context"
	"regexp"
)

var providerName = regexp.MustCompile(`^[a-z][a-z0-9_]{0,31}$`)

type providerRouter struct {
	primary   string
	providers map[string]Provider
}

// NewProviderRouter registers already-constructed server-side adapters. No SDK,
// provider credential or future provider implementation is introduced here.
func NewProviderRouter(primary string, providers map[string]Provider) (Provider, error) {
	if !providerName.MatchString(primary) {
		return nil, failure(ConfigurationError)
	}
	copy := map[string]Provider{}
	for name, p := range providers {
		if !providerName.MatchString(name) {
			return nil, failure(ConfigurationError)
		}
		if p != nil {
			copy[name] = p
		}
	}
	if copy[primary] == nil {
		return nil, nil
	}
	return &providerRouter{primary, copy}, nil
}
func (r *providerRouter) Generate(ctx context.Context, req ProviderRequest) (ProviderResult, error) {
	name := req.ProviderPreference
	if name == "" || name == "auto" {
		name = r.primary
	}
	if !providerName.MatchString(name) {
		return ProviderResult{}, failure(InvalidRequest)
	}
	p := r.providers[name]
	if p == nil {
		return ProviderResult{}, failure(ProviderUnavailable)
	}
	result, err := p.Generate(ctx, req)
	result.Provider = name
	return result, err
}
