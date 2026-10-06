package candidate

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"
)

// Reference fields remain candidate-owned JSON. They are never added to public/recruiter allowlists.
func validateReferenceField(fields map[string]string, key string, value, previous any, now time.Time) {
	if key == "preferred_work_mode" || key == "current_salary_unit" || key == "expected_salary_unit" {
		choices := []string{"Onsite", "Hybrid", "Remote", "Flexible"}
		if key != "preferred_work_mode" {
			choices = []string{"Annual", "Monthly"}
		}
		text, ok := value.(string)
		if !ok || (!supported(text, choices) && !(key == "preferred_work_mode" && text == "")) {
			fields[key] = "Select a supported choice."
		}
		return
	}
	if key == "other_work_permits" {
		if s, ok := value.(string); ok && len(strings.Split(s, ",")) > 3 {
			fields[key] = "Choose no more than 3 countries."
		}
	}
	textKeys := []string{"work_status", "locality", "salary_breakdown", "fixed_salary", "variable_salary", "role_category", "job_role", "preferred_job_roles", "preferred_shift", "disability_type", "disability_percentage", "disability_reason", "disability_certificate", "military_service_type", "military_enrolment_date", "military_discharge_date", "military_service_number", "career_break_reason", "career_break_start_year", "career_break_start_month", "career_break_end_year", "career_break_end_month", "currently_on_break"}
	if supported(key, textKeys) {
		s, ok := value.(string)
		if !ok {
			fields[key] = "Use text for this field."
			return
		}
		validateText(fields, key, s, 240, false)
	}
	if supported(key, []string{"fixed_salary", "variable_salary", "disability_percentage"}) && recordString(map[string]any{key: value}, key) != "" {
		n, ok := numeric(value)
		max := profileRules.Limits["max_salary"]
		if key == "disability_percentage" {
			max = 100
		}
		if !ok || n < 0 || n > max {
			fields[key] = "Enter a non-negative value within the supported range."
		}
	}
	if key == "preferred_job_roles" {
		if s, ok := value.(string); ok && len(strings.Split(s, ",")) > 3 {
			fields[key] = "Select no more than 3 job roles."
		}
	}
	if key == "preferred_locations" {
		if s, ok := value.(string); ok && len(strings.Split(s, ",")) > 10 {
			fields[key] = "Select no more than 10 locations."
		}
	}
	if supported(key, []string{"military_enrolment_date", "military_discharge_date"}) && value != "" {
		s, ok := value.(string)
		date, e := time.Parse("2006-01-02", s)
		if !ok || e != nil || date.After(now) || date.Year() < 1900 {
			fields[key] = "Use a valid date in the past."
		}
	}
	if supported(key, []string{"key_skills", "desired_job_type", "desired_employment_type"}) {
		items, ok := value.([]any)
		max := 20
		if key == "key_skills" {
			max = 50
		}
		if !ok || len(items) > max {
			fields[key] = fmt.Sprintf("Use a list with no more than %d choices.", max)
			return
		}
		if key == "key_skills" && len(items) == 0 {
			fields[key] = "Add at least one skill."
		}
		for _, item := range items {
			s, ok := item.(string)
			if !ok || strings.TrimSpace(s) == "" {
				fields[key] = "Use non-empty text choices."
			} else {
				validateText(fields, key, s, 120, false)
			}
		}
	}
	if !supported(key, []string{"project_records", "online_profiles", "work_samples", "publications", "presentations", "patents", "certifications", "projects", "awards", "professional_memberships"}) {
		return
	}
	if key == "projects" {
		if _, ok := value.(string); ok {
			return
		}
	}
	validateProfessionalRecords(fields, key, value, previous)
	items, _ := value.([]any)
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
		r, ok := item.(map[string]any)
		if !ok {
			continue
		}
		p := fmt.Sprintf("%s[%d].", key, i)
		if key == "awards" || key == "professional_memberships" {
			validateText(fields, p+"issuer", recordString(r, "issuer"), 240, true)
			if key == "professional_memberships" {
				current, ok := r["current"].(string)
				if !ok || !supported(current, []string{"Yes", "No"}) {
					fields[p+"current"] = "Select whether this membership is current."
				}
			}
		}
		if supported(key, []string{"online_profiles", "work_samples", "publications", "presentations", "patents"}) && !validProfileURL(recordString(r, "url")) {
			fields[p+"url"] = "Use an HTTPS link without embedded credentials."
		}
		if key == "online_profiles" {
			validateText(fields, p+"label", recordString(r, "label"), 240, true)
		}
		if key == "projects" || key == "project_records" {
			if _, newRecord := r["status"]; newRecord {
				validateText(fields, p+"client", recordString(r, "client"), 240, true)
				validateText(fields, p+"description", recordString(r, "description"), 1000, true)
				if _, valid := recordMonth(r, "start_year", "start_month"); !valid {
					fields[p+"start_month"] = "Select a valid month and year."
				}
				if r["status"] == "Finished" {
					if _, valid := recordMonth(r, "end_year", "end_month"); !valid {
						fields[p+"end_month"] = "Select a valid month and year."
					}
				}
			}
		}
		for _, prefix := range []string{"start", "end", "published", "issued"} {
			y, m := recordString(r, prefix+"_year"), recordString(r, prefix+"_month")
			if y == "" && m == "" {
				continue
			}
			date, valid := recordMonth(r, prefix+"_year", prefix+"_month")
			if !valid {
				fields[p+prefix+"_month"] = "Select a valid month and year."
			} else if prefix != "end" && date > now.Year()*12+int(now.Month())-1 {
				fields[p+prefix+"_month"] = "Date cannot be in the future."
			}
		}
		start, a := recordMonth(r, "start_year", "start_month")
		end, b := recordMonth(r, "end_year", "end_month")
		if a && b && start > end {
			fields[p+"start_month"] = "Start date cannot be after end date."
		}
		if r["status"] == "In progress" || r["current"] == "Yes" || r["no_expiry"] == "Yes" {
			if recordString(r, "end_year") != "" || recordString(r, "end_month") != "" {
				fields[p+"end_month"] = "An ongoing item cannot have an end date."
			}
		}
		if team := recordString(r, "team_size"); team != "" {
			n, e := strconv.Atoi(team)
			if e != nil || n < 1 || n > 100000 {
				fields[p+"team_size"] = "Enter a whole team size between 1 and 100000."
			}
		}
	}
}

