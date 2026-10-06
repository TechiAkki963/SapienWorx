package candidate

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

// ProfileContractJSON is the same contract imported by the frontend validator.
//
//go:embed profile_contract.json
var ProfileContractJSON []byte

type profileContract struct {
	Countries  string
	Currencies []string
	Limits     map[string]float64
	Months     []string
}

var profileRules = func() profileContract {
	var c profileContract
	if err := json.Unmarshal(ProfileContractJSON, &c); err != nil {
		panic(err)
	}
	return c
}()

type ProfileValidationError struct{ Fields map[string]string }

func (e *ProfileValidationError) Error() string { return "profile validation failed" }
func validationResult(fields map[string]string) error {
	if len(fields) > 0 {
		return &ProfileValidationError{fields}
	}
	return nil
}
func supported(value string, items []string) bool {
	for _, v := range items {
		if value == v {
			return true
		}
	}
	return false
}
func validateText(fields map[string]string, path, value string, max int, required bool) {
	if required && strings.TrimSpace(value) == "" {
		fields[path] = "This field is required."
	} else if utf8.RuneCountInString(value) > max {
		fields[path] = fmt.Sprintf("Use %d characters or fewer.", max)
	}
}
func ValidateProfile(input *ProfileUpdate) error {
	fields := map[string]string{}
	input.FullName = strings.TrimSpace(input.FullName)
	input.Headline = strings.TrimSpace(input.Headline)
	input.CurrentCity = strings.TrimSpace(input.CurrentCity)
	input.CurrentState = strings.TrimSpace(input.CurrentState)
	input.CountryCode = strings.ToUpper(strings.TrimSpace(input.CountryCode))
	validateText(fields, "full_name", input.FullName, 160, true)
	validateText(fields, "headline", input.Headline, 240, false)
	validateText(fields, "current_city", input.CurrentCity, 120, false)
	validateText(fields, "current_state", input.CurrentState, 120, false)
	if !supported(input.CountryCode, strings.Fields(profileRules.Countries)) {
		fields["country_code"] = "Select a valid country."
	}
	if input.TotalExperienceMonths < 0 || input.TotalExperienceMonths > int(profileRules.Limits["max_experience_months"]) {
		fields["total_experience_months"] = "Use an experience value between 0 and 960 months."
	}
	if input.NoticePeriodDays != nil && (*input.NoticePeriodDays < 0 || *input.NoticePeriodDays > 730) {
		fields["notice_period_days"] = "Use a notice period between 0 and 730 days."
	}
	return validationResult(fields)
}

func numeric(value any) (float64, bool) {
	switch v := value.(type) {
	case float64:
		return v, !math.IsNaN(v) && !math.IsInf(v, 0)
	case int:
		return float64(v), true
	case string:
		n, e := strconv.ParseFloat(strings.TrimSpace(v), 64)
		return n, e == nil && !math.IsNaN(n) && !math.IsInf(n, 0)
	default:
		return 0, false
	}
}
func recordString(record map[string]any, key string) string {
	v := record[key]
	if v == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprint(v))
}
func monthIndex(value string) int {
	if n, e := strconv.Atoi(value); e == nil && n >= 1 && n <= 12 {
		return n - 1
	}
	for i, m := range profileRules.Months {
		if len(value) >= 3 && strings.EqualFold(value[:3], m) {
			return i
		}
	}
	return -1
}
func recordMonth(record map[string]any, yearKey, monthKey string) (int, bool) {
	y, e := strconv.Atoi(recordString(record, yearKey))
	m := monthIndex(recordString(record, monthKey))
	return y*12 + m, e == nil && y >= 1900 && y <= 2100 && m >= 0
}
func isCurrent(record map[string]any) bool {
	return strings.EqualFold(recordString(record, "current_company"), "yes") || record["current_company"] == true
}

