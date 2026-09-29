package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrDisabled = errors.New("AI gateway is disabled by governance")
var ErrProviderUnavailable = errors.New("no governed external AI provider is configured")

type Request struct {
	RequestType string
	PromptKey   string
	ReferenceID string
	Input       map[string]any
}

type Response struct {
	Provider string         `json:"provider"`
	ModelRef string         `json:"model_ref"`
	Output   map[string]any `json:"output"`
}

type Gateway struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Gateway { return &Gateway{db: db} }

func (g *Gateway) Execute(ctx context.Context, request Request) (Response, error) {
	started := time.Now()
	var enabled bool
	if err := g.db.QueryRow(ctx, `SELECT enabled FROM intelligence.engine_switches WHERE switch_key='ai_gateway'`).Scan(&enabled); err != nil {
		return Response{}, err
	}
	if !enabled {
		_ = g.log(ctx, request, "local", "disabled", "disabled", time.Since(started), 0, 0)
		return Response{}, ErrDisabled
	}
	// Provider calls deliberately remain disabled until a provider adapter has
	// explicit secret-manager configuration, data-processing approval and tests.
	_ = g.log(ctx, request, "unconfigured", "none", "failed", time.Since(started), 0, redactionCount(request.Input))
	return Response{}, ErrProviderUnavailable
}

func (g *Gateway) log(ctx context.Context, request Request, provider, modelRef, status string, latency time.Duration, outputChars, redactions int) error {
	inputRaw, _ := json.Marshal(redact(request.Input))
	_, err := g.db.Exec(ctx, `INSERT INTO intelligence.gateway_requests(request_type,provider,model_ref,prompt_key,status,latency_ms,input_chars,output_chars,redaction_count,reference_id) VALUES($1,$2,$3,NULLIF($4,''),$5,$6,$7,$8,$9,NULLIF($10,''))`,
		strings.TrimSpace(request.RequestType), provider, modelRef, strings.TrimSpace(request.PromptKey), status, latency.Milliseconds(), len(inputRaw), outputChars, redactions, strings.TrimSpace(request.ReferenceID))
	return err
}

var sensitiveKey = regexp.MustCompile(`(?i)(email|phone|name|message|content|cv|resume|password|token|secret|private.?key)`)

func redact(input map[string]any) map[string]any {
	out := map[string]any{}
	for key, value := range input {
		if sensitiveKey.MatchString(key) {
			out[key] = "[REDACTED]"
			continue
		}
		switch typed := value.(type) {
		case map[string]any:
			out[key] = redact(typed)
		default:
			out[key] = typed
		}
	}
	return out
}

func redactionCount(input map[string]any) int {
	count := 0
	for key, value := range input {
		if sensitiveKey.MatchString(key) {
			count++
			continue
		}
		if nested, ok := value.(map[string]any); ok {
			count += redactionCount(nested)
		}
	}
	return count
}
