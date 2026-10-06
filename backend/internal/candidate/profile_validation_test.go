package candidate

import (
	"encoding/json"
	"errors"
	"math"
	"os"
	"strings"
	"testing"
	"time"
)

func TestProfileValidationContract(t *testing.T) {
	if len(strings.Fields(profileRules.Countries)) != 249 {
		t.Fatal("ISO country list is incomplete")
	}
	var cases []struct {
		Name     string
		Core     *ProfileUpdate
		Details  map[string]any
		Previous map[string]any
		Fields   []string
	}
	raw, err := os.ReadFile("profile_validation_cases.json")
	if err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		t.Run(c.Name, func(t *testing.T) {
			var err error
			if c.Core != nil {
				err = ValidateProfile(c.Core)
			} else {
				input := ProfileDetailsUpdate{Details: c.Details}
				err = ValidateProfileDetails(&input, c.Previous, time.Now().UTC())
			}
			fields := map[string]string{}
			var v *ProfileValidationError
			if errors.As(err, &v) {
				fields = v.Fields
			} else if err != nil {
				t.Fatal(err)
			}
			if len(fields) != len(c.Fields) {
				t.Fatalf("fields=%v want=%v", fields, c.Fields)
			}
			for _, field := range c.Fields {
				if fields[field] == "" {
					t.Errorf("missing %s in %v", field, fields)
				}
			}
		})
	}
}
func TestExperienceMergesOverlapsAndKeepsManualFallback(t *testing.T) {
	now := time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC)
	role := func(startYear, startMonth, endYear, endMonth, current string) any {
		return map[string]any{"joining_year": startYear, "joining_month": startMonth, "end_year": endYear, "end_month": endMonth, "current_company": current}
	}
	history := map[string]any{"employment": []any{role("2020", "Jan", "2023", "Jan", "No"), role("2022", "Jan", "", "", "Yes")}}
	if n := EmploymentExperience(history, now); n == nil || *n != 81 {
		t.Fatalf("overlaps counted incorrectly: %v", n)
	}
	for _, d := range []map[string]any{{}, {"employment": []any{map[string]any{"company": "Legacy"}}}} {
		if EmploymentExperience(d, now) != nil {
			t.Fatal("incomplete history must retain the manual estimate")
		}
	}
}
func TestSkillNormalizationAndCurrentRoleNullEnd(t *testing.T) {
	row := map[string]any{"name": "Go", "experience_years": "1", "experience_months": "14"}
	job := map[string]any{"company": "Labs", "job_title": "Engineer", "joining_year": "2022", "joining_month": "Jan", "current_company": "Yes"}
	input := ProfileDetailsUpdate{Details: map[string]any{"it_skills": []any{row}, "employment": []any{job}}}
	if err := ValidateProfileDetails(&input, nil, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	if row["experience_years"] != 2 || row["experience_months"] != 2 {
		t.Fatalf("wrong normalization: %v", row)
	}
	if job["end_year"] != nil || job["end_month"] != nil {
		t.Fatal("current role must have null end date")
	}
}
func TestSalaryAndCollectionBounds(t *testing.T) {
	for _, n := range []float64{-1, math.Inf(1), math.NaN(), 1e15} {
		input := ProfileDetailsUpdate{CurrentSalaryAmount: &n}
		if ValidateProfileDetails(&input, nil, time.Now()) == nil {
			t.Fatal("invalid salary accepted")
		}
	}
	for _, key := range []string{"employment", "education", "it_skills", "languages"} {
		rows := make([]any, int(profileRules.Limits[key])+1)
		input := ProfileDetailsUpdate{Details: map[string]any{key: rows}}
		err := ValidateProfileDetails(&input, nil, time.Now())
		var v *ProfileValidationError
		if !errors.As(err, &v) || v.Fields[key] == "" {
			t.Fatalf("collection bound missing: %s %v", key, err)
		}
	}
}
