// Package evaluation owns a fixed synthetic corpus, never live recruitment data.
package evaluation

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/parsing"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

//go:embed testdata/*.json
var corpus embed.FS

const Version = "synthetic-parsing-eval-v1"
const Instructions = parsing.ExtractionInstructions

var AsOf = time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)

type Case struct {
	ExpectedOutput   json.RawMessage                   `json:"expected_output,omitempty"`
	ExpectedMetadata map[string]contract.FieldMetadata `json:"expected_field_metadata,omitempty"`
	ID               string                            `json:"id"`
	Task             string                            `json:"task"`
	Industry         string                            `json:"industry"`
	Synthetic        bool                              `json:"synthetic"`
	Tags             []string                          `json:"tags"`
	Text             string                            `json:"text"`
	Expected         map[string]json.RawMessage        `json:"expected"`
	ExpectedProfile  json.RawMessage                   `json:"expected_profile,omitempty"`
	Sentinels        []string                          `json:"unsupported_claim_sentinels"`
	Provenance       map[string]any                    `json:"provenance_policy,omitempty"`
}
type Taxonomy struct {
	Version   string            `json:"version"`
	Canonical []string          `json:"canonical"`
	Aliases   map[string]string `json:"aliases"`
}
type Suite struct {
	Cases    []Case
	Taxonomy Taxonomy
}

var JobBindings = map[string]string{"/title": "/title", "/job_family": "/role_category", "/min_experience_years": "/min_experience_years", "/max_experience_years": "/max_experience_years", "/required_skills": "/skills", "/education_requirements": "/education_requirements", "/location": "/location", "/work_mode": "/work_mode", "/employment_type": "/employment_type", "/openings": "/openings", "/salary": "/salary"}

func Load() (Suite, error) {
	var s Suite
	for _, file := range []string{"jobs.v1.json", "cvs.v1.json"} {
		raw, e := corpus.ReadFile("testdata/" + file)
		if e != nil {
			return s, e
		}
		var cases []Case
		if json.Unmarshal(raw, &cases) != nil || len(cases) != 20 {
			return s, fmt.Errorf("invalid synthetic corpus")
		}
		s.Cases = append(s.Cases, cases...)
	}
	raw, _ := corpus.ReadFile("testdata/taxonomy.v1.json")
	if json.Unmarshal(raw, &s.Taxonomy) != nil {
		return s, fmt.Errorf("invalid evaluation taxonomy")
	}
	return s, nil
}
func (c Case) Feature() gateway.Feature {
	if c.Task == "cv.parse" {
		return gateway.CVParser
	}
	return gateway.JDParser
}
func (c Case) OutputLimit() int64 {
	if c.Task == "cv.parse" {
		return 6144
	}
	return 2048
}
func (c Case) ApproximateOutput() int64 {
	if c.Task == "cv.parse" {
		return 2200
	}
	return 512
}
func (c Case) Schema() (*gateway.OutputSchema, error) {
	if c.Task == "cv.parse" {
		return parsing.CVSchema()
	}
	if c.Task == "job.parse" {
		return parsing.JobSchema(), nil
	}
	return nil, fmt.Errorf("unsupported task")
}
func (c Case) Request() (gateway.GenerationRequest, error) {
	schema, e := c.Schema()
	return gateway.GenerationRequest{Feature: c.Feature(), ServiceTier: "default", Instructions: Instructions, Input: c.Text, Schema: schema, MaxOutputTokens: c.OutputLimit()}, e
}
func (c Case) Scope() gateway.Scope {
	s := gateway.Scope{UserID: "20000000-0000-4000-8000-000000000001", RequestID: "90000000-0000-4000-8000-000000000001", Role: "candidate"}
	if c.Task == "job.parse" {
		s.Role = "recruiter"
		s.TenantID = "30000000-0000-4000-8000-000000000001"
	}
	return s
}

