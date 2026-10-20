package parsing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/TechiAkki963/SapienWorx/backend/internal/workforce"
)

type blueprintTestStore struct {
	*fakeStore
	Blueprint workforce.RoleBlueprint
	Fail      bool
}

func (s *blueprintTestStore) GenerationRoleBlueprint(context.Context, string) (workforce.RoleBlueprint, error) {
	if s.Fail {
		return workforce.RoleBlueprint{}, errors.New("unavailable")
	}
	return s.Blueprint, nil
}
func testBlueprints(t *testing.T) []workforce.RoleBlueprint {
	t.Helper()
	raw, e := os.ReadFile("../../workforce/testdata/role-blueprints-v1.1.json")
	if e != nil {
		t.Fatal(e)
	}
	var fixtures []struct {
		Title, JobFamily, FunctionalArea, IndustryContext, AboutRole                                                          string
		CoreResponsibilities, CoreSkills, OptionalSkills, CommonTools, CommonCompetencies, TypicalQualifications, ReviewNotes []string
	}
	// The dataset uses API-style names; decode explicitly rather than accepting defaults.
	var data []map[string]json.RawMessage
	if json.Unmarshal(raw, &data) != nil {
		t.Fatal("fixture")
	}
	for _, r := range data {
		var f struct {
			Title                string   `json:"title"`
			JobFamily            string   `json:"job_family"`
			FunctionalArea       string   `json:"functional_area"`
			IndustryContext      string   `json:"industry_context"`
			AboutRole            string   `json:"about_role"`
			CoreResponsibilities []string `json:"core_responsibilities"`
			CoreSkills           []string `json:"core_skills"`
			OptionalSkills       []string `json:"optional_skills"`
			CommonTools          []string `json:"common_tools"`
			CommonCompetencies   []string `json:"common_competencies"`
			ReviewNotes          []string `json:"review_notes"`
		}
		b, _ := json.Marshal(r)
		if json.Unmarshal(b, &f) != nil {
			t.Fatal("fixture fields")
		}
		fixtures = append(fixtures, struct {
			Title, JobFamily, FunctionalArea, IndustryContext, AboutRole                                                          string
			CoreResponsibilities, CoreSkills, OptionalSkills, CommonTools, CommonCompetencies, TypicalQualifications, ReviewNotes []string
		}{f.Title, f.JobFamily, f.FunctionalArea, f.IndustryContext, f.AboutRole, f.CoreResponsibilities, f.CoreSkills, f.OptionalSkills, f.CommonTools, f.CommonCompetencies, nil, f.ReviewNotes})
	}
	out := []workforce.RoleBlueprint{}
	for _, f := range fixtures {
		ref := func(name, kind string) workforce.RoleTaxonomyReference {
			return workforce.RoleTaxonomyReference{ID: digest(kind, name)[:32], Name: name, EntityType: kind}
		}
		refs := func(names []string) []workforce.RoleTaxonomyReference {
			out := []workforce.RoleTaxonomyReference{}
			for _, n := range names {
				out = append(out, ref(n, "competency"))
			}
			return out
		}
		out = append(out, workforce.RoleBlueprint{Version: workforce.RoleBlueprintVersion, Source: "product_authorised_occupation_guidance", ApprovalStatus: "approved", Occupation: ref(f.Title, "occupation"), JobFamily: ref(f.JobFamily, "job_family"), FunctionalArea: ref(f.FunctionalArea, "functional_area"), IndustryContext: ref(f.IndustryContext, "industry"), AboutRole: f.AboutRole, CoreResponsibilities: f.CoreResponsibilities, CoreSkills: refs(f.CoreSkills), OptionalSkills: refs(f.OptionalSkills), CommonTools: refs(f.CommonTools), CommonCompetencies: refs(f.CommonCompetencies), ReviewNotes: f.ReviewNotes})
	}
	if len(out) != 8 {
		t.Fatal("eight blueprints required")
	}
	return out
}
func v11References(r gateway.ProviderRequest) (generationV11References, error) {
	var input struct {
		Authoritative struct {
			Fields GenerationFields `json:"fields"`
		} `json:"authoritative"`
		Groups map[string][]string `json:"section_references"`
	}
	if json.Unmarshal([]byte(r.Input), &input) != nil {
		return generationV11References{}, ErrInvalid
	}
	g, f := input.Groups, input.Authoritative.Fields
	if len(g["about_role"]) == 0 {
		return generationV11References{}, ErrInvalid
	}
	return generationV11References{Headline: f.Title, AboutRole: g["about_role"][0], Responsibilities: g["responsibilities"], RequiredSkills: g["required_skills"], PreferredSkills: g["preferred_skills"], Qualifications: g["qualifications"], Location: f.Location, Minimum: *f.Minimum, Maximum: *f.Maximum, Assumptions: g["assumptions_requiring_review"], AISuggestedSkills: []string{}}, nil
}
func plannedV11(_ context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
	p, e := v11References(r)
	if e != nil {
		return gateway.ProviderResult{}, e
	}
	raw, _ := json.Marshal(p)
	return gateway.ProviderResult{Provider: "openai", Model: r.Model, Status: "completed", UsageKnown: true, Output: string(raw)}, nil
}
func v11Input(b workforce.RoleBlueprint) JobDescriptionGenerationRequest {
	min, max := 3, 5
	return JobDescriptionGenerationRequest{Version: "v1.1", Consent: true, Fields: GenerationFields{Title: b.Occupation.Name, Location: "Bengaluru", Minimum: &min, Maximum: &max}}
}

