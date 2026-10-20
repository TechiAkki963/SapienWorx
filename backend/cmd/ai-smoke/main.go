// ai-smoke is a local-only, explicit, potentially billable connectivity check.
// It accepts no prompts, files, tenant identities or provider endpoint overrides.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway/openaiadapter"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/httpserver"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/localenv"
)

func main() {
	if err := run(os.Args[1:], os.Getenv, os.Stdout, func(key gateway.Secret) (gateway.Provider, error) { return openaiadapter.New(key) }); err != nil {
		fmt.Fprintln(os.Stderr, "FAIL:", err)
		os.Exit(1)
	}
}

type providerFactory func(gateway.Secret) (gateway.Provider, error)
type smokeGate struct{}

func (smokeGate) Allow(_ context.Context, s gateway.Scope, f gateway.Feature) error {
	if s.Role != "internal" || f != gateway.GeneralInternal {
		return &gateway.Error{Code: gateway.Disabled}
	}
	return nil
}

func run(args []string, getenv func(string) string, out io.Writer, newProvider providerFactory) error {
	flags := flag.NewFlagSet("ai-smoke", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	confirm := flags.Bool("confirm-billable-openai-test", false, "make one local synthetic OpenAI test (may incur a charge)")
	enable := flags.Bool("enable-openai-for-this-command", false, "override disabled configuration inside this command only")
	envFile := flags.String("openai-env-file", "", "explicit backend-only local credential file")
	if flags.Parse(args) != nil || flags.NArg() != 0 {
		return &gateway.Error{Code: gateway.InvalidRequest}
	}
	lookup, err := localenv.Lookup(getenv, *envFile)
	if err != nil {
		return &gateway.Error{Code: gateway.ConfigurationError}
	}
	cfg, err := gateway.LoadConfig(lookup)
	if err != nil {
		return err
	}
	if !*confirm || !*enable {
		state := "disabled"
		if cfg.Enabled && cfg.APIKey != "" {
			state = "configured"
		} else if cfg.Enabled {
			state = "not_configured"
		}
		return json.NewEncoder(out).Encode(gateway.Health{State: state, Provider: "openai", Model: cfg.DefaultModel})
	}
	// No implicit default environment: beta/production and unspecified are denied.
	if getenv("APP_ENV") != "development" || getenv("CI") != "" || getenv("GITHUB_ACTIONS") != "" {
		return &gateway.Error{Code: gateway.Disabled}
	}
	if cfg.APIKey == "" {
		return &gateway.Error{Code: gateway.ConfigurationError}
	}
	// Explicit override is local to this value; no file or process env is changed.
	cfg.Enabled = true
	// One attempt only. The regular gateway's input/rate/timeout/schema guards apply.
	cfg.MaxRetries = 0
	p, err := newProvider(cfg.APIKey)
	if err != nil {
		return &gateway.Error{Code: gateway.ConfigurationError}
	}
	service, err := gateway.NewService(cfg, p, gateway.Options{Gate: smokeGate{}, LimiterFactory: func(n int, w time.Duration) gateway.Limiter { return httpserver.NewIPRateLimiter(n, w) }})
	if err != nil {
		return err
	}
	ctx := gateway.WithScope(context.Background(), gateway.Scope{RequestID: "10000000-0000-4000-8000-000000000001", UserID: "20000000-0000-4000-8000-000000000001", Role: "internal"})
	result, err := service.Generate(ctx, gateway.GenerationRequest{Feature: gateway.GeneralInternal, Instructions: "Return exactly: OK. No other content.", Input: "Return exactly: OK", MaxOutputTokens: 128})
	status := "FAIL"
	if err == nil && result.Output != "OK" {
		err = &gateway.Error{Code: gateway.InvalidResponse}
	}
	if err == nil {
		status = "PASS"
	}
	// No complete prompts/provider responses/credentials are printed.
	if json.NewEncoder(out).Encode(struct {
		Status            string        `json:"status"`
		Success           bool          `json:"success"`
		Provider          string        `json:"provider"`
		Model             string        `json:"model"`
		ResolvedModel     string        `json:"resolved_model,omitempty"`
		LatencyMS         float64       `json:"latency_ms"`
		ProviderRequestID string        `json:"provider_request_id"`
		Attempts          int           `json:"attempts"`
		Usage             gateway.Usage `json:"usage"`
		Cost              gateway.Cost  `json:"cost"`
	}{status, err == nil, result.Provider, result.Model, result.ResolvedModel, float64(result.Latency) / float64(time.Millisecond), result.ProviderRequestID, result.Attempts, result.Usage, result.Cost}) != nil {
		return &gateway.Error{Code: gateway.UnknownError}
	}
	return err
}
