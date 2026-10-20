// Package openaiadapter is the only SapienWorx package that imports the OpenAI
// SDK. It uses stateless text Responses, with no tools, files or conversations.
package openaiadapter

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/responses"
)

const endpoint = "https://api.openai.com/v1/"
const maxResponseBytes = 2 << 20

type Provider struct {
	client openai.Client
	secret gateway.Secret
}

func (*Provider) String() string         { return "OpenAI provider [credentials withheld]" }
func (p *Provider) GoString() string     { return p.String() }
func (p *Provider) LogValue() slog.Value { return slog.StringValue(p.String()) }

func New(key gateway.Secret) (*Provider, error) {
	if len(key) == 0 {
		return nil, &gateway.Error{Code: gateway.ConfigurationError}
	}
	return newProvider(key, newHTTPClient()), nil
}

func newHTTPClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.MaxConnsPerHost = 16
	transport.MaxIdleConnsPerHost = 4
	// The gateway owns a bounded per-task attempt context, including headers/body.
	// A shorter independent header timeout previously cut CV calls off at 15s.
	transport.ResponseHeaderTimeout = 0
	transport.TLSHandshakeTimeout = 5 * time.Second
	transport.DialContext = (&net.Dialer{Timeout: 5 * time.Second, KeepAlive: 30 * time.Second}).DialContext
	return &http.Client{Transport: boundedTransport{transport}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}

func newProvider(key gateway.Secret, client *http.Client) *Provider {
	return &Provider{secret: key, client: openai.NewClient(option.WithAPIKey(string(key)), option.WithBaseURL(endpoint), option.WithOrganization(""), option.WithProject(""), option.WithHTTPClient(client), option.WithMaxRetries(0))}
}

type boundedTransport struct{ base http.RoundTripper }

func (t boundedTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	// Environment OPENAI_BASE_URL and redirects cannot send the key elsewhere.
	if request.URL.Scheme != "https" || request.URL.Host != "api.openai.com" || request.URL.Path != "/v1/responses" {
		return nil, &gateway.Error{Code: gateway.ConfigurationError}
	}
	response, err := t.base.RoundTrip(request)
	if response != nil && response.Body != nil {
		response.Body = http.MaxBytesReader(nil, response.Body, maxResponseBytes)
	}
	return response, err
}

func (p *Provider) Generate(ctx context.Context, input gateway.ProviderRequest) (gateway.ProviderResult, error) {
	params := responses.ResponseNewParams{Model: input.Model, Store: openai.Bool(false), Background: openai.Bool(false), Instructions: openai.String(input.Instructions), MaxOutputTokens: openai.Int(input.MaxOutputTokens),
		Input: responses.ResponseNewParamsInputUnion{OfInputItemList: []responses.ResponseInputItemUnionParam{responses.ResponseInputItemParamOfMessage(input.Input, responses.EasyInputMessageRoleUser)}}}
	if input.ServiceTier == "default" {
		params.ServiceTier = responses.ResponseNewParamsServiceTierDefault
	} else if input.ServiceTier != "" {
		return gateway.ProviderResult{}, &gateway.Error{Code: gateway.InvalidRequest}
	}
	if input.Schema != nil {
		var schema map[string]any
		if json.Unmarshal(input.Schema.JSON, &schema) != nil {
			return gateway.ProviderResult{}, &gateway.Error{Code: gateway.InvalidRequest}
		}
		params.Text = responses.ResponseTextConfigParam{Format: responses.ResponseFormatTextConfigUnionParam{OfJSONSchema: &responses.ResponseFormatTextJSONSchemaConfigParam{Name: input.Schema.Name, Schema: schema, Strict: openai.Bool(true)}}}
	}
	var raw *http.Response
	response, err := p.client.Responses.New(ctx, params, option.WithResponseInto(&raw))
	result := gateway.ProviderResult{}
	if raw != nil {
		result.RequestID = raw.Header.Get("x-request-id")
		if p.secret != "" && strings.Contains(result.RequestID, string(p.secret)) {
			result.RequestID = ""
		}
	}
	if err != nil {
		return result, normalizeError(ctx, err, raw)
	}
	if response == nil {
		return result, &gateway.Error{Code: gateway.InvalidResponse, Reason: gateway.ProviderInvalidResponse}
	}
	result.Model = response.Model
	result.Status = string(response.Status)
	result.Usage = gateway.Usage{InputTokens: response.Usage.InputTokens, CachedInputTokens: response.Usage.InputTokensDetails.CachedTokens, CacheWriteInputTokens: response.Usage.InputTokensDetails.CacheWriteTokens, OutputTokens: response.Usage.OutputTokens, TotalTokens: response.Usage.TotalTokens}
	if !response.JSON.Usage.Valid() {
		return result, &gateway.Error{Code: gateway.InvalidResponse, Reason: gateway.ProviderInvalidResponse}
	}
	result.UsageKnown = true
	if input.ServiceTier == "default" && response.ServiceTier != responses.ResponseServiceTierDefault {
		result.UsageKnown = false // Actual tier is not covered by the admitted price.
		return result, &gateway.Error{Code: gateway.InvalidResponse, Reason: gateway.ProviderInvalidResponse}
	}
	if response.Status != "completed" || response.Error.Code != "" {
		return result, &gateway.Error{Code: gateway.InvalidResponse, Reason: gateway.ProviderInvalidResponse}
	}
	for _, item := range response.Output {
		if item.Type == "reasoning" {
			continue
		}
		if item.Type != "message" || item.Status != "completed" {
			return result, &gateway.Error{Code: gateway.InvalidResponse, Reason: gateway.ProviderInvalidResponse}
		}
		for _, content := range item.Content {
			if content.Type != "output_text" {
				return result, &gateway.Error{Code: gateway.InvalidResponse, Reason: gateway.ProviderInvalidResponse}
			}
		}
	}
	result.Output = response.OutputText()
	return result, nil
}