func TestGenerationV11EightRoleQualityAndProvenance(t *testing.T) {
	raw, e := os.ReadFile("testdata/job-generation-v1.1/goldens.json")
	if e != nil {
		t.Fatal(e)
	}
	var goldens []struct {
		Role            string     `json:"role"`
		Concepts        [][]string `json:"concept_groups"`
		Skills          []string   `json:"skill_themes"`
		MinimumDuties   int        `json:"minimum_responsibilities"`
		MinimumConcepts int        `json:"minimum_concept_groups"`
		Forbidden       []string   `json:"forbidden"`
	}
	if json.Unmarshal(raw, &goldens) != nil || len(goldens) != 8 {
		t.Fatal("goldens")
	}
	for i, b := range testBlueprints(t) {
		t.Run(b.Occupation.Name, func(t *testing.T) {
			calls := 0
			s, store := testService(t, func(c context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
				calls++
				if r.Model != "gpt-6-luna" || r.Instructions != GenerationV11Instructions || !strings.Contains(r.Input, "sapienworx_suggestions") {
					t.Fatal("contract/model")
				}
				return plannedV11(c, r)
			})
			s.Store = &blueprintTestStore{fakeStore: store, Blueprint: b}
			req := v11Input(b)
			a, e := s.GenerateDescription(testContext("recruiter", 1), req)
			if e != nil || a.Status != "requires_review" {
				t.Fatal("draft", e)
			}
			var o Outcome
			var v GenerationValue
			_ = json.Unmarshal(a.Result, &o)
			_ = json.Unmarshal(o.Value, &v)
			if calls != 1 || !o.DomainValid || o.PromptVersion != GenerationV11PromptVersion || o.SchemaVersion != GenerationV11SchemaVersion || v.Draft == nil || v.Draft.Version != "v1.1" || v.Fields.Title != req.Fields.Title || len(v.Fields.Skills) != 0 || v.Fields.Responsibilities != "" {
				t.Fatal("provenance/source-of-truth")
			}
			d := v.Draft
			g := goldens[i]
			if g.Role != b.Occupation.Name || len(d.Responsibilities) < g.MinimumDuties {
				t.Fatal("responsibility coverage")
			}
			lower := strings.ToLower(v.GeneratedDescription)
			coverage := 0
			for _, group := range g.Concepts {
				found := false
				for _, word := range group {
					found = found || strings.Contains(lower, strings.ToLower(word))
				}
				if found {
					coverage++
				}
			}
			if coverage < g.MinimumConcepts {
				t.Fatal("role concepts missing")
			}
			for _, skill := range g.Skills {
				if !strings.Contains(lower, strings.ToLower(skill)) {
					t.Error("skill theme missing", skill)
				}
			}
			for _, bad := range g.Forbidden {
				if strings.Contains(lower, strings.ToLower(bad)) {
					t.Error("unsupported concept", bad)
				}
			}
			for _, heading := range []string{"About the Role", "Key Responsibilities", "Skills / Competencies", "Experience", "Location"} {
				if !strings.Contains(v.GeneratedDescription, heading) {
					t.Error("section", heading)
				}
			}
			if len(v.GeneratedDescription) > 16000 || strings.Contains(v.GeneratedDescription, "a Industrial") || strings.Contains(v.GeneratedDescription, "Location / Work Mode") || len(d.Qualifications) != 0 {
				t.Fatal("length/grammar/unsupplied policy")
			}
			if d.Headline.Source != RecruiterSupplied || d.Location.Value != req.Fields.Location || d.Experience.Minimum != 3 || d.Experience.Maximum != 5 {
				t.Fatal("facts")
			}
			for _, item := range d.Responsibilities {
				if item.Source != SapienWorxSuggested || !item.RequiresConfirmation || item.SourceReference == "" {
					t.Fatal("duty source")
				}
			}
			for _, item := range append(d.RequiredSkills, d.PreferredSkills...) {
				if item.Source != SapienWorxSuggested || !item.RequiresConfirmation {
					t.Fatal("skill source")
				}
			}
			ai := false
			for _, item := range d.Assumptions {
				ai = ai || item.Source == AISuggested
			}
			if !ai {
				t.Fatal("AI editorial provenance")
			}
		})
	}
}

