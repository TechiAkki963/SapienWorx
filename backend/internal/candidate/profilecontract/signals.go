package profilecontract

import "strings"

// ProfessionalSignals is a closed, data-only projection for future consumers.
// No ranking/scoring/search implementation is introduced. Consumers must still
// enforce discovery, application scope, consent and company authorization.
type ProfessionalSignals struct {
	Skills             []EntityRef        `json:"skills"`
	Employment         []EmploymentSignal `json:"employment"`
	Qualifications     []EntityRef        `json:"qualifications"`
	ExperienceMonths   *int               `json:"experience_months"`
	CurrentLocation    *SearchLocation    `json:"current_location"`
	PreferredLocations []SearchLocation   `json:"preferred_locations"`
	NoticePeriodDays   *int               `json:"notice_period_days"`
	Classification     Classification     `json:"classification"`
	Seniority          *string            `json:"seniority"`
}
type SearchLocation struct {
	ID          *string `json:"id"`
	City        *string `json:"city"`
	State       *string `json:"state"`
	CountryCode *string `json:"country_code"`
}
type EmploymentSignal struct {
	Company     EntityRef `json:"company"`
	Designation EntityRef `json:"designation"`
}

// Signals accepts the authoritative type only. It excludes contact, identity,
// salary, photos, protected attributes, raw values, confidence and provider data.
func Signals(p CandidateProfile) ProfessionalSignals {
	p.Profile = cloneData(p.Profile)
	clean := func(e EntityRef) EntityRef { e.RawValue = nil; return e }
	location := func(l Location) SearchLocation { return SearchLocation{l.ID, l.City, l.State, l.CountryCode} }
	s := ProfessionalSignals{Skills: []EntityRef{}, Employment: []EmploymentSignal{}, Qualifications: []EntityRef{}, PreferredLocations: []SearchLocation{}, ExperienceMonths: p.Profile.Professional.TotalExperienceMonths, NoticePeriodDays: p.Profile.Availability.NoticePeriodDays, Seniority: p.Profile.Professional.Seniority}
	for _, skill := range p.Profile.Skills {
		s.Skills = append(s.Skills, clean(skill.Entity))
	}
	for _, job := range p.Profile.Employment {
		s.Employment = append(s.Employment, EmploymentSignal{clean(job.Company), clean(job.Designation)})
	}
	for _, education := range p.Profile.Education {
		s.Qualifications = append(s.Qualifications, clean(education.Qualification))
	}
	if p.Profile.Location.Current != nil {
		l := location(*p.Profile.Location.Current)
		s.CurrentLocation = &l
	}
	for _, l := range p.Profile.Location.Preferred {
		s.PreferredLocations = append(s.PreferredLocations, location(l))
	}
	s.Classification = p.Profile.Classification
	for _, list := range [][]EntityRef{s.Classification.Industries, s.Classification.Functions, s.Classification.Roles, s.Classification.Domains} {
		for i := range list {
			list[i] = clean(list[i])
		}
	}
	return s
}

func FieldClassification(path string) string {
	switch {
	case strings.HasPrefix(path, "/identity/") || strings.HasPrefix(path, "/contact/"):
		return "contact_pii"
	case strings.HasPrefix(path, "/compensation/"):
		return "compensation"
	case strings.HasPrefix(path, "/employment/"):
		return "employment"
	case strings.HasPrefix(path, "/education/"):
		return "education"
	case strings.HasPrefix(path, "/professional/") || strings.HasPrefix(path, "/skills/") || strings.HasPrefix(path, "/location/") || strings.HasPrefix(path, "/preferences/") || strings.HasPrefix(path, "/availability/") || strings.HasPrefix(path, "/classification/") || strings.HasPrefix(path, "/work_authorization/") || strings.HasPrefix(path, "/certifications/") || strings.HasPrefix(path, "/projects/") || strings.HasPrefix(path, "/languages/") || strings.HasPrefix(path, "/links/") || strings.HasPrefix(path, "/publications/") || strings.HasPrefix(path, "/patents/") || strings.HasPrefix(path, "/awards/") || strings.HasPrefix(path, "/honors/"):
		return "profile"
	default:
		return "system_metadata"
	}
}
