package profilecontract_test

import (
	"bytes"
	"encoding/json"
	"math"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	c "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

var asOf = time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC)

const candidateID = "10000000-0000-4000-8000-000000000001"

func ptr[T any](value T) *T { return &value }
func validator(t *testing.T) *c.Validator {
	t.Helper()
	v, e := candidate.CanonicalContractValidator()
	if e != nil {
		t.Fatal(e)
	}
	return v
}
func hasCode(r c.ValidationReport, code string) bool {
	for _, x := range r.Issues {
		if x.Code == code {
			return true
		}
	}
	return false
}
func ref(name string) c.EntityRef { return c.EntityRef{Name: ptr(name), RawValue: ptr(name)} }
func result(data c.ProfileData) c.ParserResult {
	return c.ParserResult{ContractVersion: c.Version, ProfileSchemaVersion: c.Version, ResultID: "20000000-0000-4000-8000-000000000001", CandidateID: candidateID, Resume: c.ResumeMetadata{ResumeID: "30000000-0000-4000-8000-000000000001", OriginalFilename: ptr("synthetic.pdf"), MIMEType: ptr("application/pdf"), PageCount: ptr(3)}, ParserProvider: "synthetic", ParserVersion: "v1", SourceType: "resume", Status: c.ReadyForReview, Profile: data, FieldMetadata: c.ProposedMetadata(data, "resume"), CreatedAt: asOf}
}

func TestSyntheticIndustryAndEdgeFixtureContracts(t *testing.T) {
	raw, e := os.ReadFile("testdata/synthetic_profiles.json")
	if e != nil {
		t.Fatal(e)
	}
	var fixtures []struct {
		Name             string
		Tags             []string
		Valid            bool
		CandidateProfile json.RawMessage `json:"candidate_profile"`
		ExpectedMonths   json.RawMessage `json:"expected_months"`
		ExpectedCode     string          `json:"expected_code"`
	}
	if json.Unmarshal(raw, &fixtures) != nil || len(fixtures) != 18 {
		t.Fatal("fixture corpus missing")
	}
	v := validator(t)
	for _, f := range fixtures {
		t.Run(f.Name, func(t *testing.T) {
			p, e := c.DecodeProfile(f.CandidateProfile)
			if e != nil {
				t.Fatal(e)
			}
			r := v.ValidateProfile(p, asOf)
			if r.HasErrors() == f.Valid {
				t.Fatalf("valid=%t issues=%v", f.Valid, r.Issues)
			}
			if f.ExpectedCode != "" && !hasCode(r, f.ExpectedCode) {
				t.Fatal("expected bounded validation issue")
			}
			if len(f.ExpectedMonths) > 0 {
				calc := c.CalculateExperience(p.Profile.Employment, asOf)
				if string(f.ExpectedMonths) == "null" {
					if calc.Months != nil {
						t.Fatal("invented uncertain experience")
					}
				} else {
					var want int
					_ = json.Unmarshal(f.ExpectedMonths, &want)
					if calc.Months == nil || *calc.Months != want {
						t.Fatal("incorrect union months")
					}
				}
			}
			encoded, e := json.Marshal(p)
			if e != nil {
				t.Fatal(e)
			}
			round, e := c.DecodeProfile(encoded)
			if e != nil || !reflect.DeepEqual(p, round) {
				t.Fatal("profile round trip lost data")
			}
			proposal := result(p.Profile)
			encoded, _ = json.Marshal(proposal)
			decoded, e := c.DecodeResult(encoded)
			if e != nil {
				t.Fatal(e)
			}
			if f.Valid && v.ValidateResult(decoded, asOf).HasErrors() {
				t.Fatalf("proposal rejected: %v", v.ValidateResult(decoded, asOf).Issues)
			}
			for _, metadata := range decoded.FieldMetadata {
				if metadata.Confidence != nil || metadata.Review != c.Unreviewed {
					t.Fatal("fixture fabricated confidence/confirmation")
				}
			}
		})
	}
}