// EmploymentExperience counts elapsed calendar months, merging overlapping roles.
// A nil result means there is no complete structured history; callers retain the manual fallback.
func EmploymentExperience(details map[string]any, now time.Time) *int {
	items, _ := details["employment"].([]any)
	type span struct{ start, end int }
	var ranges []span
	for _, item := range items {
		r, ok := item.(map[string]any)
		if !ok {
			return nil
		}
		start, ok := recordMonth(r, "joining_year", "joining_month")
		if !ok {
			return nil
		}
		end, ok := recordMonth(r, "end_year", "end_month")
		if isCurrent(r) {
			end = now.Year()*12 + int(now.Month()) - 1
			ok = true
		}
		if !ok || end < start {
			return nil
		}
		ranges = append(ranges, span{start, end})
	}
	if len(ranges) == 0 {
		return nil
	}
	covered := map[int]bool{}
	for _, r := range ranges {
		for m := r.start; m < r.end; m++ {
			covered[m] = true
		}
	}
	n := len(covered)
	return &n
}

var postalPattern = regexp.MustCompile(`^[\p{L}\p{N}][\p{L}\p{N} -]{1,15}$`)

func ValidateProfileDetails(input *ProfileDetailsUpdate, previous map[string]any, now time.Time) error {
	fields := map[string]string{}
	for _, s := range []struct {
		key   string
		value *float64
	}{{"current_salary_amount", input.CurrentSalaryAmount}, {"expected_salary_amount", input.ExpectedSalaryAmount}} {
		if s.value != nil && (*s.value < 0 || *s.value > profileRules.Limits["max_salary"] || math.IsNaN(*s.value) || math.IsInf(*s.value, 0)) {
			fields[s.key] = "Enter a non-negative salary within the supported range."
		}
	}
	for _, c := range []struct {
		key   string
		value *string
	}{{"current_salary_currency", &input.CurrentSalaryCurrency}, {"expected_salary_currency", &input.ExpectedSalaryCurrency}} {
		if *c.value == "" {
			*c.value = "INR"
		}
		*c.value = strings.ToUpper(strings.TrimSpace(*c.value))
		if !supported(*c.value, profileRules.Currencies) {
			fields[c.key] = "Select a supported currency."
		}
	}
	if input.AlternatePhoneE164 != nil {
		v := strings.TrimSpace(*input.AlternatePhoneE164)
		input.AlternatePhoneE164 = &v
		if v != "" && !alternatePhonePattern.MatchString(v) {
			fields["alternate_phone_e164"] = "Use international E.164 format, for example +919876543210."
		}
	}
	if input.Details == nil {
		input.Details = map[string]any{}
	}
	raw, e := json.Marshal(input.Details)
	if e != nil || len(raw) > 128*1024 {
		fields["details"] = "Profile details must be a valid object smaller than 128 KB."
	}
	for key, value := range input.Details {
		// Existing legacy values remain intact during unrelated section edits.
		if reflect.DeepEqual(value, previous[key]) {
			continue
		}
		validateReferenceField(fields, key, value, previous[key], now)
		textFields := []string{"current_designation", "professional_summary", "employment_highlights", "interested_domains", "preferred_locations", "department_role", "industry", "gender", "marital_status", "date_of_birth", "category", "other_work_permits", "permanent_address", "hometown", "pincode", "disability_status", "disability_details", "military_experience", "career_break"}
		if supported(key, textFields) {
			if _, ok := value.(string); !ok {
				fields[key] = "Use text for this field."
				continue
			}
		}
		if _, ok := value.(string); ok {
			max := 240
			if supported(key, []string{"professional_summary", "employment_highlights", "projects", "accomplishments", "professional_links", "disability_details", "career_break", "military_experience", "permanent_address"}) {
				max = 5000
			}
			validateText(fields, key, value.(string), max, false)
		}
		switch key {
		case "private_contact", "profile_visible_in_sourcing":
			if _, ok := value.(bool); !ok {
				fields[key] = "Use a boolean privacy choice."
			}
		case "secondary_phone":
			v, ok := value.(string)
			if !ok || (v != "" && !alternatePhonePattern.MatchString(v)) {
				fields[key] = "Use international E.164 format."
			}
		case "date_of_birth":
			v, ok := value.(string)
			if !ok {
				fields[key] = "Use a valid date."
				break
			}
			if v != "" {
				date, err := time.Parse("2006-01-02", v)
				if err != nil || date.After(now) || date.Before(time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC)) {
					fields[key] = "Use a valid birth date in the past."
				}
			}
		case "pincode":
			v, ok := value.(string)
			if !ok || (v != "" && !postalPattern.MatchString(v)) {
				fields[key] = "Use a valid postal code (2–16 letters, digits, spaces or hyphens)."
			}
		case "professional_links":
			if v, ok := value.(string); ok {
				links := strings.FieldsFunc(v, func(r rune) bool { return r == '\n' || r == ',' })
				if len(links) > 20 {
					fields[key] = "Add no more than 20 links."
				}
				for _, link := range links {
					u, err := url.Parse(strings.TrimSpace(link))
					if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil {
						fields[key] = "Use HTTPS links without embedded credentials."
					}
				}
			} else {
				validateProfessionalRecords(fields, key, value, previous[key])
			}
		case "projects", "accomplishments":
			if _, ok := value.(string); !ok {
				validateProfessionalRecords(fields, key, value, previous[key])
			}
		case "employment", "education", "it_skills", "languages":
			items, ok := value.([]any)
			if !ok {
				fields[key] = "Use a list of profile items."
				break
			}
			if len(items) > int(profileRules.Limits[key]) {
				fields[key] = fmt.Sprintf("Add no more than %d items.", int(profileRules.Limits[key]))
				break
			}
			for i, item := range items {
				// Keeping or deleting a different item must not force a legacy record migration.
				unchanged := false
				oldItems, _ := previous[key].([]any)
				for _, oldItem := range oldItems {
					if reflect.DeepEqual(item, oldItem) {
						unchanged = true
						break
					}
				}
				if unchanged {
					continue
				}
				r, ok := item.(map[string]any)
				prefix := fmt.Sprintf("%s[%d].", key, i)
				if !ok {
					fields[strings.TrimSuffix(prefix, ".")] = "Use a valid profile item."
					continue
				}
				for k, v := range r {
					if supported(k, []string{"company", "job_title", "level", "university", "name", "language", "job_profile", "grading_system", "score", "last_used", "location", "achievements"}) {
						if _, ok := v.(string); !ok {
							fields[prefix+k] = "Use text for this field."
						}
					}
					if s, ok := v.(string); ok {
						max := 240
						if k == "job_profile" {
							max = 5000
						}
						if key == "employment" && k == "location" {
							max = 120
						}
						if key == "employment" && k == "achievements" {
							max = 4000
						}
						validateText(fields, prefix+k, s, max, false)
					}
				}
				switch key {
				case "employment":
					validateText(fields, prefix+"company", recordString(r, "company"), 240, true)
					validateText(fields, prefix+"job_title", recordString(r, "job_title"), 240, true)
					start, valid := recordMonth(r, "joining_year", "joining_month")
					if !valid {
						fields[prefix+"joining_month"] = "Select a valid start month and year."
					} else if start > now.Year()*12+int(now.Month())-1 {
						fields[prefix+"joining_month"] = "Start date cannot be in the future."
					}
					if isCurrent(r) {
						if recordString(r, "end_year") != "" || recordString(r, "end_month") != "" {
							fields[prefix+"end_month"] = "A current role cannot have an end date."
						}
						r["end_year"] = nil
						r["end_month"] = nil
					} else {
						end, validEnd := recordMonth(r, "end_year", "end_month")
						if !validEnd {
							fields[prefix+"end_month"] = "Select a valid end month and year."
						} else if valid && end < start {
							fields[prefix+"joining_month"] = "Start date cannot be after end date."
						} else if end > now.Year()*12+int(now.Month())-1 {
							fields[prefix+"end_month"] = "End date cannot be in the future."
						}
					}
					if salary := recordString(r, "current_salary"); salary != "" {
						n, ok := numeric(salary)
						if !ok || n < 0 || n > profileRules.Limits["max_salary"] {
							fields[prefix+"current_salary"] = "Enter a non-negative salary."
						}
					}
				case "education":
					validateText(fields, prefix+"level", recordString(r, "level"), 240, true)
					validateText(fields, prefix+"university", recordString(r, "university"), 240, true)
					start, errStart := strconv.Atoi(recordString(r, "start_year"))
					end, errEnd := strconv.Atoi(recordString(r, "end_year"))
					if recordString(r, "start_year") != "" && (errStart != nil || start < 1900 || start > 2100) {
						fields[prefix+"start_year"] = "Select a valid year."
					}
					if recordString(r, "end_year") != "" && (errEnd != nil || end < 1900 || end > 2100) {
						fields[prefix+"end_year"] = "Select a valid year."
					}
					if errStart == nil && errEnd == nil && start > end {
						fields[prefix+"start_year"] = "Start year cannot be after end year."
					}
					score := recordString(r, "score")
					if score != "" {
						system := strings.ToLower(recordString(r, "grading_system"))
						max := 100.0
						if strings.Contains(system, "10") {
							max = 10
						} else if strings.Contains(system, "4") {
							max = 4
						}
						if system == "letter grade" {
							if !regexp.MustCompile(`^[A-F][+-]?$`).MatchString(strings.ToUpper(score)) {
								fields[prefix+"score"] = "Use a letter grade from A to F."
							}
						} else {
							n, ok := numeric(strings.TrimSuffix(score, "%"))
							if !ok || n < 0 || n > max {
								fields[prefix+"score"] = fmt.Sprintf("Enter a score between 0 and %g.", max)
							}
						}
					}
				case "it_skills":
					validateText(fields, prefix+"name", recordString(r, "name"), 120, true)
					years, months := 0.0, 0.0
					for _, k := range []string{"experience_years", "experience_months"} {
						if recordString(r, k) == "" {
							continue
						}
						n, ok := numeric(r[k])
						if !ok || n < 0 || math.Trunc(n) != n || n > 960 {
							fields[prefix+k] = "Use a non-negative whole number."
						}
						if k == "experience_years" {
							years = n
						} else {
							months = n
						}
					}
					total := years*12 + months
					if total > 960 {
						fields[prefix+"experience_months"] = "Use no more than 960 months of experience."
					}
					r["experience_years"] = int(total) / 12
					r["experience_months"] = int(total) % 12
					if v := recordString(r, "last_used"); v != "" {
						y, e := strconv.Atoi(v)
						if e != nil || y < 1900 || y > now.Year() {
							fields[prefix+"last_used"] = "Select a valid year in the past or present."
						}
					}
				case "languages":
					validateText(fields, prefix+"language", recordString(r, "language"), 120, true)
				}
			}
		case "more_information", "usa_work_authorization":
			items, ok := value.([]any)
			if !ok || len(items) > 20 {
				fields[key] = "Use a list with no more than 20 choices."
			}
			for _, item := range items {
				v, ok := item.(string)
				if !ok || utf8.RuneCountInString(v) > 240 {
					fields[key] = "Use text choices of 240 characters or fewer."
				}
			}
		}
	}
	validateReferenceRelationships(fields, input.Details, previous, now)
	return validationResult(fields)
}

