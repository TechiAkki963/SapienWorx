// Package modelbaseline verifies bundled synthetic evaluation evidence. It never
// calls a provider, changes a switch, or promotes a model.
package modelbaseline

import (
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
)

//go:embed jd-generator-v11.json
var evidence []byte

var ErrUnsupported = errors.New("no reviewed baseline supports this internal model configuration")

type Evidence struct {
	BaselineRef      string `json:"baseline_ref"`
	SourceSHA256     string `json:"source_sha256"`
	Model            string `json:"model"`
	Task             string `json:"task"`
	TaskVersion      string `json:"task_version"`
	PromptVersion    string `json:"prompt_version"`
	SchemaVersion    string `json:"schema_version"`
	BlueprintVersion string `json:"blueprint_version"`
	Cases            int    `json:"cases_completed"`
	Successes        int    `json:"provider_successes"`
	Failures         int    `json:"provider_failures"`
	AutomatedPasses  int    `json:"automated_passes"`
	Usable           int    `json:"usable_cases"`
	MaterialFailures int    `json:"material_failures"`
	QualityGate      bool   `json:"beta_quality_gate_pass"`
}

type Evaluation struct {
	DatasetRef string
	Metrics    map[string]any
}

func ReadEvidence() (Evidence, error) {
	var e Evidence
	if json.Unmarshal(evidence, &e) != nil || e.BaselineRef != "jd-generation-v1.1" || e.Model != "gpt-6-luna" || e.Task != "job.generate_description" || len(e.SourceSHA256) != 64 || e.Cases != 8 || e.Successes != 8 || e.Failures != 0 || e.AutomatedPasses != 8 || e.Usable != 8 || e.MaterialFailures != 0 || !e.QualityGate {
		return Evidence{}, ErrUnsupported
	}
	return e, nil
}

// Evaluate supports only the exact preserved JD-generation baseline and a
// bounded internal actor cohort. It does not assert independent human quality
// acceptance; promotion still needs its own two-reviewer approval and switch.
func Evaluate(engine, provider, model string, config map[string]any) (Evaluation, error) {
	e, err := ReadEvidence()
	if err != nil || engine != "ai_gateway" || provider != "openai" || model != e.Model {
		return Evaluation{}, ErrUnsupported
	}
	var policy struct {
		Baseline string            `json:"evaluation_baseline"`
		Tasks    []string          `json:"approved_tasks"`
		Routes   map[string]string `json:"model_routes"`
		Rollout  struct {
			Stage      string   `json:"stage"`
			Actors     []string `json:"actor_ids"`
			Tenants    []string `json:"tenant_ids"`
			Percentage float64  `json:"percentage"`
		} `json:"beta_rollout"`
	}
	raw, err := json.Marshal(config)
	if err != nil || json.Unmarshal(raw, &policy) != nil || policy.Baseline != e.BaselineRef || len(policy.Tasks) != 1 || policy.Tasks[0] != e.Task || len(policy.Routes) != 1 || policy.Routes[e.Task] != e.Model || policy.Rollout.Stage != "internal" || len(policy.Rollout.Actors) < 1 || len(policy.Rollout.Actors) > 10 || len(policy.Rollout.Tenants) != 0 || policy.Rollout.Percentage != 0 {
		return Evaluation{}, ErrUnsupported
	}
	uuid := regexp.MustCompile(`(?i)^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$`)
	seen := map[string]bool{}
	for _, actor := range policy.Rollout.Actors {
		if !uuid.MatchString(actor) || actor == "00000000-0000-0000-0000-000000000000" || seen[actor] {
			return Evaluation{}, ErrUnsupported
		}
		seen[actor] = true
	}
	h := sha256.Sum256(evidence)
	return Evaluation{DatasetRef: "bundled:" + e.BaselineRef + ":" + e.SourceSHA256, Metrics: map[string]any{
		"quality_metric": "preserved_synthetic_jd_generation_baseline", "baseline_ref": e.BaselineRef,
		"source_sha256": e.SourceSHA256, "evidence_sha256": hex.EncodeToString(h[:]), "model": e.Model,
		"task": e.Task, "task_version": e.TaskVersion, "prompt_version": e.PromptVersion, "schema_version": e.SchemaVersion,
		"blueprint_version": e.BlueprintVersion, "cases": e.Cases, "usable_cases": e.Usable,
		"provider_failures": e.Failures, "material_failures": e.MaterialFailures,
		"internal_actor_count": len(policy.Rollout.Actors), "new_provider_calls": 0,
		"independent_human_acceptance": "required_separately", "autonomous_promotion": false,
		"limitation": "Eight synthetic role cases only; no real-tenant or production-readiness claim.",
	}}, nil
}
