package evaluation

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/parsing"
)

type CapturedCase struct {
	ID           string          `json:"id"`
	Task         string          `json:"task"`
	Source       string          `json:"source"`
	SourceSHA256 string          `json:"source_sha256"`
	Raw          json.RawMessage `json:"raw_provider_result"`
	Regressions  []string        `json:"regressions"`
}
type Regression struct {
	ID         string          `json:"id"`
	CaseID     string          `json:"case_id"`
	Field      string          `json:"field"`
	Category   string          `json:"category"`
	Expected   json.RawMessage `json:"expected_normalized_value"`
	Provenance struct {
		State  string `json:"state"`
		Source string `json:"source"`
		Kind   string `json:"kind"`
	} `json:"expected_provenance"`
}
type Replay struct {
	ID                 string             `json:"id"`
	Task               string             `json:"task"`
	RawScore           Result             `json:"before_raw"`
	Score              Result             `json:"after_offline"`
	AdjustedBefore     Metric             `json:"representation_adjusted_before"`
	AdjustedAfter      Metric             `json:"representation_adjusted_after"`
	Processing         parsing.Processing `json:"processing"`
	SchemaValid        bool               `json:"schema_valid"`
	DomainValid        bool               `json:"domain_valid"`
	ProfileValid       bool               `json:"standalone_profile_valid"`
	RegressionCount    int                `json:"regressions"`
	RegressionFailures []string           `json:"regression_failures"`
}

// RepresentationAdjusted compares the SAME frozen labelled leaves. Only
// documented duplicate projections and equivalent academic decompositions are
// compared; no golden geographic/context conflict is excused. It is not a
// semantic model judge and does not change the published strict metric.
func RepresentationAdjusted(c Case, raw []byte, tax Taxonomy) Metric {
	if c.Task == "job.parse" {
		return Score(c, raw, true, true, tax).Normalized
	}
	actual := decode(raw)
	expected := map[string]any{}
	values := map[string]any{}
	flatten(ordered(decode(c.ExpectedProfile)), "", expected)
	flatten(ordered(actual), "", values)
	passed := 0
	for path, want := range expected {
		got := values[path]
		ok := reflect.DeepEqual(canonical(got, tax), canonical(want, tax))
		if !ok && (path == "/certifications" || path == "/location/preferred") {
			if list, yes := want.([]any); yes && len(list) == 0 && got == nil {
				ok = true
			}
		}
		if !ok && path == "/location/remote_preference" {
			if modes, yes := values["/preferences/work_modes/0"]; yes && values["/preferences/work_modes/1"] == nil {
				ok = reflect.DeepEqual(modes, want)
			}
		}
		if !ok && strings.Contains(path, "/responsibilities/0") {
			ok = reflect.DeepEqual(values[strings.TrimSuffix(path, "/responsibilities/0")+"/description"], want)
		}
		if !ok && strings.HasPrefix(path, "/education/") && (strings.HasSuffix(path, "/degree") || strings.HasSuffix(path, "/qualification/name")) {
			parts := strings.Split(path, "/")
			prefix := "/education/" + parts[2]
			degree, _ := values[prefix+"/degree"].(string)
			qualification, _ := values[prefix+"/qualification/name"].(string)
			study, _ := values[prefix+"/field_of_study"].(string)
			clean := func(s string) string {
				var words []string
				for _, w := range strings.Fields(contract.ComparisonKey(s)) {
					if w != "in" {
						words = append(words, w)
					}
				}
				return strings.Join(words, " ")
			}
			if target, yes := want.(string); yes {
				for _, award := range []string{degree, qualification} {
					if award == "" {
						continue
					}
					combined := award
					if study != "" && !strings.Contains(contract.ComparisonKey(award), contract.ComparisonKey(study)) {
						combined += " " + study
					}
					if clean(combined) == clean(target) {
						ok = true
					}
				}
			}
		}
		if ok {
			passed++
		}
	}
	return measured(passed, len(expected))
}

