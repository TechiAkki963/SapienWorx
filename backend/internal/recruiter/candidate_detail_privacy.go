package recruiter

// recruiterProfileFields is an explicit allow-list. Candidate profile_details
// also contains private contact, compensation, address and sensitive personal
// attributes, which must not cross the recruiter API boundary.
var recruiterProfileFields = map[string]struct{}{
	"current_designation": {},
	"professional_summary": {},
	"employment_highlights": {},
	"interested_domains": {},
	"preferred_locations": {},
	"department_role": {},
	"industry": {},
	"employment": {},
	"it_skills": {},
	"education": {},
	"projects": {},
	"accomplishments": {},
	"professional_links": {},
	"languages": {},
}

var recruiterEmploymentFields = map[string]struct{}{
	"company": {}, "job_title": {}, "employment_type": {},
	"joining_year": {}, "joining_month": {}, "end_year": {}, "end_month": {},
	"current_company": {}, "skills_used": {}, "job_profile": {},
}

var recruiterSkillFields = map[string]struct{}{
	"name": {}, "version": {}, "last_used": {},
	"experience_years": {}, "experience_months": {}, "proficiency": {},
}

var recruiterEducationFields = map[string]struct{}{
	"level": {}, "education": {}, "university": {}, "specialization": {},
	"course_type": {}, "grading_system": {}, "start_year": {}, "end_year": {},
}

var recruiterLanguageFields = map[string]struct{}{
	"language": {}, "proficiency": {}, "read": {}, "write": {}, "speak": {},
}

func recruiterVisibleCandidateDetails(details map[string]any) map[string]any {
	visible := make(map[string]any)
	for key, value := range details {
		if _, ok := recruiterProfileFields[key]; !ok {
			continue
		}
		switch key {
		case "employment":
			visible[key] = allowListedRecords(value, recruiterEmploymentFields)
		case "it_skills":
			visible[key] = allowListedRecords(value, recruiterSkillFields)
		case "education":
			visible[key] = allowListedRecords(value, recruiterEducationFields)
		case "languages":
			visible[key] = allowListedRecords(value, recruiterLanguageFields)
		default:
			visible[key] = value
		}
	}
	return visible
}

func allowListedRecords(value any, allowed map[string]struct{}) []map[string]any {
	items, ok := value.([]any)
	if !ok {
		return []map[string]any{}
	}
	filtered := make([]map[string]any, 0, len(items))
	for _, item := range items {
		record, ok := item.(map[string]any)
		if !ok {
			continue
		}
		clean := make(map[string]any)
		for key, value := range record {
			if _, ok := allowed[key]; ok {
				clean[key] = value
			}
		}
		filtered = append(filtered, clean)
	}
	return filtered
}
