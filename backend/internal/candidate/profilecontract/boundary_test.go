package profilecontract_test

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	c "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

func TestResumeMetadataAndBoundedContracts(t *testing.T) {
	v := validator(t)
	for _, tc := range []struct {
		name   string
		change func(*c.ResumeMetadata)
		code   string
	}{
		{"id", func(r *c.ResumeMetadata) { r.ResumeID = "storage-key" }, "INVALID_ID"},
		{"filename", func(r *c.ResumeMetadata) { r.OriginalFilename = ptr("../resume.pdf") }, "INVALID_FILENAME"},
		{"mime", func(r *c.ResumeMetadata) { r.MIMEType = ptr("text/html") }, "INVALID_MIME_TYPE"},
		{"size", func(r *c.ResumeMetadata) { r.FileSize = ptr(int64(101 << 20)) }, "INVALID_FILE_SIZE"},
		{"pages", func(r *c.ResumeMetadata) { r.PageCount = ptr(101) }, "INVALID_PAGE_COUNT"},
		{"purpose", func(r *c.ResumeMetadata) { r.Purpose = ptr("public") }, "INVALID_ENUM"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := result(c.ProfileData{}).Resume
			tc.change(&r)
			p := c.CandidateProfile{SchemaVersion: c.Version, CandidateID: candidateID, Profile: c.ProfileData{Identity: c.Identity{DisplayName: ptr("Synthetic")}}, Resumes: []c.ResumeMetadata{r}}
			if !hasCode(v.ValidateProfile(p, asOf), tc.code) {
				t.Fatal("invalid resume accepted")
			}
		})
	}
	p := c.ProfileData{Employment: make([]c.Employment, 31)}
	if !hasCode(v.ValidateData(p, asOf), "COLLECTION_LIMIT") || c.CalculateExperience(p.Employment, asOf).Months != nil {
		t.Fatal("oversized collection accepted")
	}
	p = c.ProfileData{Employment: []c.Employment{{StartDate: &c.PartialDate{Precision: "unknown", RawValue: ptr(strings.Repeat("x", 5001))}}}}
	if !hasCode(v.ValidateData(p, asOf), "TEXT_LIMIT") {
		t.Fatal("date raw value bypassed bounds")
	}
}

func TestReviewReadBoundaryLineageAndMandatoryName(t *testing.T) {
	v := validator(t)
	actor := c.Actor{UserID: candidateID, Role: "candidate"}
	p := result(c.ProfileData{Identity: c.Identity{DisplayName: ptr("Synthetic")}})
	p.FieldMetadata["/identity/display_name"] = c.FieldMetadata{Provenance: c.Provenance{Source: "resume", Kind: "explicit", Section: "identity", Reference: "line_1"}, Confidence: ptr(0.8), Review: c.Unreviewed}
	d, e := v.NewReviewDraft(actor, p, asOf)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = v.ReadReview(d, c.Actor{UserID: "foreign", Role: "candidate"}, asOf); !errors.Is(e, c.ErrForbidden) {
		t.Fatal("foreign read accepted")
	}
	view, e := v.ReadReview(d, actor, asOf)
	if e != nil {
		t.Fatal(e)
	}
	raw, _ := json.Marshal(view)
	for _, key := range []string{"parser_provider", "parser_version", "s3_key", "verification"} {
		if strings.Contains(string(raw), key) {
			t.Fatal("operational or authority metadata leaked")
		}
	}
	*view.ProposedProfile.Identity.DisplayName = "Mutated response"
	if d.Apply(actor, c.ReviewPatch{Decisions: []c.Decision{{Path: "/identity/display_name", Status: c.Edited, Value: json.RawMessage(`null`)}}}, asOf) != nil {
		t.Fatal("typed optional correction rejected early")
	}
	if _, e = v.PrepareConfirmation(d, actor, 1, &asOf, asOf); e == nil {
		t.Fatal("required name cleared")
	}
	if d.Apply(actor, c.ReviewPatch{ExpectedRevision: 1, Decisions: []c.Decision{{Path: "/identity/display_name", Status: c.Edited, Value: json.RawMessage(`"Corrected"`)}}}, asOf) != nil {
		t.Fatal("valid correction rejected")
	}
	plan, e := v.PrepareConfirmation(d, actor, 2, &asOf, asOf)
	if e != nil {
		t.Fatal(e)
	}
	change := plan.Changes[0]
	if string(change.OriginalValue) != `"Synthetic"` || change.Provenance.Reference != "line_1" || *change.Confidence != 0.8 || change.ReviewedBy != candidateID || change.ReviewedAt.IsZero() {
		t.Fatal("lineage lost or response mutated draft")
	}
	*plan.Changes[0].Confidence = 0.2
	again, _ := v.ReadReview(d, actor, asOf)
	if *again.Fields["/identity/display_name"].Metadata.Confidence != 0.8 {
		t.Fatal("confirmation plan aliases draft")
	}
}