func ReplayCaptured(c Case, capture CapturedCase, regressions []Regression, tax Taxonomy, v *contract.Validator) (Replay, error) {
	r := Replay{ID: c.ID, Task: c.Task, RegressionFailures: []string{}}
	if capture.ID != c.ID || capture.Task != c.Task || capture.Source != c.Text {
		return r, fmt.Errorf("captured source mismatch")
	}
	schema, e := c.Schema()
	if e != nil {
		return r, e
	}
	if e = gateway.ValidateStructuredOutput(schema, capture.Raw); e != nil {
		return r, e
	}
	r.SchemaValid = true
	aliases := map[string]parsing.SkillMapping{}
	for key, value := range tax.Aliases {
		aliases[contract.ComparisonKey(key)] = parsing.SkillMapping{ID: "60000000-0000-4000-8000-000000000001", Name: value}
	}
	for _, value := range tax.Canonical {
		aliases[contract.ComparisonKey(value)] = parsing.SkillMapping{ID: "60000000-0000-4000-8000-000000000001", Name: value}
	}
	// IDs are irrelevant to scoring, but each taxonomy entity must have a distinct
	// deterministic fixture ID so canonical duplicate detection remains meaningful.
	i := 1
	ids := map[string]string{}
	for _, value := range tax.Canonical {
		ids[value] = fmt.Sprintf("60000000-0000-4000-8000-%012d", i)
		i++
	}
	for key, item := range aliases {
		item.ID = ids[item.Name]
		aliases[key] = item
	}
	if c.Task == "job.parse" {
		r.Processing, e = parsing.NormalizeJobProposal(capture.Raw, c.Text, capture.SourceSHA256, aliases)
		r.DomainValid = e == nil
		r.ProfileValid = true
	} else {
		var data contract.ProfileData
		r.Processing, data, e = parsing.NormalizeCVProposal(capture.Raw, c.Text, capture.SourceSHA256, aliases, AsOf)
		proposal := contract.ParserResult{ContractVersion: contract.Version, ProfileSchemaVersion: contract.Version, ResultID: "40000000-0000-4000-8000-000000000001", CandidateID: c.Scope().UserID, Resume: contract.ResumeMetadata{ResumeID: "50000000-0000-4000-8000-000000000001"}, ParserProvider: "openai", ParserVersion: "openai-" + parsing.PromptVersion + "-" + parsing.CVTaskVersion, SourceType: "resume", Status: contract.ReadyForReview, Profile: data, FieldMetadata: r.Processing.Metadata, CreatedAt: AsOf, Issues: r.Processing.Issues}
		r.DomainValid = e == nil && !v.ValidateResult(proposal, AsOf).HasErrors()
		r.ProfileValid = !v.ValidateProfile(contract.CandidateProfile{SchemaVersion: contract.Version, CandidateID: c.Scope().UserID, Profile: data}, AsOf).HasErrors()
	}
	if e != nil {
		return r, e
	}
	r.RawScore = Score(c, capture.Raw, true, ValidateOutput(c, capture.Raw, v), tax)
	r.Score = Score(c, r.Processing.Normalized, true, r.DomainValid, tax)
	r.AdjustedBefore = RepresentationAdjusted(c, capture.Raw, tax)
	r.AdjustedAfter = RepresentationAdjusted(c, r.Processing.Normalized, tax)
	actual := map[string]any{}
	if c.Task == "cv.parse" {
		flatten(ordered(decode(r.Processing.Normalized)), "", actual)
	} else {
		var fields map[string]any
		_ = json.Unmarshal(r.Processing.Normalized, &fields)
		for k, value := range fields {
			actual["/"+k] = value
		}
	}
	for _, regression := range regressions {
		if regression.CaseID != c.ID {
			continue
		}
		r.RegressionCount++
		path := strings.TrimPrefix(regression.Field, "/adapter")
		if !reflect.DeepEqual(canonical(actual[path], tax), canonical(decode(regression.Expected), tax)) {
			r.RegressionFailures = append(r.RegressionFailures, regression.ID)
		}
		metadata, exists := r.Processing.Metadata[path]
		if regression.Provenance.State == "absent" {
			if exists {
				r.RegressionFailures = append(r.RegressionFailures, regression.ID+":provenance")
			}
		} else if !exists || metadata.Provenance.Source != regression.Provenance.Source || metadata.Provenance.Kind != regression.Provenance.Kind || metadata.Confidence != nil || metadata.Review != contract.Unreviewed {
			r.RegressionFailures = append(r.RegressionFailures, regression.ID+":provenance")
		}
	}
	return r, nil
}
