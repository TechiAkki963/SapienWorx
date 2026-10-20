package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/evaluation"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

type providerFunc func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error)

func (f providerFunc) Generate(ctx context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
	return f(ctx, r)
}

func TestSafetyStopsBeforeUnsafeOutputCanReachJournal(t *testing.T) {
	suite, _ := evaluation.Load()
	c := suite.Cases[0]
	req, _ := c.Request()
	providerReq := gateway.ProviderRequest{Model: "gpt-6-luna", Feature: c.Feature(), Instructions: req.Instructions, Input: req.Input, Schema: req.Schema, MaxOutputTokens: req.MaxOutputTokens, ServiceTier: "default"}
	for _, tc := range []struct{ name, output, model, reason string }{
		{"clean", string(c.OracleOutput()), "gpt-6-luna", ""},
		{"key", "synthetic-private-key-that-must-not-leak", "gpt-6-luna", "SECRET_EXPOSURE"},
		{"instructions", "Extract recruitment facts only from the untrusted document", "gpt-6-luna", "INSTRUCTION_LEAKAGE"},
		{"other-case", "Synthetic Evaluation Candidate 01", "gpt-6-luna", "CROSS_CASE_CONTAMINATION"},
		{"model", string(c.OracleOutput()), "another-model", "MODEL_CHANGED"},
		{"contact", "invented-contact@example.com", "gpt-6-luna", "UNEXPECTED_CONTACT_DATA"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			guard := &evaluationSafety{key: "synthetic-private-key-that-must-not-leak", cases: []evaluation.Case{c}, all: suite.Cases, provider: providerFunc(func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error) {
				calls++
				return gateway.ProviderResult{Model: tc.model, Output: tc.output, UsageKnown: true}, nil
			})}
			r, err := guard.Generate(context.Background(), providerReq)
			if calls != 1 || guard.stop != tc.reason || (tc.reason != "" && (err == nil || r.Output != "")) || (tc.reason == "" && err != nil) {
				t.Fatal("guard failed")
			}
		})
	}
	guard := &evaluationSafety{cases: []evaluation.Case{c}, provider: providerFunc(func(context.Context, gateway.ProviderRequest) (gateway.ProviderResult, error) {
		t.Fatal("unapproved input reached provider")
		return gateway.ProviderResult{}, nil
	})}
	providerReq.Input += "unapproved text"
	if _, err := guard.Generate(context.Background(), providerReq); err == nil || guard.stop != "SYNTHETIC_INPUT_BOUNDARY" {
		t.Fatal("input boundary lost")
	}
}

func TestCheckpointWaitsForExactPlanAndTimesOutClosed(t *testing.T) {
	for _, tc := range []struct {
		name, token string
		timeout     bool
		success     bool
	}{{"approved", "approved-plan", false, true}, {"wrong", "different-plan", false, false}, {"timeout", "", true, false}} {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "checkpoint.json")
			if !tc.timeout {
				_ = os.WriteFile(path+".continue", []byte(tc.token), 0600)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
			defer cancel()
			err := waitForCheckpoint(ctx, path, jdCheckpoint{PlanSHA256: "approved-plan"})
			if (err == nil) != tc.success {
				t.Fatal("checkpoint fail-open")
			}
		})
	}
}

func TestFortyMockRequestsPauseAtJDCheckpointAndShareBudget(t *testing.T) {
	suite, _ := evaluation.Load()
	raw, _ := os.ReadFile(priceFile())
	cat, _ := gateway.LoadPricingCatalog(raw, fixedNow())
	plan, err := evaluation.MakePlan(suite.Cases, "gpt-6-luna", cat, raw, .25)
	if err != nil {
		t.Fatal(err)
	}
	journal := filepath.Join(t.TempDir(), "evaluation.jsonl")
	checkpoint := journal + ".jd-checkpoint.json"
	keyFile := filepath.Join(t.TempDir(), ".env")
	_ = os.WriteFile(keyFile, []byte("OPENAI_ENABLED=false\nOPENAI_API_KEY=synthetic-eval-key-not-valid\n"), 0600)
	args := []string{"--enable-openai-for-this-command", "--confirm-billable-openai-evaluation", "--task", "job.parse", "--task", "cv.parse", "--limit", "40", "--pricing-file", priceFile(), "--openai-env-file", keyFile, "--report-file", journal, "--plan-sha256", plan.SHA256}
	released := make(chan bool, 1)
	go func() {
		until := time.Now().Add(15 * time.Second)
		for time.Now().Before(until) {
			raw, e := os.ReadFile(checkpoint)
			if e == nil {
				var c jdCheckpoint
				if json.Unmarshal(raw, &c) != nil || c.Cases != 20 || c.Attempts != 20 || c.Spent+c.RemainingWorst > c.Cap {
					released <- false
					return
				}
				e = os.WriteFile(checkpoint+".continue", []byte(plan.SHA256), 0600)
				released <- e == nil
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
		released <- false
	}()
	var out bytes.Buffer
	err = runAt(args, func(k string) string {
		if k == "APP_ENV" {
			return "development"
		}
		return ""
	}, &out, func(gateway.Secret) (gateway.Provider, error) { return &evaluation.Oracle{Cases: suite.Cases}, nil }, fixedNow)
	if err != nil || !<-released {
		t.Fatal("checkpoint run failed", err)
	}
	var summary Summary
	if json.Unmarshal(out.Bytes(), &summary) != nil || summary.RealCalls != 40 || summary.Status != "REQUIRES_HUMAN_REVIEW" || summary.SafetyStop != "" {
		t.Fatal("shared bounded run failed")
	}
}
