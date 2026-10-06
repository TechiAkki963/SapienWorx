package candidate

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestWorkspaceAdditionalProfileValidation(t *testing.T) {
	now := time.Date(2026, 10, 6, 0, 0, 0, 0, time.UTC)
	valid := map[string]any{
		"awards":                   []any{map[string]any{"title": "Service recognition", "issuer": "Example Association", "issued_month": "Jan", "issued_year": "2024", "description": strings.Repeat("a", 4000)}},
		"professional_memberships": []any{map[string]any{"title": "Professional member", "issuer": "Example Association", "start_month": "Jan", "start_year": "2024", "current": "Yes", "end_month": nil, "end_year": nil}},
		"preferred_work_mode":      "Hybrid", "current_salary_unit": "Monthly", "expected_salary_unit": "Annual",
		"employment": []any{map[string]any{"company": "Example", "job_title": "Engineer", "joining_month": "Jan", "joining_year": "2024", "current_company": "Yes", "end_month": nil, "end_year": nil, "location": strings.Repeat("a", 120), "achievements": strings.Repeat("a", 4000)}},
	}
	if err := ValidateProfileDetails(&ProfileDetailsUpdate{Details: valid}, nil, now); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name    string
		details map[string]any
		field   string
	}{
		{"award issuer required", map[string]any{"awards": []any{map[string]any{"title": "Award", "issuer": ""}}}, "awards[0].issuer"},
		{"award bounds", map[string]any{"awards": []any{map[string]any{"title": "Award", "issuer": "Example", "description": strings.Repeat("a", 4001)}}}, "awards[0].description"},
		{"current membership cannot end", map[string]any{"professional_memberships": []any{map[string]any{"title": "Member", "issuer": "Example", "start_month": "Jan", "start_year": "2024", "current": "Yes", "end_month": "Jan", "end_year": "2025"}}}, "professional_memberships[0].end_month"},
		{"membership current typed", map[string]any{"professional_memberships": []any{map[string]any{"title": "Member", "issuer": "Example", "current": true}}}, "professional_memberships[0].current"},
		{"work mode enum", map[string]any{"preferred_work_mode": "Anywhere"}, "preferred_work_mode"},
		{"salary unit enum", map[string]any{"expected_salary_unit": "Weekly"}, "expected_salary_unit"},
		{"salary unit text", map[string]any{"current_salary_unit": 42}, "current_salary_unit"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := ValidateProfileDetails(&ProfileDetailsUpdate{Details: c.details}, nil, now)
			var validation *ProfileValidationError
			if !errors.As(err, &validation) || validation.Fields[c.field] == "" {
				t.Fatalf("missing %s: %v", c.field, err)
			}
		})
	}
	legacy := map[string]any{"awards": []any{map[string]any{"title": "Legacy incomplete award"}}, "professional_memberships": []any{map[string]any{"title": "Legacy membership"}}, "preferred_work_mode": "Legacy flexible mode"}
	edited := map[string]any{"awards": legacy["awards"], "professional_memberships": legacy["professional_memberships"], "preferred_work_mode": legacy["preferred_work_mode"], "professional_summary": "Updated section"}
	if err := ValidateProfileDetails(&ProfileDetailsUpdate{Details: edited}, legacy, now); err != nil {
		t.Fatalf("unrelated edit rejected legacy fields: %v", err)
	}
}
func TestWorkspaceAdditionalCompletionKeepsWeightBudget(t *testing.T) {
	profile := Profile{FullName: "Candidate"}
	base := calculateProfileCompletion(profile, nil, false)
	details := map[string]any{"awards": []any{map[string]any{"title": "Award"}}, "professional_memberships": []any{map[string]any{"title": "Association member"}}, "current_salary_unit": "Monthly", "expected_salary_unit": "Annual", "preferred_work_mode": "Hybrid"}
	if got := calculateProfileCompletion(profile, details, false); got != base+6 {
		t.Fatalf("additional categories inflated weights: got %d base %d", got, base)
	}
	delete(details, "awards")
	delete(details, "professional_memberships")
	if got := calculateProfileCompletion(profile, details, false); got != base {
		t.Fatalf("private units added completion: %d", got)
	}
}