func TestGenerationV11RejectsContradictionsInventedClaimsAndReferenceForgery(t *testing.T) {
	b := testBlueprints(t)[0]
	for _, kind := range []string{"title", "location", "experience", "salary", "company", "mandatory-stack", "duplicate", "missing-duties", "missing-supplied", "forged-source", "degree"} {
		t.Run(kind, func(t *testing.T) {
			s, store := testService(t, func(_ context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
				p, _ := v11References(r)
				switch kind {
				case "title":
					p.Headline = "Other"
				case "location":
					p.Location = "Remote"
				case "experience":
					p.Maximum = 50
				case "salary":
					p.Responsibilities[0] = "Salary 40 lakhs"
				case "company":
					p.AboutRole = "Global employer with 500 staff"
				case "mandatory-stack":
					p.RequiredSkills = append(p.RequiredSkills, "AWS certification required")
				case "duplicate":
					p.Responsibilities[1] = p.Responsibilities[0]
				case "missing-duties":
					p.Responsibilities = p.Responsibilities[:2]
				case "missing-supplied":
					p.RequiredSkills = p.RequiredSkills[1:]
				case "forged-source":
					p.RequiredSkills[0] = "fact:skill:99"
				case "degree":
					p.Qualifications = []string{"MBA required"}
				}
				raw, _ := json.Marshal(p)
				return gateway.ProviderResult{Provider: "openai", Model: r.Model, Status: "completed", UsageKnown: true, Output: string(raw)}, nil
			})
			s.Store = &blueprintTestStore{fakeStore: store, Blueprint: b}
			req := v11Input(b)
			req.Fields.Skills = []string{"Explicit skill"}
			a, _ := s.GenerateDescription(testContext("recruiter", 1), req)
			var o Outcome
			var v GenerationValue
			_ = json.Unmarshal(a.Result, &o)
			_ = json.Unmarshal(o.Value, &v)
			if o.DomainValid || a.Status != "validation_error" || v.GeneratedDescription != "" || v.Draft != nil {
				t.Fatal("untrusted content escaped")
			}
		})
	}
}

func TestGenerationV11MissingBlueprintFailsBeforeProvider(t *testing.T) {
	calls := 0
	s, store := testService(t, func(c context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
		calls++
		return plannedV11(c, r)
	})
	s.Store = &blueprintTestStore{fakeStore: store, Fail: true}
	if _, e := s.GenerateDescription(testContext("recruiter", 1), v11Input(testBlueprints(t)[0])); !errors.Is(e, ErrUnavailable) || calls != 0 {
		t.Fatal("unknown role guessed or billed")
	}
}