func TestValueValidationAndNonDestructiveWarnings(t *testing.T) {
	v := validator(t)
	for _, tc := range []struct {
		name, code string
		mutate     func(*c.ProfileData)
	}{
		{"email", "INVALID_EMAIL", func(p *c.ProfileData) { p.Contact.PrimaryEmail = ptr("Name <person@example.test>") }},
		{"phone", "INVALID_PHONE", func(p *c.ProfileData) { p.Contact.PrimaryPhone = ptr("9999999999") }},
		{"currency", "INVALID_CURRENCY", func(p *c.ProfileData) {
			p.Compensation.Current = &c.Money{Amount: ptr("10.00"), Currency: ptr("XXX"), Period: ptr("monthly")}
		}},
		{"money precision", "INVALID_AMOUNT", func(p *c.ProfileData) { p.Compensation.Current = &c.Money{Amount: ptr("10.001"), Currency: ptr("INR")} }},
		{"negative experience", "INVALID_EXPERIENCE", func(p *c.ProfileData) { p.Professional.TotalExperienceMonths = ptr(-1) }},
		{"notice limit", "INVALID_NOTICE_PERIOD", func(p *c.ProfileData) { p.Availability.NoticePeriodDays = ptr(731) }},
		{"unsafe URL", "INVALID_URL", func(p *c.ProfileData) { p.Links = []c.Link{{Type: "portfolio", URL: "javascript:alert(1)"}} }},
		{"credential URL", "INVALID_URL", func(p *c.ProfileData) {
			p.Links = []c.Link{{Type: "other", URL: "https://user:password@example.test/"}}
		}},
		{"country", "INVALID_COUNTRY", func(p *c.ProfileData) { p.Contact.CountryCode = ptr("ZZ") }},
		{"enum", "INVALID_ENUM", func(p *c.ProfileData) { p.Preferences.WorkModes = []string{"telepathy"} }},
		{"taxonomy ID", "INVALID_TAXONOMY_REFERENCE", func(p *c.ProfileData) {
			p.Skills = []c.Skill{{Entity: c.EntityRef{ID: ptr("skill_java"), Namespace: ptr("workforce")}}}
		}},
		{"reversed dates", "END_BEFORE_START", func(p *c.ProfileData) {
			p.Employment = []c.Employment{{Company: ref("Example"), StartDate: c.ParsePartialDate("2024-03"), EndDate: c.ParsePartialDate("2023-01")}}
		}},
		{"current end date", "CURRENT_ROLE_HAS_END", func(p *c.ProfileData) {
			p.Employment = []c.Employment{{Company: ref("Example"), StartDate: c.ParsePartialDate("2024-01"), EndDate: c.ParsePartialDate("2025-01"), IsCurrent: ptr(true)}}
		}},
		{"grade", "INVALID_GRADE", func(p *c.ProfileData) { p.Education = []c.Education{{Grade: ptr("5.0"), GradeType: ptr("gpa_4")}} }},
		{"expiry", "NONEXPIRING_HAS_EXPIRY", func(p *c.ProfileData) {
			p.Certifications = []c.Certification{{DoesNotExpire: ptr(true), ExpiryDate: c.ParsePartialDate("2028")}}
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			p := c.ProfileData{}
			tc.mutate(&p)
			before, _ := json.Marshal(p)
			r := v.ValidateData(p, asOf)
			after, _ := json.Marshal(p)
			if !hasCode(r, tc.code) {
				t.Fatalf("missing %s: %v", tc.code, r.Issues)
			}
			if !bytes.Equal(before, after) {
				t.Fatal("validation mutated profile")
			}
		})
	}
	p := c.ProfileData{Skills: []c.Skill{{Entity: ref("Java")}, {Entity: ref("JAVA")}}}
	r := v.ValidateData(p, asOf)
	if r.HasErrors() || !hasCode(r, "DUPLICATE_ENTRY") {
		t.Fatal("duplicates should warn without destructive removal")
	}
	p.Skills = []c.Skill{{Entity: c.EntityRef{ID: ptr("40000000-0000-4000-8000-000000000001"), Namespace: ptr("workforce"), Name: ptr("Java")}}}
	r = v.ValidateData(p, asOf)
	if r.HasErrors() || !hasCode(r, "TAXONOMY_RESOLUTION_REQUIRED") {
		t.Fatal("unresolved taxonomy ID claimed verified")
	}
}