func TestReviewPatchStrictDecoding(t *testing.T) {
	for _, raw := range []string{`{"Expected_Revision":0,"decisions":[]}`, `{"expected_revision":0,"expected_revision":1}`, `{"expected_revision":0,"candidate_id":"foreign"}`, `{"decisions":[{"path":"/identity/display_name","status":"edited","value":"x","role":"admin"}]}`} {
		if _, e := c.DecodeReviewPatch([]byte(raw)); e == nil {
			t.Fatal("ambiguous review payload accepted")
		}
	}
}

func TestParserCannotSupplyServerRecordIDsAndLocationIDsAreValidated(t *testing.T) {
	v := validator(t)
	p := result(c.ProfileData{Employment: []c.Employment{{ExperienceID: ptr("40000000-0000-4000-8000-000000000001")}}})
	if !hasCode(v.ValidateResult(p, asOf), "PARSER_SYSTEM_FIELD_FORBIDDEN") {
		t.Fatal("parser supplied authoritative record identity")
	}
	if _, e := v.NewReviewDraft(c.Actor{UserID: candidateID, Role: "candidate"}, p, asOf); e == nil {
		t.Fatal("server identity entered review")
	}
	p = result(c.ProfileData{Identity: c.Identity{DisplayName: ptr("Synthetic")}})
	p.Resume.Purpose = ptr("invalid")
	if _, e := v.NewReviewDraft(c.Actor{UserID: candidateID, Role: "candidate"}, p, asOf); e == nil {
		t.Fatal("invalid operational enum entered value review")
	}
	data := c.ProfileData{Location: c.LocationPreferences{Current: &c.Location{ID: ptr("storage-path")}}}
	if !hasCode(v.ValidateData(data, asOf), "INVALID_ID") {
		t.Fatal("location accepted noncanonical identifier")
	}
}

func TestJSONSchemaExportsAreDeterministicAndCurrent(t *testing.T) {
	for _, kind := range []string{"candidate_profile", "parser_result", "review_view", "review_patch"} {
		t.Run(kind, func(t *testing.T) {
			raw, e := c.JSONSchema(kind)
			if e != nil {
				t.Fatal(e)
			}
			second, _ := c.JSONSchema(kind)
			if string(raw) != string(second) {
				t.Fatal("nondeterministic schema")
			}
			stored, e := os.ReadFile(filepath.Join("..", "..", "..", "..", "docs", "contracts", kind+".v1.schema.json"))
			if e != nil {
				t.Fatal(e)
			}
			var a, b any
			if json.Unmarshal(raw, &a) != nil || json.Unmarshal(stored, &b) != nil || !reflect.DeepEqual(a, b) {
				t.Fatal("exported schema drift; regenerate using go run ./cmd/profile-schema")
			}
			doc := a.(map[string]any)
			defs := doc["$defs"].(map[string]any)
			for _, value := range defs {
				d := value.(map[string]any)
				if d["additionalProperties"] != false {
					t.Fatal("object is open to unknown/private fields")
				}
			}
		})
	}
	if _, e := c.JSONSchema("provider_specific"); e == nil {
		t.Fatal("unknown schema accepted")
	}
}