func validateReferenceRelationships(fields map[string]string, details, previous map[string]any, now time.Time) {
	changed := func(prefix string) bool {
		for key, value := range details {
			if strings.HasPrefix(key, prefix) && !reflect.DeepEqual(value, previous[key]) {
				return true
			}
		}
		return false
	}
	if changed("disability_") && details["disability_status"] == "Have disability" {
		for _, key := range []string{"disability_type", "disability_percentage", "disability_reason"} {
			validateText(fields, key, recordString(details, key), 240, true)
		}
	}
	if changed("military_") && supported(recordString(details, "military_experience"), []string{"Currently serving", "Previously served"}) {
		validateText(fields, "military_service_type", recordString(details, "military_service_type"), 240, true)
	}
	if changed("military_") {
		start, e := time.Parse("2006-01-02", recordString(details, "military_enrolment_date"))
		end, f := time.Parse("2006-01-02", recordString(details, "military_discharge_date"))
		if e == nil && f == nil && end.Before(start) {
			fields["military_enrolment_date"] = "Enrolment date cannot be after discharge date."
		}
	}
	if (changed("career_break") || changed("currently_on_break")) && details["career_break"] == "Have taken" {
		validateText(fields, "career_break_reason", recordString(details, "career_break_reason"), 240, true)
		start, a := recordMonth(details, "career_break_start_year", "career_break_start_month")
		end, b := recordMonth(details, "career_break_end_year", "career_break_end_month")
		present := now.Year()*12 + int(now.Month()) - 1
		if !a || start > present {
			fields["career_break_start_month"] = "Select a valid month and year in the past."
		}
		if details["currently_on_break"] != "Yes" {
			if !b || end > present {
				fields["career_break_end_month"] = "Select a valid month and year in the past."
			} else if a && end < start {
				fields["career_break_start_month"] = "Start date cannot be after end date."
			}
		}
	}
}
