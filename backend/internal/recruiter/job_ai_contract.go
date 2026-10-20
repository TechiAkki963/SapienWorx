package recruiter

import "math"

// ValidateAIJobProposal applies the existing job domain rules without a write.
// Missing required editor fields are reported separately and never fabricated in
// the returned proposal; temporary placeholders below are validation-only.
func ValidateAIJobProposal(input DetailedJobInput) error {
	if input.MinSalaryLakhs != nil || input.MaxSalaryLakhs != nil {
		return ErrInvalid
	}
	return ValidateAIJobParseProposal(input)
}

// ValidateAIJobParseProposal extends the private parser/review contract only.
// Generation retains its existing exclusion of compensation via the wrapper.
func ValidateAIJobParseProposal(input DetailedJobInput) error {
	if input.Publish || input.InternalNotes != "" || input.AssignedRecruiterID != nil {
		return ErrInvalid
	}
	for _, amount := range []*float64{input.MinSalaryLakhs, input.MaxSalaryLakhs} {
		if amount != nil && (math.IsNaN(*amount) || math.IsInf(*amount, 0)) {
			return ErrInvalid
		}
	}
	copy := input
	if copy.Title == "" {
		copy.Title = "review required"
	}
	if copy.EmploymentType == "" {
		copy.EmploymentType = "full_time"
	}
	if copy.WorkMode == "" {
		copy.WorkMode = "onsite"
	}
	if copy.Openings == 0 {
		copy.Openings = 1
	}
	copy.Visibility = "private"
	return normalizeDetailedJob(&copy)
}