// OracleOutput is used only by explicit mock mode, never sent to the provider.
func (c Case) OracleOutput() []byte {
	if c.Task == "cv.parse" {
		var p contract.ProfileData
		_ = json.Unmarshal(c.ExpectedProfile, &p)
		b, _ := json.Marshal(p)
		return b
	}
	var compact bytes.Buffer
	_ = json.Compact(&compact, c.ExpectedOutput)
	return compact.Bytes()
}
func (s Suite) Validate(v *contract.Validator) error {
	seen := map[string]bool{}
	counts := map[string]int{}
	for _, c := range s.Cases {
		if seen[c.ID] || !c.Synthetic || len(c.Text) < 100 || len(c.Text) > 32000 || c.ID == "" || c.Industry == "" {
			return fmt.Errorf("invalid synthetic case")
		}
		seen[c.ID] = true
		counts[c.Task]++
		if c.Task == "job.parse" {
			var j recruiter.DetailedJobInput
			if json.Unmarshal(c.ExpectedOutput, &j) != nil || recruiter.ValidateAIJobParseProposal(j) != nil || !parsing.JobSalarySourceMatches(j, c.Text) || len(c.Expected) != 17 {
				return fmt.Errorf("invalid job labels %s", c.ID)
			}
			for label := range c.Expected {
				if JobDispositions[label] == "" {
					return fmt.Errorf("unclassified job concept %s", label)
				}
			}
		} else if c.Task == "cv.parse" {
			var p contract.ProfileData
			if json.Unmarshal(c.ExpectedProfile, &p) != nil || v.ValidateData(p, AsOf).HasErrors() || p.Identity.DisplayName == nil || c.Provenance["confidence"] != nil || c.Provenance["review_status"] != "unreviewed" {
				return fmt.Errorf("invalid canonical labels %s", c.ID)
			}
			calc := contract.CalculateExperience(p.Employment, AsOf)
			if len(c.ExpectedMetadata) != len(contract.FieldValues(p)) {
				return fmt.Errorf("field provenance missing %s", c.ID)
			}
			for path, m := range c.ExpectedMetadata {
				if m.Confidence != nil || m.Review != contract.Unreviewed || m.Provenance.Source != "resume" || m.Provenance.Reference == "" || path == "" {
					return fmt.Errorf("invalid provenance authority %s", c.ID)
				}
			}
			golden := contract.ParserResult{ContractVersion: contract.Version, ProfileSchemaVersion: contract.Version, ResultID: "40000000-0000-4000-8000-000000000001", CandidateID: c.Scope().UserID, Resume: contract.ResumeMetadata{ResumeID: "50000000-0000-4000-8000-000000000001"}, ParserProvider: "synthetic", ParserVersion: Version, SourceType: "resume", Status: contract.ReadyForReview, Profile: p, FieldMetadata: c.ExpectedMetadata, CreatedAt: AsOf}
			if v.ValidateResult(golden, AsOf).HasErrors() {
				return fmt.Errorf("invalid canonical ground truth provenance %s", c.ID)
			}
			if calc.Months != nil && p.Professional.TotalExperienceMonths != nil && *calc.Months != *p.Professional.TotalExperienceMonths {
				return fmt.Errorf("experience ground truth disagrees with month-union policy: %s", c.ID)
			}
		} else {
			return fmt.Errorf("unknown task")
		}
	}
	if counts["job.parse"] != 20 || counts["cv.parse"] != 20 {
		return fmt.Errorf("incorrect corpus count")
	}
	return nil
}
func ValidateOutput(c Case, raw []byte, v *contract.Validator) bool {
	if c.Task == "job.parse" {
		var j recruiter.DetailedJobInput
		return json.Unmarshal(raw, &j) == nil && recruiter.ValidateAIJobParseProposal(j) == nil && parsing.JobSalarySourceMatches(j, c.Text) && j.Title != ""
	}
	var p contract.ProfileData
	if json.Unmarshal(raw, &p) != nil {
		return false
	}
	// Canonical review envelope assigns trusted identities and uncalibrated metadata.
	result := contract.ParserResult{ContractVersion: contract.Version, ProfileSchemaVersion: contract.Version, ResultID: "40000000-0000-4000-8000-000000000001", CandidateID: c.Scope().UserID, Resume: contract.ResumeMetadata{ResumeID: "50000000-0000-4000-8000-000000000001"}, ParserProvider: "openai", ParserVersion: Version, SourceType: "resume", Status: contract.ReadyForReview, Profile: p, FieldMetadata: contract.ProposedMetadata(p, "ai_derived"), CreatedAt: AsOf}
	return !v.ValidateResult(result, AsOf).HasErrors()
}