func TestGenerationV11AuthoritativeFieldsAndReviewRemainExplicit(t *testing.T) {
	b := testBlueprints(t)[0]
	s, store := testService(t, plannedV11)
	s.Store = &blueprintTestStore{fakeStore: store, Blueprint: b}
	req := v11Input(b)
	req.Fields.Skills = []string{"Java", "Employer supplied tool"}
	req.Fields.Education = []string{"Recruiter supplied qualification"}
	req.Fields.Responsibilities = "Recruiter supplied duty."
	req.Fields.WorkMode = "onsite"
	a, e := s.GenerateDescription(testContext("recruiter", 1), req)
	if e != nil {
		t.Fatal(e)
	}
	var o Outcome
	var v GenerationValue
	_ = json.Unmarshal(a.Result, &o)
	_ = json.Unmarshal(o.Value, &v)
	if !o.DomainValid || v.Draft == nil || v.Draft.Qualifications[0].Source != RecruiterSupplied {
		t.Fatal("confirmed facts lost")
	}
	if v.Fields.Responsibilities != req.Fields.Responsibilities || len(v.Fields.Skills) != 2 {
		t.Fatal("implicit merge")
	}
	scope := gateway.ScopeFromContext(testContext("recruiter", 1))
	in := recruiter.DetailedJobInput{Title: req.Fields.Title, Location: req.Fields.Location, Description: v.GeneratedDescription, Skills: req.Fields.Skills, Responsibilities: req.Fields.Responsibilities, EmploymentType: "full_time", WorkMode: "onsite", Openings: 1}
	meta, e := s.VerifyJobGeneration(context.Background(), scope.UserID, scope.TenantID, a.ID, in)
	if e != nil || !meta.RequiresReview {
		t.Fatal("review bypass")
	}
	if _, e = s.ReviewDescription(testContext("recruiter", 1), a.ID, GenerationReview{Confirm: true, Fields: in}); e != nil {
		t.Fatal(e)
	}
	in.Description += " Kubernetes mandatory in prose only."
	meta, e = s.VerifyJobGeneration(context.Background(), scope.UserID, scope.TenantID, a.ID, in)
	if e != nil || !meta.RequiresReview || len(in.Skills) != 2 {
		t.Fatal("prose changed matching or retained approval")
	}
}

func TestGenerationV11DiagnosticRedaction(t *testing.T) {
	value := SourcedGenerationValue{Value: "private content sentinel"}
	draft := JobDescriptionDraft{Headline: value}
	if strings.Contains(fmt.Sprintf("%+v %#v %+v", value, value, draft), value.Value) {
		t.Fatal("new contract diagnostic leaked text")
	}
}

func TestGenerationV11AISuggestionsAreOptionalRoleBoundedAndNeverEmployerFacts(t *testing.T) {
	b := testBlueprints(t)[0]
	for _, value := range []string{"Java code review", "Kubernetes required", "SQL salary bonus", "AWS certification", "Java remote policy", "SQL 40 lakhs", "Java male only", "secret key disclosure", "SQL", "completely unrelated skill"} {
		t.Run(value, func(t *testing.T) {
			s, store := testService(t, func(_ context.Context, r gateway.ProviderRequest) (gateway.ProviderResult, error) {
				p, _ := v11References(r)
				p.AISuggestedSkills = []string{value}
				raw, _ := json.Marshal(p)
				return gateway.ProviderResult{Provider: "openai", Model: r.Model, Status: "completed", UsageKnown: true, Output: string(raw)}, nil
			})
			s.Store = &blueprintTestStore{fakeStore: store, Blueprint: b}
			a, _ := s.GenerateDescription(testContext("recruiter", 1), v11Input(b))
			var o Outcome
			var v GenerationValue
			_ = json.Unmarshal(a.Result, &o)
			_ = json.Unmarshal(o.Value, &v)
			if value != "Java code review" {
				if o.DomainValid || v.Draft != nil || v.GeneratedDescription != "" {
					t.Fatal("unsafe AI suggestion escaped")
				}
				return
			}
			if !o.DomainValid || v.Draft == nil || len(v.Fields.Skills) != 0 {
				t.Fatal("valid optional compound or matching boundary")
			}
			item := v.Draft.PreferredSkills[len(v.Draft.PreferredSkills)-1]
			if item.Source != AISuggested || !item.RequiresConfirmation || !strings.Contains(item.SourceReference, GenerationV11PromptVersion) {
				t.Fatal("AI source missing")
			}
			for _, core := range v.Draft.RequiredSkills {
				if core.Value == value {
					t.Fatal("AI suggestion became mandatory")
				}
			}
		})
	}
}

