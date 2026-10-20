package profilecontract_test

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"

	c "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

func confirmDecisions(data c.ProfileData) []c.Decision {
	var out []c.Decision
	for path := range c.FieldValues(data) {
		out = append(out, c.Decision{Path: path, Status: c.ReviewConfirmed})
	}
	return out
}

func TestCandidateReviewKeepsOriginalAndCreatesOnlyExplicitChanges(t *testing.T) {
	v := validator(t)
	p := result(c.ProfileData{Identity: c.Identity{DisplayName: ptr("Original")}, Professional: c.Professional{Headline: ptr("Developer")}, Contact: c.Contact{PrimaryEmail: ptr("synthetic@example.test")}})
	actor := c.Actor{UserID: candidateID, Role: "candidate"}
	draft, e := v.NewReviewDraft(actor, p, asOf)
	if e != nil {
		t.Fatal(e)
	}
	decisions := confirmDecisions(p.Profile)
	for i := range decisions {
		if decisions[i].Path == "/professional/headline" {
			decisions[i].Status = c.Edited
			decisions[i].Value = json.RawMessage(`"Senior Engineer"`)
		}
	}
	if draft.Apply(actor, c.ReviewPatch{ExpectedRevision: 0, Decisions: decisions}, asOf) != nil {
		t.Fatal("review rejected")
	}
	if *p.Profile.Professional.Headline != "Developer" {
		t.Fatal("review overwrote parser source")
	}
	plan, e := v.PrepareConfirmation(draft, actor, 1, &asOf, asOf)
	if e != nil {
		t.Fatal(e)
	}
	if len(plan.Changes) != 2 || len(plan.ContactSuggestions) != 1 {
		t.Fatal("profile/contact update boundaries collapsed")
	}
	for _, change := range plan.Changes {
		if change.Path == "/professional/headline" && (change.HumanProvenance == nil || change.HumanProvenance.Source != "candidate_input" || change.HumanProvenance.Kind != "manual" || change.HumanConfidence != nil) {
			t.Fatal("human correction inherited provider provenance/confidence")
		}
		if change.Path == "/professional/headline" && (string(change.OriginalValue) != `"Developer"` || string(change.Value) != `"Senior Engineer"` || change.Status != c.Edited) {
			t.Fatal("parsed/corrected lineage lost")
		}
		if strings.HasPrefix(change.Path, "/contact/") {
			t.Fatal("contact bypassed account verification flow")
		}
	}
	if e = draft.Apply(actor, c.ReviewPatch{ExpectedRevision: 0, Decisions: decisions}, asOf); !errors.Is(e, c.ErrConflict) {
		t.Fatal("stale review accepted")
	}
	if _, e = v.PrepareConfirmation(draft, actor, 1, nil, asOf); e == nil {
		t.Fatal("missing profile concurrency guard accepted")
	}
}

func TestReviewCannotCrossOwnersOrRoles(t *testing.T) {
	v := validator(t)
	p := result(c.ProfileData{Identity: c.Identity{DisplayName: ptr("Private")}})
	owner := c.Actor{UserID: candidateID, Role: "candidate"}
	draft, e := v.NewReviewDraft(owner, p, asOf)
	if e != nil {
		t.Fatal(e)
	}
	for _, actor := range []c.Actor{{UserID: "10000000-0000-4000-8000-000000000002", Role: "candidate"}, {UserID: candidateID, Role: "recruiter"}, {UserID: candidateID, Role: "master_admin"}, {Role: "candidate"}} {
		if _, e := v.NewReviewDraft(actor, p, asOf); !errors.Is(e, c.ErrForbidden) {
			t.Fatal("foreign owner/role read proposal")
		}
		if e := draft.Apply(actor, c.ReviewPatch{Decisions: confirmDecisions(p.Profile)}, asOf); !errors.Is(e, c.ErrForbidden) {
			t.Fatal("foreign owner/role edited proposal")
		}
		if _, e := v.PrepareConfirmation(draft, actor, 0, &asOf, asOf); !errors.Is(e, c.ErrForbidden) {
			t.Fatal("foreign owner/role confirmed proposal")
		}
	}
}

func TestReviewBatchAtomicityAndServerFieldProtection(t *testing.T) {
	v := validator(t)
	p := result(c.ProfileData{Identity: c.Identity{DisplayName: ptr("Original")}})
	actor := c.Actor{UserID: candidateID, Role: "candidate"}
	for _, path := range []string{"/candidate_id", "/verification/email_verified", "/discoverable_to_recruiters", "/identity/unknown", "/identity/display_name/anything"} {
		draft, _ := v.NewReviewDraft(actor, p, asOf)
		e := draft.Apply(actor, c.ReviewPatch{Decisions: []c.Decision{{Path: "/identity/display_name", Status: c.Edited, Value: json.RawMessage(`"Changed"`)}, {Path: path, Status: c.ReviewConfirmed}}}, asOf)
		if e == nil || draft.Revision() != 0 {
			t.Fatal("unsafe batch partially applied")
		}
	}
	draft, _ := v.NewReviewDraft(actor, p, asOf)
	if draft.Apply(actor, c.ReviewPatch{Decisions: []c.Decision{{Path: "/identity/display_name", Status: c.Edited, Value: json.RawMessage(`42`)}}}, asOf) == nil {
		t.Fatal("wrong field type accepted")
	}
	if _, e := v.PrepareConfirmation(draft, actor, 0, &asOf, asOf); e == nil {
		t.Fatal("unreviewed parser data promoted")
	}
}