func TestProvenanceConfidenceAndParserAuthority(t *testing.T) {
	v := validator(t)
	base := result(c.ProfileData{Identity: c.Identity{DisplayName: ptr("Synthetic")}})
	for _, tc := range []struct {
		name, code string
		mutate     func(*c.ParserResult)
	}{
		{"unsupported version", "UNSUPPORTED_VERSION", func(p *c.ParserResult) { p.ContractVersion = "v9" }},
		{"missing owner", "INVALID_ID", func(p *c.ParserResult) { p.CandidateID = "" }},
		{"missing provenance", "PROVENANCE_REQUIRED", func(p *c.ParserResult) { p.FieldMetadata = nil }},
		{"unknown path", "UNKNOWN_METADATA_PATH", func(p *c.ParserResult) { p.FieldMetadata["/verification/email_verified"] = c.FieldMetadata{} }},
		{"confidence high", "INVALID_CONFIDENCE", func(p *c.ParserResult) {
			m := p.FieldMetadata["/identity/display_name"]
			m.Confidence = ptr(1.01)
			p.FieldMetadata["/identity/display_name"] = m
		}},
		{"confidence NaN", "INVALID_CONFIDENCE", func(p *c.ParserResult) {
			m := p.FieldMetadata["/identity/display_name"]
			m.Confidence = ptr(math.NaN())
			p.FieldMetadata["/identity/display_name"] = m
		}},
		{"confirmation forgery", "PARSER_CANNOT_CONFIRM", func(p *c.ParserResult) {
			m := p.FieldMetadata["/identity/display_name"]
			m.Review = c.ReviewConfirmed
			p.FieldMetadata["/identity/display_name"] = m
		}},
		{"manual source forgery", "INVALID_PROVENANCE", func(p *c.ParserResult) {
			m := p.FieldMetadata["/identity/display_name"]
			m.Provenance.Source = "candidate_input"
			p.FieldMetadata["/identity/display_name"] = m
		}},
		{"path filename", "INVALID_FILENAME", func(p *c.ParserResult) { p.Resume.OriginalFilename = ptr("/private/resume.pdf") }},
		{"page reference", "INVALID_PAGE_REFERENCE", func(p *c.ParserResult) {
			m := p.FieldMetadata["/identity/display_name"]
			m.Provenance.Page = ptr(4)
			p.FieldMetadata["/identity/display_name"] = m
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			raw, _ := json.Marshal(base)
			p, _ := c.DecodeResult(raw)
			tc.mutate(&p)
			if !hasCode(v.ValidateResult(p, asOf), tc.code) {
				t.Fatal("missing expected validation code")
			}
		})
	}
	for _, confidence := range []float64{0, 0.5, 1} {
		p := base
		p.FieldMetadata = c.ProposedMetadata(p.Profile, "resume")
		m := p.FieldMetadata["/identity/display_name"]
		m.Confidence = &confidence
		p.FieldMetadata["/identity/display_name"] = m
		if v.ValidateResult(p, asOf).HasErrors() {
			t.Fatal("valid confidence boundary rejected")
		}
	}
}

func TestStrictDecodingRejectsAmbiguousOrSensitiveData(t *testing.T) {
	for _, raw := range []string{
		`{"schema_version":"v1","schema_version":"v9"}`,
		`{"schema_version":"v1","SCHEMA_VERSION":"v9"}`,
		`{"profile":{"identity":{"date_of_birth":"2000-01-01"}}}`,
		`{"profile":{"religion":"synthetic"}}`,
		`{"profile":{"contact":{"email_verified":true}}}`,
		`{"profile":{"compensation":{"current":{"amount":100.01}}}}`,
		`{"profile":null}`,
		`{"profile":{"skills":[]}} {}`,
		strings.Repeat("[", 40) + strings.Repeat("]", 40),
	} {
		t.Run(strconvName(raw), func(t *testing.T) {
			if _, e := c.DecodeProfile([]byte(raw)); e == nil {
				t.Fatal("ambiguous/sensitive JSON accepted")
			}
		})
	}
	if _, e := c.DecodeProfile([]byte(strings.Repeat(" ", c.MaxContractBytes+1))); e == nil {
		t.Fatal("size bound ignored")
	}
	if _, e := c.DecodeProfile([]byte{'{', '"', 0xff, '"', ':', '1', '}'}); e == nil {
		t.Fatal("invalid UTF-8 accepted")
	}
}

func strconvName(raw string) string {
	if len(raw) > 70 {
		return raw[:70]
	}
	return raw
}

func TestNormalizationPreservesRawAndAvoidsInference(t *testing.T) {
	p := c.ProfileData{Identity: c.Identity{DisplayName: ptr("  E\u0301lan  ")}, Contact: c.Contact{PrimaryPhone: ptr("+44 (20) 7946-0123"), PrimaryEmail: ptr("Person@EXAMPLE.TEST")}, Skills: []c.Skill{{Entity: c.EntityRef{Name: ptr(" JS "), RawValue: ptr(" JS ")}}}}
	n := c.NormalizeData(p)
	if *n.Identity.DisplayName != "Élan" || *p.Identity.DisplayName != "  E\u0301lan  " || *n.Contact.PrimaryPhone != "+442079460123" || *n.Contact.PrimaryEmail != "Person@example.test" {
		t.Fatal("normalization/in-place mutation error")
	}
	aliases := map[string]c.EntityRef{"js": ref("JavaScript")}
	skills := c.NormalizeSkills(p.Skills, aliases)
	if *skills[0].Entity.Name != "JavaScript" || *skills[0].Entity.RawValue != " JS " || skills[0].Proficiency != nil {
		t.Fatal("alias/raw/proficiency policy violated")
	}
	if n.Professional.TotalExperienceMonths != nil || n.Compensation.Expected != nil || n.Location.RemotePreference != nil {
		t.Fatal("normalizer guessed missing information")
	}
}