func validProfileURL(link string) bool {
	u, err := url.Parse(strings.TrimSpace(link))
	return err == nil && u.Scheme == "https" && u.Hostname() != "" && u.User == nil
}
func validateProfessionalRecords(fields map[string]string, key string, value, previous any) {
	items, ok := value.([]any)
	if !ok || len(items) > 20 {
		fields[key] = "Use a list with no more than 20 entries."
		return
	}
	oldItems, _ := previous.([]any)
	for i, item := range items {
		unchanged := false
		for _, old := range oldItems {
			if reflect.DeepEqual(item, old) {
				unchanged = true
				break
			}
		}
		if unchanged {
			continue
		}
		prefix := fmt.Sprintf("%s[%d].", key, i)
		row, ok := item.(map[string]any)
		if !ok {
			fields[key] = "Use valid professional entries."
			continue
		}
		for k, v := range row {
			if supported(k, []string{"title", "description", "role", "skills", "url", "issuer", "label", "type", "client", "tag", "status", "location", "site", "employment_type", "role_description", "patent_office", "application_number", "completion_id"}) {
				s, ok := v.(string)
				if !ok {
					fields[prefix+k] = "Use text for this field."
					continue
				}
				max := 240
				if k == "description" {
					max = 5000
					if key == "awards" || key == "professional_memberships" {
						max = 4000
					}
				}
				if k == "skills" {
					max = 500
				}
				if k == "role_description" {
					max = 250
				}
				validateText(fields, prefix+k, s, max, false)
			}
		}
		if key == "professional_links" || key == "online_profiles" {
			if !validProfileURL(recordString(row, "url")) {
				fields[prefix+"url"] = "Use an HTTPS link without embedded credentials."
			}
		} else {
			validateText(fields, prefix+"title", recordString(row, "title"), 240, true)
		}
		if link := recordString(row, "url"); link != "" && !validProfileURL(link) {
			fields[prefix+"url"] = "Use an HTTPS link without embedded credentials."
		}
	}
}