func TestOptionalInvalidFieldCanBeRejectedWithoutDiscardingCV(t *testing.T) {
	v := validator(t)
	p := result(c.ProfileData{Identity: c.Identity{DisplayName: ptr("Synthetic")}, Contact: c.Contact{PrimaryEmail: ptr("invalid-email")}})
	actor := c.Actor{UserID: candidateID, Role: "candidate"}
	draft, e := v.NewReviewDraft(actor, p, asOf)
	if e != nil {
		t.Fatal("optional value error discarded whole CV")
	}
	decisions := confirmDecisions(p.Profile)
	for i := range decisions {
		if decisions[i].Path == "/contact/primary_email" {
			decisions[i].Status = c.Rejected
		}
	}
	if e = draft.Apply(actor, c.ReviewPatch{Decisions: decisions}, asOf); e != nil {
		t.Fatal(e)
	}
	plan, e := v.PrepareConfirmation(draft, actor, 1, &asOf, asOf)
	if e != nil || plan.RejectedCount != 1 || len(plan.Changes) != 1 || len(plan.ContactSuggestions) != 0 {
		t.Fatal("rejected field became authoritative")
	}
}

func TestProposedSummaryNeverSilentlyReplacesCandidateSummary(t *testing.T) {
	v := validator(t)
	p := result(c.ProfileData{Professional: c.Professional{Summary: ptr("Candidate-authored summary")}})
	p.ParserGeneratedSummary = ptr("Generated suggestion")
	p.FieldMetadata["/parser_generated_summary"] = c.FieldMetadata{Provenance: c.Provenance{Source: "ai_derived", Kind: "derived", Section: "summary", Reference: "generated_summary"}, Review: c.Unreviewed}
	actor := c.Actor{UserID: candidateID, Role: "candidate"}
	draft, e := v.NewReviewDraft(actor, p, asOf)
	if e != nil {
		t.Fatal(e)
	}
	decisions := append(confirmDecisions(p.Profile), c.Decision{Path: "/parser_generated_summary", Status: c.ReviewConfirmed})
	if draft.Apply(actor, c.ReviewPatch{Decisions: decisions}, asOf) != nil {
		t.Fatal("summary review failed")
	}
	plan, e := v.PrepareConfirmation(draft, actor, 1, &asOf, asOf)
	if e != nil || len(plan.Changes) != 1 || string(plan.Changes[0].Value) != `"Candidate-authored summary"` {
		t.Fatal("generated summary overwrote candidate summary")
	}
}

func TestProfessionalSignalsExcludePIICompensationAndRawParserData(t *testing.T) {
	p := c.CandidateProfile{Profile: c.ProfileData{Identity: c.Identity{DisplayName: ptr("private-name")}, Contact: c.Contact{PrimaryEmail: ptr("private@example.test")}, Compensation: c.Compensation{Current: &c.Money{Amount: ptr("987654.32"), Currency: ptr("INR")}}, Skills: []c.Skill{{Entity: c.EntityRef{Name: ptr("Java"), RawValue: ptr("private-raw")}}}, Classification: c.Classification{Industries: []c.EntityRef{ref("Technology")}}}}
	before, _ := json.Marshal(p)
	signals := c.Signals(p)
	raw, _ := json.Marshal(signals)
	after, _ := json.Marshal(p)
	for _, private := range []string{"private-name", "private@example.test", "987654.32", "private-raw", "verification", "parser_provider"} {
		if strings.Contains(string(raw), private) {
			t.Fatal("private data entered consumer signals")
		}
	}
	if !bytes.Equal(before, after) {
		t.Fatal("signal projection changed authoritative data")
	}
	if c.FieldClassification("/compensation/current/amount") != "compensation" || c.FieldClassification("/contact/primary_email") != "contact_pii" {
		t.Fatal("wrong privacy classification")
	}
}

func TestDiagnosticFormattingWithholdsPrivateContractData(t *testing.T) {
	data := c.ProfileData{Contact: c.Contact{PrimaryEmail: ptr("private@example.test")}}
	p := result(data)
	var log bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&log, nil))
	for _, value := range []any{data, p, c.CandidateProfile{Profile: data}, c.ConfirmationPlan{Changes: []c.ReviewedChange{{Value: json.RawMessage(`"private@example.test"`)}}}} {
		for _, text := range []string{fmt.Sprint(value), fmt.Sprintf("%+v", value), fmt.Sprintf("%#v", value)} {
			if strings.Contains(text, "private@example.test") {
				t.Fatal("diagnostic content leak")
			}
		}
		logger.Info("contract diagnostic", "value", value)
	}
	if strings.Contains(log.String(), "private@example.test") {
		t.Fatal("slog content leak")
	}
}
