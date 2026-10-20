package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/evaluation"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

var retestIDs = []string{"jd-05", "jd-19", "cv-02", "cv-12", "cv-19", "cv-18"}

func TestExactCaseSelectionIsClosedAndOrdered(t *testing.T) {
	s, _ := evaluation.Load()
	cases, e := selectExact(s, retestIDs, 6)
	if e != nil {
		t.Fatal(e)
	}
	for i, c := range cases {
		if c.ID != retestIDs[i] {
			t.Fatal("case reordered or expanded")
		}
	}
	tooMany := []string{}
	for _, c := range s.Cases[:16] {
		tooMany = append(tooMany, c.ID)
	}
	for _, tc := range []struct {
		ids   []string
		limit int
	}{{nil, 0}, {[]string{"jd-05", "jd-05"}, 2}, {[]string{"foreign"}, 1}, {[]string{" jd-05"}, 1}, {retestIDs, 7}, {tooMany, 16}} {
		if _, e := selectExact(s, tc.ids, tc.limit); e == nil {
			t.Fatal("unsafe exact selection")
		}
	}
	for _, args := range [][]string{
		{"--dry-run", "--case-id", "jd-05", "--task", "job.parse", "--limit", "1"},
		{"--enable-openai-for-this-command", "--confirm-billable-openai-evaluation", "--case-id", "jd-05", "--limit", "1", "--report-file", "unused", "--plan-sha256", "unused"},
	} {
		if e := runAt(args, func(k string) string {
			if k == "APP_ENV" {
				return "development"
			}
			if k == "OPENAI_API_KEY" {
				t.Fatal("early guard loaded key")
			}
			return ""
		}, &bytes.Buffer{}, func(gateway.Secret) (gateway.Provider, error) { t.Fatal("guard constructed provider"); return nil, nil }, fixedNow); e == nil {
			t.Fatal("unbounded targeted flags accepted")
		}
	}
}

func TestTargetedSixMockJournalContainsEveryStage(t *testing.T) {
	s, _ := evaluation.Load()
	cases, _ := selectExact(s, retestIDs, 6)
	raw, _ := os.ReadFile(priceFile())
	cat, _ := gateway.LoadPricingCatalog(raw, fixedNow())
	plan, e := evaluation.MakePlan(cases, "gpt-6-luna", cat, raw, .03)
	if e != nil {
		t.Fatal(e)
	}
	plan = sealExactCap(plan)
	if plan.WorstUSD > .03 || plan.Requests != 6 || plan.RequestCap != 6 {
		t.Fatal("target bound")
	}
	dir := t.TempDir()
	env := filepath.Join(dir, ".env")
	journal := filepath.Join(dir, "six.jsonl")
	if os.WriteFile(env, []byte("OPENAI_ENABLED=false\nOPENAI_API_KEY=synthetic-not-a-live-key\n"), 0600) != nil {
		t.Fatal("fixture")
	}
	args := []string{"--enable-openai-for-this-command", "--confirm-billable-openai-evaluation", "--limit", "6", "--max-cost-usd", ".03", "--pricing-file", priceFile(), "--openai-env-file", env, "--plan-sha256", plan.SHA256, "--report-file", journal}
	for _, id := range retestIDs {
		args = append(args, "--case-id", id)
	}
	var output bytes.Buffer
	oracle := &evaluation.Oracle{Cases: cases}
	e = runAt(args, func(k string) string {
		if k == "APP_ENV" {
			return "development"
		}
		return ""
	}, &output, func(gateway.Secret) (gateway.Provider, error) { return oracle, nil }, fixedNow)
	if e != nil || oracle.Calls != 6 {
		t.Fatal("mock bounded execution", e)
	}
	var summary Summary
	_ = json.Unmarshal(output.Bytes(), &summary)
	if summary.RealCalls != 6 || summary.Status != "REQUIRES_HUMAN_REVIEW" || !reflect.DeepEqual(summary.Plan.IDs, retestIDs) {
		t.Fatal("mock count/status")
	}
	journalRaw, _ := os.ReadFile(journal)
	records := 0
	for _, line := range bytes.Split(journalRaw, []byte("\n")) {
		var record stagedRecord
		_ = json.Unmarshal(line, &record)
		if record.Task == "" {
			continue
		}
		records++
		if record.Stages == nil || !record.Stages.SchemaValid || !record.Stages.Replay.DomainValid || len(record.Stages.Normalized) == 0 || len(record.Stages.Postprocessed) == 0 || len(record.Stages.Expected) == 0 {
			t.Fatal("missing staged evidence", record.ID)
		}
	}
	if records != 6 {
		t.Fatal("journal lost/duplicated attempts")
	}
}

func TestStageCaptureUsesFrozenProductionPipeline(t *testing.T) {
	s, _ := evaluation.Load()
	v, _ := candidate.CanonicalContractValidator()
	raw, e := os.ReadFile("../../internal/intelligence/parsing/testdata/hardening-v1/cases.json")
	if e != nil {
		t.Fatal(e)
	}
	var captures []evaluation.CapturedCase
	_ = json.Unmarshal(raw, &captures)
	for _, id := range []string{"cv-02", "cv-19", "jd-05"} {
		for _, c := range s.Cases {
			if c.ID != id {
				continue
			}
			for _, capture := range captures {
				if capture.ID != id {
					continue
				}
				stages, e := captureStages(c, capture.Raw, s.Taxonomy, v)
				if e != nil || stages.Replay == nil {
					t.Fatal("stage capture failed", e)
				}
				if id == "cv-02" && (!bytes.Contains(stages.Normalized, []byte(`"display_name":null`)) || !bytes.Contains(stages.Postprocessed, []byte(`"display_name":"Synthetic Evaluation Candidate 02"`))) {
					t.Fatal("name recovery stage lost")
				}
				if id == "cv-19" {
					for _, value := range []json.RawMessage{capture.Raw, stages.Normalized, stages.Postprocessed} {
						if !bytes.Contains(value, []byte(`"total_experience_months":0`)) && !bytes.Contains(value, []byte(`"total_experience_months": 0`)) {
							t.Fatal("fresher zero lost at a stage")
						}
					}
				}
			}
		}
	}
}
