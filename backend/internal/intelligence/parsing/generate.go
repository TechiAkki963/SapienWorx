package parsing

import (
	"context"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"regexp"
)

const GeneratorPromptVersion = GenerationPromptVersion

var discriminatory = regexp.MustCompile(`(?i)(male[- ]only|female[- ]only|only (?:men|women|males|females)|under [23][0-9] years|no (?:disabled|pregnant)|(?:religion|caste|race) required)`)

// GenerateJob keeps the earlier internal entry point on the same versioned
// generator. Product HTTP uses the narrow DTO, never the entire job payload.
func (s *Service) GenerateJob(ctx context.Context, in recruiter.DetailedJobInput, consent bool) (Artifact, error) {
	if recruiter.ValidateAIJobProposal(in) != nil {
		return Artifact{}, ErrInvalid
	}
	minimum := in.MinExperienceYears
	return s.GenerateDescription(ctx, JobDescriptionGenerationRequest{Version: "v1", Consent: consent, Fields: GenerationFields{
		Title: in.Title, Location: in.Location, Minimum: &minimum, Maximum: in.MaxExperienceYears,
		EmploymentType: in.EmploymentType, WorkMode: in.WorkMode, Department: in.Department, RoleCategory: in.RoleCategory,
		Skills: in.Skills, Responsibilities: in.Responsibilities, CompanyOverview: in.CompanyOverview, WhyJoin: in.WhyJoin, Education: in.EducationRequirements,
	}})
}
