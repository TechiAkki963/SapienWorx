package modelbaseline

import (
	"encoding/json"
	"os"
	"testing"
)

func TestPinnedBaselineAndInternalScope(t *testing.T) {
	e, err := ReadEvidence()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../../../../docs/benchmarks/jd-generation-baseline-v1.1.json")
	if err != nil {
		t.Fatal(err)
	}
	if evidenceSHA256(raw) != e.SourceSHA256 {
		t.Fatal("historical baseline changed")
	}
	if e.TaskVersion != "v1.2" || e.PromptVersion != "jd-p2" || e.SchemaVersion != "jd-generation-v1.1" || e.BlueprintVersion != "rb-1.1" {
		t.Fatal("version drift")
	}
	base := `{"evaluation_baseline":"jd-generation-v1.1","approved_tasks":["job.generate_description"],"model_routes":{"job.generate_description":"gpt-6-luna"},"beta_rollout":{"stage":"internal","actor_ids":["20000000-0000-4000-8000-000000000001"]}}`
	policy := func() map[string]any { var p map[string]any; _ = json.Unmarshal([]byte(base), &p); return p }
	if _, err := Evaluate("ai_gateway", "openai", "gpt-6-luna", policy()); err != nil {
		t.Fatal(err)
	}
	tests := map[string]func(map[string]any){
		"all beta": func(p map[string]any) { p["beta_rollout"].(map[string]any)["stage"] = "all" },
		"tenant cohort": func(p map[string]any) {
			p["beta_rollout"].(map[string]any)["tenant_ids"] = []string{"10000000-0000-4000-8000-000000000001"}
		},
		"extra task":        func(p map[string]any) { p["approved_tasks"] = []string{"cv.parse", "job.generate_description"} },
		"other model route": func(p map[string]any) { p["model_routes"] = map[string]string{e.Task: "unreviewed-model"} },
		"no actor":          func(p map[string]any) { p["beta_rollout"].(map[string]any)["actor_ids"] = []string{} },
		"duplicate actor": func(p map[string]any) {
			p["beta_rollout"].(map[string]any)["actor_ids"] = []string{"20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000001"}
		},
	}
	for name, change := range tests {
		t.Run(name, func(t *testing.T) {
			p := policy()
			change(p)
			if _, err := Evaluate("ai_gateway", "openai", "gpt-6-luna", p); err == nil {
				t.Fatal("unreviewed policy accepted")
			}
		})
	}
	if _, err := Evaluate("ai_gateway", "openai", "other", policy()); err == nil {
		t.Fatal("unreviewed model accepted")
	}
}

func TestEvidenceDigestNormalizesOnlyLineEndings(t *testing.T) {
	lf := []byte("{\n  \"cases\": 8\n}\n")
	crlf := []byte("{\r\n  \"cases\": 8\r\n}\r\n")
	if evidenceSHA256(lf) != evidenceSHA256(crlf) {
		t.Fatal("checkout line endings changed the evidence digest")
	}
	for _, changed := range []string{"{\n  \"cases\": 9\n}\n", "{\n \"cases\": 8\n}\n", "{\n  \"cases\": 8\n}"} {
		if evidenceSHA256(lf) == evidenceSHA256([]byte(changed)) {
			t.Fatal("content or non-line-ending whitespace change was ignored")
		}
	}
}