func normalizeError(ctx context.Context, err error, response *http.Response) *gateway.Error {
	if errors.Is(ctx.Err(), context.Canceled) || errors.Is(err, context.Canceled) {
		return &gateway.Error{Code: gateway.Timeout, Reason: gateway.ProviderCancelled}
	}
	if ctx.Err() != nil || errors.Is(err, context.DeadlineExceeded) {
		return &gateway.Error{Code: gateway.Timeout, Reason: gateway.ProviderTimeout, Transient: ctx.Err() == nil}
	}
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return &gateway.Error{Code: gateway.InvalidResponse, Reason: gateway.ProviderInvalidResponse}
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return &gateway.Error{Code: gateway.ProviderUnavailable, Reason: gateway.ProviderConnectionError, Transient: true}
	}
	var apiError *openai.Error
	if errors.As(err, &apiError) {
		status := apiError.StatusCode
		e := &gateway.Error{Code: gateway.UnknownError, ProviderStatus: status}
		switch {
		case status == 401 || status == 403:
			e.Code = gateway.AuthenticationError
			e.Reason = gateway.ProviderAuthFailure
		case status == 429:
			e.Code = gateway.RateLimited
			e.Reason = gateway.ProviderRateLimited
			e.Transient = true
			if apiError.Code == "insufficient_quota" || apiError.Code == "billing_hard_limit_reached" {
				e.Code = gateway.BudgetExceeded
				e.Reason = gateway.BudgetStop
				e.Transient = false
			}
		case status == 408:
			e.Code = gateway.Timeout
			e.Reason = gateway.ProviderTimeout
			e.Transient = true
		case status >= 500:
			e.Code = gateway.ProviderUnavailable
			e.Reason = gateway.ProviderServerError
			e.Transient = status == 500 || status == 502 || status == 503 || status == 504
		case status >= 400 && status < 500:
			e.Code = gateway.InvalidRequest
			e.Reason = gateway.ProviderBadRequest
			if strings.HasPrefix(apiError.Param, "text.format") {
				e.Reason = gateway.ProviderSchemaError
			}
		}
		if response != nil {
			e.RetryAfter = retryHeaders(response.Header)
		}
		return e
	}
	var network net.Error
	if errors.As(err, &network) {
		if network.Timeout() {
			return &gateway.Error{Code: gateway.Timeout, Reason: gateway.ProviderTimeout, Transient: true}
		}
		return &gateway.Error{Code: gateway.ProviderUnavailable, Reason: gateway.ProviderConnectionError, Transient: true}
	}
	var safe *gateway.Error
	if errors.As(err, &safe) {
		return &gateway.Error{Code: safe.Code, Reason: safe.Reason}
	}
	return &gateway.Error{Code: gateway.InvalidResponse, Reason: gateway.ProviderInvalidResponse}
}

func retryHeaders(h http.Header) time.Duration {
	delay := retryAfter(h.Get("Retry-After"))
	if ms, err := strconv.ParseFloat(h.Get("retry-after-ms"), 64); err == nil && ms >= 0 && !math.IsNaN(ms) {
		if ms > 86400000 {
			ms = 86400000
		}
		if d := time.Duration(ms * float64(time.Millisecond)); d > delay {
			delay = d
		}
	}
	return delay
}
func retryAfter(value string) time.Duration {
	seconds, err := strconv.ParseFloat(value, 64)
	if (err == nil || math.IsInf(seconds, 1)) && seconds >= 0 && !math.IsNaN(seconds) {
		if seconds >= 86400 {
			return 24 * time.Hour
		}
		return time.Duration(seconds * float64(time.Second))
	}
	if when, err := http.ParseTime(value); err == nil {
		delay := time.Until(when)
		if delay > 24*time.Hour {
			return 24 * time.Hour
		}
		if delay > 0 {
			return delay
		}
	}
	return 0
}
