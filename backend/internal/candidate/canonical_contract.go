package candidate

import (
	"fmt"
	"strconv"
	"strings"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

// CanonicalContractValidator reuses the exact country/currency/limit policy
// already embedded for candidate editors. No second reference list is created.
func CanonicalContractValidator() (*contract.Validator, error) {
	return contract.NewValidator(ProfileContractJSON)
}

// CanonicalSnapshot adapts existing DTOs without reads, writes or route changes.
// verification must come from the existing authenticated account store, never a
// parser result. Missing legacy data stays unknown; names are never split.
func CanonicalSnapshot(p Profile, d ProfileDetails, verification contract.ContactVerification) (contract.CandidateProfile, []contract.Issue) {
	data := contract.ProfileData{}
	data.Identity.DisplayName = contractText(p.FullName)
	data.Contact.PrimaryEmail = contractText(p.Email)
	data.Contact.PrimaryPhone = p.Phone
	data.Contact.AlternatePhone = d.AlternatePhoneE164
	data.Contact.CountryCode = contractText(p.CountryCode)
	data.Professional.Headline = p.Headline
	data.Professional.Summary = contractDetail(d.Details, "professional_summary")
	data.Professional.CurrentDesignation = contractEntity(contractDetail(d.Details, "current_designation"))
	months := p.TotalExperienceMonths
	data.Professional.TotalExperienceMonths = &months
	data.Availability.NoticePeriodDays = p.NoticePeriodDays
	data.Location.Current = &contract.Location{City: p.CurrentCity, State: p.CurrentState, CountryCode: contractText(p.CountryCode)}
	for _, location := range strings.Split(recordString(d.Details, "preferred_locations"), ",") {
		if raw := contractText(location); raw != nil {
			data.Location.Preferred = append(data.Location.Preferred, contract.Location{RawValue: raw})
		}
	}
	status := map[string]string{"employed": "employed", "experienced": "employed", "fresher": "fresher", "student": "student", "unemployed": "unemployed", "self employed": "self_employed", "on career break": "on_career_break"}[strings.ToLower(recordString(d.Details, "work_status"))]
	data.Professional.EmploymentStatus = contractText(status)
	mode := strings.ToLower(recordString(d.Details, "preferred_work_mode"))
	if mode == "onsite" || mode == "hybrid" || mode == "remote" || mode == "flexible" {
		data.Location.RemotePreference = &mode
		if mode != "flexible" {
			data.Preferences.WorkModes = []string{mode}
		}
	}
	for _, r := range contractRecords(d.Details["employment"]) {
		item := contract.Employment{Company: contractEntity(contractDetail(r, "company")), Designation: contractEntity(contractDetail(r, "job_title")), Description: contractDetail(r, "job_profile")}
		item.StartDate = contractLegacyDate(r, "joining_year", "joining_month")
		item.IsCurrent = contractLegacyBool(r["current_company"])
		if item.IsCurrent == nil || !*item.IsCurrent {
			item.EndDate = contractLegacyDate(r, "end_year", "end_month")
		}
		typeName := contractEmploymentType(recordString(r, "employment_type"))
		item.EmploymentType = contractText(typeName)
		for _, skill := range strings.Split(recordString(r, "skills_used"), ",") {
			if name := contractText(skill); name != nil {
				item.Skills = append(item.Skills, contract.Skill{Entity: contractEntity(name)})
			}
		}
		data.Employment = append(data.Employment, item)
	}
	if current, _ := contract.CurrentEmployment(data.Employment, d.ProfileUpdatedAt); current != nil {
		data.Professional.CurrentCompany = current.Company
	}
	seen := map[string]bool{}
	for _, r := range contractRecords(d.Details["it_skills"]) {
		name := contractDetail(r, "name")
		item := contract.Skill{Entity: contractEntity(name), Proficiency: contractDetail(r, "proficiency")}
		if years, ok := numeric(r["experience_years"]); ok {
			if months, ok := numeric(r["experience_months"]); ok {
				n := int(years*12 + months)
				item.ExperienceMonths = &n
			}
		}
		if raw := contractDetail(r, "last_used"); raw != nil {
			item.LastUsed = contract.ParsePartialDate(*raw)
		}
		if name != nil {
			seen[contract.ComparisonKey(*name)] = true
		}
		data.Skills = append(data.Skills, item)
	}
	var keySkills []string
	switch raw := d.Details["key_skills"].(type) {
	case string:
		keySkills = strings.Split(raw, ",")
	case []any:
		for _, x := range raw {
			if s, ok := x.(string); ok {
				keySkills = append(keySkills, s)
			}
		}
	case []string:
		keySkills = raw
	}
	for _, raw := range keySkills {
		if name := contractText(raw); name != nil && !seen[contract.ComparisonKey(*name)] {
			data.Skills = append(data.Skills, contract.Skill{Entity: contractEntity(name)})
			seen[contract.ComparisonKey(*name)] = true
		}
	}
	for _, r := range contractRecords(d.Details["education"]) {
		item := contract.Education{Institution: contractEntity(contractDetail(r, "university")), Qualification: contractEntity(contractDetail(r, "level")), Degree: contractDetail(r, "education"), Specialization: contractDetail(r, "specialization"), Grade: contractDetail(r, "score")}
		item.StartDate = contractLegacyDate(r, "start_year", "")
		item.EndDate = contractLegacyDate(r, "end_year", "")
		if item.EndDate != nil && item.EndDate.Year != nil {
			item.GraduationYear = item.EndDate.Year
		}
		grade := strings.ToLower(recordString(r, "grading_system"))
		switch {
		case strings.Contains(grade, "10"):
			item.GradeType = contractText("cgpa_10")
		case strings.Contains(grade, "4"):
			item.GradeType = contractText("gpa_4")
		case strings.Contains(grade, "percentage"):
			item.GradeType = contractText("percentage")
		case grade == "letter grade":
			item.GradeType = contractText("letter")
		case grade != "":
			item.GradeType = contractText("unstructured")
		}
		data.Education = append(data.Education, item)
	}
	for _, r := range contractRecords(d.Details["languages"]) {
		data.Languages = append(data.Languages, contract.Language{Entity: contractEntity(contractDetail(r, "language")), Proficiency: contractDetail(r, "proficiency"), Read: contractLegacyBool(r["read"]), Write: contractLegacyBool(r["write"]), Speak: contractLegacyBool(r["speak"])})
	}
	for _, r := range contractRecords(d.Details["certifications"]) {
		title := contractDetail(r, "title")
		if title == nil {
			title = contractDetail(r, "name")
		}
		data.Certifications = append(data.Certifications, contract.Certification{Entity: contractEntity(title), IssuingOrganization: contractDetail(r, "issuer"), CredentialURL: contractDetail(r, "url")})
	}
	for _, r := range contractRecords(d.Details["projects"]) {
		title := contractDetail(r, "title")
		if title == nil {
			title = contractDetail(r, "name")
		}
		data.Projects = append(data.Projects, contract.Project{Name: title, Role: contractDetail(r, "role"), Description: contractDetail(r, "description"), URL: contractDetail(r, "url")})
	}
	for _, r := range contractRecords(d.Details["professional_links"]) {
		if url := contractDetail(r, "url"); url != nil {
			data.Links = append(data.Links, contract.Link{Type: "other", Label: contractDetail(r, "label"), URL: *url})
		}
	}
	for _, item := range []struct {
		amount        *float64
		currency, key string
		destination   **contract.Money
	}{{d.CurrentSalaryAmount, d.CurrentSalaryCurrency, "current_salary_unit", &data.Compensation.Current}, {d.ExpectedSalaryAmount, d.ExpectedSalaryCurrency, "expected_salary_unit", &data.Compensation.Expected}} {
		if item.amount != nil {
			amount := strconv.FormatFloat(*item.amount, 'f', 2, 64)
			period := strings.ToLower(recordString(d.Details, item.key))
			if period != "annual" && period != "monthly" {
				period = ""
			}
			*item.destination = &contract.Money{Amount: &amount, Currency: contractText(item.currency), Period: contractText(period)}
		}
	}
	data.Classification.Industries = []contract.EntityRef{}
	if industry := contractDetail(d.Details, "industry"); industry != nil {
		data.Classification.Industries = append(data.Classification.Industries, contractEntity(industry))
	}
	data.Classification.Functions = []contract.EntityRef{}
	if function := contractDetail(d.Details, "department_role"); function != nil {
		data.Classification.Functions = append(data.Classification.Functions, contractEntity(function))
	}
	issues := []contract.Issue{}
	if d.CVOriginalFilename != nil {
		issues = append(issues, contract.Issue{Severity: "info", Code: "LEGACY_RESUME_NEEDS_STABLE_ID", Path: "/resumes"})
	}
	for _, key := range []string{"projects", "certifications", "professional_links", "accomplishments"} {
		if raw, ok := d.Details[key].(string); ok && strings.TrimSpace(raw) != "" {
			issues = append(issues, contract.Issue{Severity: "warning", Code: "LEGACY_UNSTRUCTURED_SECTION", Path: "/" + key})
		}
	}
	return contract.CandidateProfile{SchemaVersion: contract.Version, CandidateID: p.UserID, UpdatedAt: &d.ProfileUpdatedAt, Profile: contract.NormalizeData(data), Verification: verification, Resumes: []contract.ResumeMetadata{}}, issues
}

func contractText(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
func contractDetail(m map[string]any, key string) *string {
	value, ok := m[key].(string)
	if !ok {
		return nil
	}
	return contractText(value)
}
func contractEntity(name *string) contract.EntityRef {
	var raw *string
	if name != nil {
		x := *name
		raw = &x
	}
	return contract.EntityRef{Name: name, RawValue: raw}
}
func contractRecords(value any) []map[string]any {
	var rows []map[string]any
	switch items := value.(type) {
	case []any:
		for _, item := range items {
			if row, ok := item.(map[string]any); ok {
				rows = append(rows, row)
			}
		}
	case []map[string]any:
		rows = items
	}
	return rows
}
func contractLegacyBool(value any) *bool {
	switch x := value.(type) {
	case bool:
		return &x
	case string:
		s := strings.ToLower(strings.TrimSpace(x))
		if s == "yes" || s == "true" || s == "no" || s == "false" {
			b := s == "yes" || s == "true"
			return &b
		}
	}
	return nil
}
func contractLegacyDate(row map[string]any, yearKey, monthKey string) *contract.PartialDate {
	year := recordString(row, yearKey)
	if year == "" {
		return nil
	}
	if monthKey != "" {
		month := recordString(row, monthKey)
		if month != "" {
			if index := monthIndex(month); index >= 0 {
				return contract.ParsePartialDate(fmt.Sprintf("%s-%02d", year, index+1))
			}
			return contract.ParsePartialDate(month + " " + year)
		}
	}
	return contract.ParsePartialDate(year)
}
func contractEmploymentType(s string) string {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "full-time", "full time", "full_time", "permanent":
		return "full_time"
	case "part-time", "part time", "part_time":
		return "part_time"
	case "contract", "contractual":
		return "contract"
	case "internship":
		return "internship"
	case "temporary":
		return "temporary"
	}
	return ""
}
