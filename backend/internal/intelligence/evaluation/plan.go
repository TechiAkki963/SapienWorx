package evaluation

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sort"
)
import "github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
import "github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/parsing"

const HardRequestLimit = 40
const HardCostUSD = .25

type TaskEstimate struct {
	Requests            int     `json:"requests"`
	ApproxInputTokens   int     `json:"approx_input_tokens"`
	InputTokenByteBound int     `json:"input_token_byte_bound"`
	ApproxOutputTokens  int64   `json:"approx_output_tokens"`
	MaxOutputTokens     int64   `json:"maximum_output_tokens"`
	EstimatedUSD        float64 `json:"estimated_usd"`
	WorstUSD            float64 `json:"worst_case_usd"`
}
type Plan struct {
	TaskTimeoutSeconds      map[string]int          `json:"task_timeout_seconds,omitempty"`
	OperationTimeoutSeconds map[string]int          `json:"operation_timeout_seconds,omitempty"`
	PromptVersion           string                  `json:"prompt_version"`
	PromptSHA256            string                  `json:"prompt_sha256"`
	SchemaSHA256            map[string]string       `json:"schema_sha256"`
	DatasetVersion          string                  `json:"dataset_version"`
	DatasetSHA256           string                  `json:"dataset_sha256"`
	Model                   string                  `json:"model"`
	PricingVersion          string                  `json:"pricing_version"`
	PricingSHA256           string                  `json:"pricing_sha256"`
	ServiceTier             string                  `json:"service_tier"`
	Requests                int                     `json:"requests"`
	TaskEstimates           map[string]TaskEstimate `json:"tasks"`
	ApproxInputTokens       int                     `json:"approx_input_tokens"`
	InputTokenByteBound     int                     `json:"input_token_byte_bound"`
	ApproxOutputTokens      int64                   `json:"approx_output_tokens"`
	MaxOutputTokens         int64                   `json:"maximum_output_tokens"`
	EstimatedUSD            float64                 `json:"estimated_total_usd"`
	WorstUSD                float64                 `json:"worst_case_total_usd"`
	ApprovedCapUSD          float64                 `json:"cost_cap_usd"`
	RequestCap              int                     `json:"hard_request_cap"`
	TimeoutSeconds          int                     `json:"timeout_seconds"`
	Retries                 int                     `json:"retries"`
	Concurrency             int                     `json:"concurrency"`
	IDs                     []string                `json:"case_ids"`
	SHA256                  string                  `json:"plan_sha256"`
}

