// ai-replay evaluates captured synthetic responses with no provider, credentials,
// environment loader, database, network or live gateway composition root.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/evaluation"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

func main() {
	if e := run(); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
func run() error {
	casesRaw, e := os.ReadFile("internal/intelligence/parsing/testdata/hardening-v1/cases.json")
	if e != nil {
		return e
	}
	errorsRaw, e := os.ReadFile("internal/intelligence/parsing/testdata/hardening-v1/errors.json")
	if e != nil {
		return e
	}
	var captures []evaluation.CapturedCase
	var regressions []evaluation.Regression
	if json.Unmarshal(casesRaw, &captures) != nil || json.Unmarshal(errorsRaw, &regressions) != nil || len(captures) != 40 || len(regressions) != 185 {
		return fmt.Errorf("invalid fixed capture corpus")
	}
	suite, e := evaluation.Load()
	if e != nil {
		return e
	}
	validator, e := candidate.CanonicalContractValidator()
	if e != nil {
		return e
	}
	results := []evaluation.Replay{}
	for _, c := range suite.Cases {
		found := false
		for _, capture := range captures {
			if capture.ID != c.ID {
				continue
			}
			found = true
			result, err := evaluation.ReplayCaptured(c, capture, regressions, suite.Taxonomy, validator)
			if err != nil {
				return fmt.Errorf("%s: %w", c.ID, err)
			}
			results = append(results, result)
		}
		if !found {
			return fmt.Errorf("missing capture")
		}
	}
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	// Cost planning is arithmetic only. No live evaluation manifest is approved
	// or written by this offline command, and no SDK provider is constructed.
	pricingRaw, e := os.ReadFile("../config/ai-pricing.v1.json")
	if e != nil {
		return e
	}
	pricing, e := gateway.LoadPricingCatalog(pricingRaw, time.Now().UTC())
	if e != nil {
		return e
	}
	selected := []evaluation.Case{}
	for _, id := range []string{"jd-05", "jd-19", "cv-02", "cv-12", "cv-19", "cv-18"} {
		for _, c := range suite.Cases {
			if c.ID == id {
				selected = append(selected, c)
			}
		}
	}
	plan, e := evaluation.MakePlan(selected, "gpt-6-luna", pricing, pricingRaw, .03)
	if e != nil {
		return e
	}
	return encoder.Encode(map[string]any{"kind": "OFFLINE_CAPTURED_REPLAY_NOT_REAL_BASELINE", "version": "parser-hardening-v1", "provider_calls": 0, "results": results, "targeted_retest_proposal": map[string]any{"status": "PROPOSED_NOT_AUTHORIZED_NOT_EXECUTED", "case_ids": plan.IDs, "model": plan.Model, "calls": plan.Requests, "hard_request_cap": len(selected), "hard_cost_cap_usd": .03, "approx_input_tokens": plan.ApproxInputTokens, "approx_output_tokens": plan.ApproxOutputTokens, "input_token_byte_bound": plan.InputTokenByteBound, "maximum_output_tokens": plan.MaxOutputTokens, "estimated_usd": plan.EstimatedUSD, "worst_case_usd": plan.WorstUSD, "prompt_version": plan.PromptVersion, "prompt_sha256": plan.PromptSHA256, "schema_sha256": plan.SchemaSHA256, "dataset_sha256": plan.DatasetSHA256, "pricing_version": plan.PricingVersion, "manifest_hash_for_planning_only": plan.SHA256}})
}
