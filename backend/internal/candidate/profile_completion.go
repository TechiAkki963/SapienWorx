package candidate

import "strings"

// calculateProfileCompletion uses clear, weighted profile sections rather
// than awarding most of the score for a handful of searchable fields.
func calculateProfileCompletion(profile Profile, details map[string]any, hasResume bool) int {
	if details == nil {
		details = map[string]any{}
	}
	score := 0
	if strings.TrimSpace(profile.FullName) != "" {
		score += 15
	}
	if strings.TrimSpace(pointerText(profile.Headline)) != "" {
		score += 8
	}
	if detailText(details, "professional_summary") != "" {
		score += 7
	}
	if hasProfileRecord(details, "employment", "company", "job_title") {
		score += 20
	} else if profile.TotalExperienceMonths > 0 {
		score += 8
	}
	if hasProfileRecord(details, "education", "university", "level") {
		score += 10
	}
	skills := map[string]bool{}
	if rows, ok := details["it_skills"].([]any); ok {
		for _, item := range rows {
			if row, ok := item.(map[string]any); ok {
				if name := strings.ToLower(detailText(row, "name")); name != "" {
					skills[name] = true
				}
			}
		}
	}
	if rows, ok := details["key_skills"].([]any); ok {
		for _, item := range rows {
			if name, ok := item.(string); ok && strings.TrimSpace(name) != "" {
				skills[strings.ToLower(strings.TrimSpace(name))] = true
			}
		}
	}
	if len(skills) >= 3 {
		score += 15
	} else if len(skills) > 0 {
		score += 7
	}
	professionalWork := false
	for _, key := range []string{"projects", "project_records", "accomplishments", "work_samples", "publications", "presentations", "patents", "certifications", "awards", "professional_memberships"} {
		if detailText(details, key) != "" || countProfileRecords(details, key, "title") > 0 {
			professionalWork = true
		}
	}
	if professionalWork {
		score += 6
	}
	if detailText(details, "professional_links") != "" || countProfileRecords(details, "professional_links", "url") > 0 || countProfileRecords(details, "online_profiles", "url") > 0 {
		score += 4
	}
	if hasResume {
		score += 10
	}
	if detailText(details, "preferred_locations") != "" && profile.NoticePeriodDays != nil {
		score += 5
	}
	if score > 100 {
		return 100
	}
	return score
}

func pointerText(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func detailText(details map[string]any, key string) string {
	value, _ := details[key].(string)
	return strings.TrimSpace(value)
}

func countProfileRecords(details map[string]any, key, required string) int {
	items, _ := details[key].([]any)
	count := 0
	for _, item := range items {
		record, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if detailText(record, required) != "" {
			count++
		}
	}
	return count
}

func hasProfileRecord(details map[string]any, key, first, second string) bool {
	items, _ := details[key].([]any)
	for _, item := range items {
		record, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if detailText(record, first) != "" && detailText(record, second) != "" {
			return true
		}
	}
	return false
}