func Digest() string {
	hash := sha256.New()
	files, _ := corpus.ReadDir("testdata")
	for _, file := range files {
		raw, _ := corpus.ReadFile("testdata/" + file.Name())
		hash.Write([]byte(file.Name()))
		hash.Write(raw)
	}
	return hex.EncodeToString(hash.Sum(nil))
}
func Select(s Suite, tasks []string, limit int) ([]Case, error) {
	if limit < 1 || limit > HardRequestLimit || len(tasks) < 1 || len(tasks) > 2 {
		return nil, fmt.Errorf("explicit bounded task/limit required")
	}
	seen := map[string]bool{}
	for _, task := range tasks {
		if task != "job.parse" && task != "cv.parse" || seen[task] {
			return nil, fmt.Errorf("invalid evaluation task")
		}
		seen[task] = true
	}
	cases := []Case{}
	for _, c := range s.Cases {
		if seen[c.Task] {
			cases = append(cases, c)
		}
	}
	if limit > len(cases) {
		return nil, fmt.Errorf("limit exceeds fixed corpus")
	}
	return cases[:limit], nil
}
func InputBytes(c Case) int {
	r, _ := c.Request()
	return len(r.Input) + len(r.Instructions) + len(r.Schema.JSON) + 4096
}
func WorstCost(c Case, p gateway.Price) float64 {
	rate := math.Max(p.InputUSDPerMillion*1.25, math.Max(p.CachedInputUSDPerMillion, p.CacheWriteInputUSDPerMillion))
	return (float64(InputBytes(c))*rate + float64(c.OutputLimit())*p.OutputUSDPerMillion) / 1e6
}
func MakePlan(cases []Case, model string, catalog gateway.PricingCatalog, pricingRaw []byte, capUSD float64) (Plan, error) {
	p := Plan{DatasetVersion: Version, DatasetSHA256: Digest(), Model: model, PricingVersion: catalog.Version, ServiceTier: catalog.ServiceTier, TaskEstimates: map[string]TaskEstimate{}, ApprovedCapUSD: capUSD, RequestCap: HardRequestLimit, TimeoutSeconds: 20, Concurrency: 1}
	p.PromptVersion = parsing.PromptVersion
	promptHash := sha256.Sum256([]byte(Instructions))
	p.PromptSHA256 = hex.EncodeToString(promptHash[:])
	p.SchemaSHA256 = map[string]string{}
	if len(cases) < 1 || len(cases) > HardRequestLimit || math.IsNaN(capUSD) || capUSD <= 0 || capUSD > HardCostUSD {
		return p, fmt.Errorf("invalid evaluation bounds")
	}
	price, ok := catalog.Models[model]
	if !ok {
		return p, fmt.Errorf("configured parser model has no reviewed price")
	}
	hash := sha256.Sum256(pricingRaw)
	p.PricingSHA256 = hex.EncodeToString(hash[:])
	for _, c := range cases {
		schema, _ := c.Schema()
		schemaHash := sha256.Sum256(schema.JSON)
		p.SchemaSHA256[c.Task] = hex.EncodeToString(schemaHash[:])
		input := InputBytes(c)
		if input > catalog.MaxInputTokens {
			return p, fmt.Errorf("context pricing band exceeded")
		}
		r, _ := c.Request()
		approx := (len(r.Instructions)+len(r.Input)+len(r.Schema.JSON)+3)/4 + 128
		output := int64((len(c.OracleOutput())+3)/4 + 256)
		if output > c.OutputLimit() {
			return p, fmt.Errorf("expected fixture exceeds output cap")
		}
		e := p.TaskEstimates[c.Task]
		e.Requests++
		e.ApproxInputTokens += approx
		e.InputTokenByteBound += input
		e.ApproxOutputTokens += output
		e.MaxOutputTokens += c.OutputLimit()
		e.EstimatedUSD += (float64(approx)*price.InputUSDPerMillion + float64(output)*price.OutputUSDPerMillion) / 1e6
		e.WorstUSD += math.Ceil(WorstCost(c, price)*1e6) / 1e6
		p.TaskEstimates[c.Task] = e
		p.IDs = append(p.IDs, c.ID)
	}
	for _, e := range p.TaskEstimates {
		p.Requests += e.Requests
		p.ApproxInputTokens += e.ApproxInputTokens
		p.InputTokenByteBound += e.InputTokenByteBound
		p.ApproxOutputTokens += e.ApproxOutputTokens
		p.MaxOutputTokens += e.MaxOutputTokens
		p.EstimatedUSD += e.EstimatedUSD
		p.WorstUSD += e.WorstUSD
	}
	// Round each reservation up to micro-USD exactly as the command's budget does.
	p.WorstUSD = 0
	for _, c := range cases {
		p.WorstUSD += math.Ceil(WorstCost(c, price)*1e6) / 1e6
	}
	if p.WorstUSD > capUSD {
		return p, fmt.Errorf("worst-case estimate exceeds explicit cost cap")
	}
	encoded, _ := json.Marshal(p)
	sum := sha256.Sum256(encoded)
	p.SHA256 = hex.EncodeToString(sum[:])
	return p, nil
}
func Industries(cases []Case) []string {
	m := map[string]bool{}
	for _, c := range cases {
		m[c.Industry] = true
	}
	out := []string{}
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