// Metadata-only offline proposal calculation. Never loads a key or instantiates
// an adapter; expected tokens are estimates, not billed/observed usage.
func TestGenerationV11RetestCostPreflight(t *testing.T) {
	raw, e := os.ReadFile("../../../../config/ai-pricing.v1.json")
	if e != nil {
		t.Fatal(e)
	}
	catalog, e := gateway.LoadPricingCatalog(raw, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	price := catalog.Models["gpt-6-luna"]
	rows := []map[string]any{}
	expected, worst := 0.0, 0.0
	caseData, e := os.ReadFile("testdata/job-generation-v1.1/evaluation-cases.json")
	if e != nil {
		t.Fatal(e)
	}
	var scenarios []struct {
		Title    string `json:"title"`
		Location string `json:"location"`
		Minimum  int    `json:"minimum"`
		Maximum  int    `json:"maximum"`
	}
	if json.Unmarshal(caseData, &scenarios) != nil || len(scenarios) != 8 {
		t.Fatal("eight original scenarios")
	}
	for i, b := range testBlueprints(t) {
		f := v11Input(b).Fields
		scenario := scenarios[i]
		if scenario.Title != f.Title {
			t.Fatal("scenario order changed")
		}
		f.Location = scenario.Location
		f.Minimum = &scenario.Minimum
		f.Maximum = &scenario.Maximum
		c, e := makeGenerationV11Context(f, b)
		if e != nil {
			t.Fatal(e)
		}
		payload := len(c.Input) + len(GenerationV11Instructions) + len(c.Schema.JSON)
		// 4KB standard gateway envelope plus 1KB for concrete SQL taxonomy UUIDs
		// versus test fixture IDs and any JSON framing differences.
		inputBound := payload + 4096 + 1024
		inputEstimate := (payload+3)/4 + 128
		outputExpected := 300
		cost := (float64(inputEstimate)*price.InputUSDPerMillion + float64(outputExpected)*price.OutputUSDPerMillion) / 1e6
		reserve := math.Ceil(float64(inputBound)*math.Max(price.InputUSDPerMillion*1.25, price.CacheWriteInputUSDPerMillion)+1024*price.OutputUSDPerMillion) / 1e6
		expected += cost
		worst += reserve
		rows = append(rows, map[string]any{"case_id": fmt.Sprintf("jd-%02d", i+1), "role": b.Occupation.Name, "payload_bytes": payload, "expected_input_tokens": inputEstimate, "expected_output_tokens": outputExpected, "conservative_input_tokens": inputBound, "max_output_tokens": 1024, "expected_usd": cost, "conservative_usd": reserve})
	}
	cap := .03
	if worst > cap {
		cap = .05
	}
	if worst > cap {
		t.Fatal("proposed cap insufficient")
	}
	encoded, _ := json.Marshal(map[string]any{"status": "PROPOSAL_ONLY_NOT_AUTHORIZED_NOT_EXECUTED", "cases": rows, "calls": 8, "model": "gpt-6-luna", "service_tier": "default", "pricing_version": catalog.Version, "expected_usd": expected, "conservative_usd": worst, "proposed_hard_cap_usd": cap, "max_retries": 0, "timeout_seconds": 30, "provider_requests": 0})
	t.Log("JD_V11_PREFLIGHT " + string(encoded))
}
