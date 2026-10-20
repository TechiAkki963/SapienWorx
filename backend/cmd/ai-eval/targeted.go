package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/evaluation"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

type targetedEstimate struct {
	ID                   string  `json:"case_id"`
	Task                 string  `json:"task"`
	InputTokens          int     `json:"estimated_input_tokens"`
	ExpectedOutputTokens int     `json:"estimated_output_tokens"`
	MaxOutputTokens      int64   `json:"max_output_tokens"`
	ExpectedUSD          float64 `json:"estimated_cost_usd"`
	WorstUSD             float64 `json:"conservative_cost_usd"`
}

func estimateSelected(cases []evaluation.Case, price gateway.Price) []targetedEstimate {
	out := []targetedEstimate{}
	for _, c := range cases {
		req, _ := c.Request()
		input := (len(req.Instructions)+len(req.Input)+len(req.Schema.JSON)+3)/4 + 128
		output := (len(c.OracleOutput())+3)/4 + 256
		out = append(out, targetedEstimate{ID: c.ID, Task: c.Task, InputTokens: input, ExpectedOutputTokens: output, MaxOutputTokens: c.OutputLimit(), ExpectedUSD: (float64(input)*price.InputUSDPerMillion + float64(output)*price.OutputUSDPerMillion) / 1e6, WorstUSD: math.Ceil(evaluation.WorstCost(c, price)*1e6) / 1e6})
	}
	return out
}

func sealExactCap(plan evaluation.Plan) evaluation.Plan {
	cfg := gateway.DefaultConfig()
	cfg.MaxRetries = 0
	plan, _ = sealReliabilityPlan(plan, cfg)
	return plan
}
func sealReliabilityPlan(plan evaluation.Plan, cfg gateway.Config) (evaluation.Plan, error) {
	plan.RequestCap = plan.Requests * (1 + cfg.MaxRetries)
	plan.Retries = cfg.MaxRetries
	plan.TaskTimeoutSeconds = map[string]int{}
	plan.OperationTimeoutSeconds = map[string]int{}
	for task, e := range plan.TaskEstimates {
		e.WorstUSD *= float64(1 + cfg.MaxRetries)
		e.MaxOutputTokens *= int64(1 + cfg.MaxRetries)
		plan.TaskEstimates[task] = e
		f := gateway.JDParser
		if task == "cv.parse" {
			f = gateway.CVParser
		}
		plan.TaskTimeoutSeconds[task] = int(cfg.AttemptTimeout(f) / time.Second)
		plan.OperationTimeoutSeconds[task] = int(cfg.OperationTimeout(f) / time.Second)
	}
	plan.TimeoutSeconds = 0
	for _, d := range plan.TaskTimeoutSeconds {
		if d > plan.TimeoutSeconds {
			plan.TimeoutSeconds = d
		}
	}
	plan.WorstUSD *= float64(1 + cfg.MaxRetries)
	plan.MaxOutputTokens *= int64(1 + cfg.MaxRetries)
	if plan.WorstUSD > plan.ApprovedCapUSD || plan.RequestCap > evaluation.HardRequestLimit {
		return plan, fmt.Errorf("retry-inclusive plan exceeds dedicated cap")
	}
	plan.SHA256 = ""
	encoded, _ := json.Marshal(plan)
	sum := sha256.Sum256(encoded)
	plan.SHA256 = hex.EncodeToString(sum[:])
	return plan, nil
}

