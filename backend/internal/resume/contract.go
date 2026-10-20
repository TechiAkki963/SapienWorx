package resume

import (
	"strings"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

// CanonicalProposal adapts an already-produced legacy preview. It never calls
// Parse, reads a file, sends data externally or updates an authoritative profile.
// IDs and resume metadata are supplied by the trusted upload workflow, not CV text.
func CanonicalProposal(preview Preview, candidateID, resultID string, source contract.ResumeMetadata, at time.Time) contract.ParserResult {
	text := func(s string) *string {
		if strings.TrimSpace(s) == "" {
			return nil
		}
		copy := s
		return &copy
	}
	entity := func(s string) contract.EntityRef { return contract.EntityRef{Name: text(s), RawValue: text(s)} }
	data := contract.ProfileData{}
	data.Identity.DisplayName = text(preview.Fields["full_name"].Value)
	data.Contact.PrimaryEmail = text(preview.Fields["email"].Value)
	data.Contact.PrimaryPhone = text(preview.Fields["phone"].Value)
	data.Professional.Headline = text(preview.Fields["headline"].Value)
	data.Professional.Summary = text(preview.Fields["professional_summary"].Value)
	if city, state := text(preview.Fields["current_city"].Value), text(preview.Fields["current_state"].Value); city != nil || state != nil {
		data.Location.Current = &contract.Location{City: city, State: state}
	}
	for _, skill := range preview.Skills {
		data.Skills = append(data.Skills, contract.Skill{Entity: entity(skill.Value)})
	}
	for _, job := range preview.Employment {
		item := contract.Employment{Company: entity(job.Company), Designation: entity(job.Role)}
		if job.Start != "" {
			item.StartDate = contract.ParsePartialDate(job.Start)
		}
		if strings.EqualFold(strings.TrimSpace(job.End), "present") || strings.EqualFold(strings.TrimSpace(job.End), "current") {
			b := true
			item.IsCurrent = &b
		} else if job.End != "" {
			b := false
			item.IsCurrent = &b
			item.EndDate = contract.ParsePartialDate(job.End)
		}
		data.Employment = append(data.Employment, item)
	}
	for _, education := range preview.Education {
		item := contract.Education{Institution: entity(education.Institution), Qualification: entity(education.Degree), Degree: text(education.Degree)}
		if education.Year != "" {
			item.EndDate = contract.ParsePartialDate(education.Year)
			item.GraduationYear = item.EndDate.Year
		}
		data.Education = append(data.Education, item)
	}
	for _, url := range preview.Links {
		data.Links = append(data.Links, contract.Link{Type: "other", URL: url})
	}
	issues := []contract.Issue{{Severity: "info", Code: "LEGACY_CONFIDENCE_UNCALIBRATED", Path: "/field_metadata"}}
	current, currentIssues := contract.CurrentEmployment(data.Employment, at)
	issues = append(issues, currentIssues...)
	if current != nil {
		data.Professional.CurrentCompany = current.Company
		data.Professional.CurrentDesignation = current.Designation
	}
	// Legacy aggregate duration can contain January assumptions/inclusive end
	// months; use only the canonical conservative calculation for the new contract.
	calculation := contract.CalculateExperience(data.Employment, at)
	data.Professional.TotalExperienceMonths = calculation.Months
	issues = append(issues, calculation.Issues...)
	metadata := contract.ProposedMetadata(data, "resume")
	for path, field := range metadata {
		if path == "/professional/total_experience_months" || strings.HasPrefix(path, "/professional/current_company/") || strings.HasPrefix(path, "/professional/current_designation/") {
			field.Provenance.Kind = "derived"
			field.Provenance.Reference = "employment"
			metadata[path] = field
		}
	}
	return contract.ParserResult{ContractVersion: contract.Version, ProfileSchemaVersion: contract.Version, ResultID: resultID, CandidateID: candidateID, Resume: source, ParserProvider: "local_preview", ParserVersion: "legacy-preview-v1", SourceType: "resume", Status: contract.ReadyForReview, Profile: data, FieldMetadata: metadata, Issues: issues, CreatedAt: at.UTC()}
}
