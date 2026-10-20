package resume

import (
	"bytes"
	"encoding/json"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	c "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

func TestCanonicalProposalAdaptsPreviewWithoutParsingOrAuthority(t *testing.T) {
	preview := Preview{Fields: map[string]Field{"full_name": {Value: "Synthetic", Confidence: "high"}, "email": {Value: "synthetic@example.test", Confidence: "high"}, "date_of_birth": {Value: "1990-01-01"}, "total_experience_months": {Value: "999"}}, Skills: []Field{{Value: "Java", Confidence: "high", Evidence: "Private source excerpt"}}, Employment: []Employment{{Role: "Engineer", Company: "Example", Start: "2021", End: "2023"}}, Education: []Education{{Degree: "BEng", Institution: "Example University", Year: "2020"}}}
	before, _ := json.Marshal(preview)
	now := time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC)
	p := CanonicalProposal(preview, "10000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000001", c.ResumeMetadata{ResumeID: "30000000-0000-4000-8000-000000000001"}, now)
	after, _ := json.Marshal(preview)
	if !bytes.Equal(before, after) {
		t.Fatal("legacy preview mutated")
	}
	if p.Status != c.ReadyForReview || p.Profile.Professional.TotalExperienceMonths != nil || p.Profile.Contact.CountryCode != nil || p.Profile.Identity.FirstName != nil || p.ParserGeneratedSummary != nil {
		t.Fatal("legacy guesses became canonical facts")
	}
	if p.Profile.Employment[0].StartDate.Month != nil || p.Profile.Education[0].EndDate.Precision != "year" {
		t.Fatal("year-only dates gained false precision")
	}
	for _, meta := range p.FieldMetadata {
		if meta.Confidence != nil || meta.Review != c.Unreviewed {
			t.Fatal("uncalibrated confidence/candidate confirmation invented")
		}
	}
	v, e := candidate.CanonicalContractValidator()
	if e != nil || v.ValidateResult(p, now).HasErrors() {
		t.Fatal("adapted proposal invalid")
	}
	encoded, _ := json.Marshal(p)
	if bytes.Contains(encoded, []byte("Private source excerpt")) || bytes.Contains(encoded, []byte("date_of_birth")) {
		t.Fatal("unnecessary source/protected content copied")
	}
}

func TestCanonicalProposalUsesCanonicalExperienceUnion(t *testing.T) {
	now := time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC)
	p := CanonicalProposal(Preview{Employment: []Employment{{Role: "Consultant", Company: "Example A", Start: "Jan 2024", End: "Jan 2025"}, {Role: "Engineer", Company: "Example B", Start: "Jun 2024", End: "Jun 2025"}}}, "10000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000001", c.ResumeMetadata{ResumeID: "30000000-0000-4000-8000-000000000001"}, now)
	if p.Profile.Professional.TotalExperienceMonths == nil || *p.Profile.Professional.TotalExperienceMonths != 17 {
		t.Fatal("legacy inclusive/overlap total leaked into canonical contract")
	}
	if p.FieldMetadata["/professional/total_experience_months"].Provenance.Kind != "derived" {
		t.Fatal("calculated total mislabeled as explicit resume fact")
	}
}

func TestCanonicalProposalDoesNotAssumeFirstEmployerIsCurrent(t *testing.T) {
	preview := Preview{Fields: map[string]Field{"current_company": {Value: "Legacy inferred company"}}, Employment: []Employment{{Role: "Old role", Company: "Former", Start: "Jan 2020", End: "Jan 2022"}, {Role: "Current role", Company: "Current", Start: "Jan 2024", End: "Present"}}}
	p := CanonicalProposal(preview, "10000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000001", c.ResumeMetadata{ResumeID: "30000000-0000-4000-8000-000000000001"}, time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC))
	if p.Profile.Professional.CurrentCompany.Name == nil || *p.Profile.Professional.CurrentCompany.Name != "Current" || p.FieldMetadata["/professional/current_company/name"].Provenance.Kind != "derived" {
		t.Fatal("legacy ordering/inference selected current company")
	}
	preview.Employment = append(preview.Employment, Employment{Company: "Other current", Start: "Feb 2024", End: "Current"})
	p = CanonicalProposal(preview, p.CandidateID, p.ResultID, p.Resume, p.CreatedAt)
	if p.Profile.Professional.CurrentCompany.Name != nil {
		t.Fatal("ambiguous current company guessed")
	}
}
