package gateway

import "log/slog"

// Protect common diagnostic paths as well as the explicit safe observer.
// Authorized business results still carry output as JSON; never log that JSON.
func (r GenerationRequest) String() string       { return "AI request [content withheld]" }
func (r GenerationRequest) GoString() string     { return r.String() }
func (r GenerationRequest) LogValue() slog.Value { return slog.StringValue(r.String()) }
func (r ProviderRequest) String() string         { return "AI provider request [content withheld]" }
func (r ProviderRequest) GoString() string       { return r.String() }
func (r ProviderRequest) LogValue() slog.Value   { return slog.StringValue(r.String()) }
func (r GenerationResult) String() string        { return "AI result [content withheld]" }
func (r GenerationResult) GoString() string      { return r.String() }
func (r GenerationResult) LogValue() slog.Value  { return slog.StringValue(r.String()) }
func (s *Service) String() string                { return "AI Gateway [configuration and content withheld]" }
func (s *Service) GoString() string              { return s.String() }
func (s *Service) LogValue() slog.Value          { return slog.StringValue(s.String()) }