// Exact selection affects only the manual evaluation command. It cannot expand
// a prefix into extra paid cases, silently reorder IDs, or load arbitrary input.
func selectExact(s evaluation.Suite, ids []string, limit int) ([]evaluation.Case, error) {
	if len(ids) == 0 || len(ids) > 15 || limit != len(ids) {
		return nil, fmt.Errorf("explicit exact-case count required, maximum 15")
	}
	seen := map[string]bool{}
	out := []evaluation.Case{}
	for _, id := range ids {
		if id != strings.TrimSpace(id) || seen[id] {
			return nil, fmt.Errorf("duplicate/ambiguous case selection")
		}
		seen[id] = true
		found := false
		for _, c := range s.Cases {
			if c.ID == id && c.Synthetic {
				out = append(out, c)
				found = true
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("unknown synthetic case")
		}
	}
	return out, nil
}

type stagedEvidence struct {
	SchemaValid    bool               `json:"schema_valid"`
	RawDomainValid bool               `json:"raw_domain_valid"`
	Normalized     json.RawMessage    `json:"normalized_value"`
	Postprocessed  json.RawMessage    `json:"postprocessed_value"`
	Expected       json.RawMessage    `json:"frozen_expected_value"`
	Replay         *evaluation.Replay `json:"production_pipeline"`
	Note           string             `json:"stage_definition"`
}
type stagedRecord struct {
	evaluation.Record
	Stages *stagedEvidence `json:"stages,omitempty"`
}

func captureStages(c evaluation.Case, raw json.RawMessage, tax evaluation.Taxonomy, v *contract.Validator) (*stagedEvidence, error) {
	e := &stagedEvidence{Expected: c.ExpectedOutput, Note: "Normalization = existing whitespace/phone/case/exact skill-alias helpers. Postprocessing = frozen production NormalizeJobProposal/NormalizeCVProposal, including source-label recovery, duplicate projections and employment derivation. No parser change or provider retry."}
	if c.Task == "cv.parse" {
		e.Expected = c.ExpectedProfile
	}
	hash := sha256.Sum256([]byte(c.Text))
	r, err := evaluation.ReplayCaptured(c, evaluation.CapturedCase{ID: c.ID, Task: c.Task, Source: c.Text, SourceSHA256: hex.EncodeToString(hash[:]), Raw: raw}, nil, tax, v)
	e.SchemaValid = r.SchemaValid
	if err != nil {
		return e, fmt.Errorf("staged schema/processing validation failed")
	}
	e.RawDomainValid = evaluation.ValidateOutput(c, raw, v)
	e.Postprocessed = r.Processing.Normalized
	e.Replay = &r
	if c.Task == "cv.parse" {
		var data contract.ProfileData
		if json.Unmarshal(raw, &data) != nil {
			return e, fmt.Errorf("invalid CV structured output")
		}
		mapping := map[string]contract.EntityRef{}
		canon := map[string]contract.EntityRef{}
		for i, name := range tax.Canonical {
			id := fmt.Sprintf("60000000-0000-4000-8000-%012d", i+1)
			ns := "intelligence"
			value := name
			entity := contract.EntityRef{ID: &id, Name: &value, Namespace: &ns}
			mapping[contract.ComparisonKey(name)] = entity
			canon[name] = entity
		}
		for alias, name := range tax.Aliases {
			mapping[contract.ComparisonKey(alias)] = canon[name]
		}
		data = contract.NormalizeData(data)
		data.Skills = contract.NormalizeSkills(data.Skills, mapping)
		e.Normalized, _ = json.Marshal(data)
	} else {
		var fields map[string]json.RawMessage
		_ = json.Unmarshal(raw, &fields)
		var skills []string
		if string(fields["skills"]) != "null" && json.Unmarshal(fields["skills"], &skills) == nil {
			seen := map[string]bool{}
			normalized := []string{}
			mapping := map[string]string{}
			for _, name := range tax.Canonical {
				mapping[contract.ComparisonKey(name)] = name
			}
			for alias, name := range tax.Aliases {
				mapping[contract.ComparisonKey(alias)] = name
			}
			for _, skill := range skills {
				value := strings.TrimSpace(skill)
				if name, ok := mapping[contract.ComparisonKey(value)]; ok {
					value = name
				}
				key := contract.ComparisonKey(value)
				if value != "" && !seen[key] {
					normalized = append(normalized, value)
					seen[key] = true
				}
			}
			fields["skills"], _ = json.Marshal(normalized)
		}
		e.Normalized, _ = json.Marshal(fields)
	}
	if !r.DomainValid || !r.ProfileValid || r.Score.InjectionViolation {
		return e, fmt.Errorf("postprocessing canonical/security validation failed")
	}
	return e, nil
}
