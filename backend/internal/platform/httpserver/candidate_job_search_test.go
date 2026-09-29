package httpserver

import (
	"net/http/httptest"
	"testing"
)

func TestCandidateJobFiltersFromRequestIncludesPhase2Facets(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/candidate/jobs?q=ICU+Nursing&location=Mumbai&company=Care+Health&work_mode=onsite&employment_type=full_time&role_category=Healthcare&competency=Critical+Care+Nursing&experience=4&education=B.Sc&education=Any+Graduate&min_salary=800000&max_salary=1800000&salary_currency=INR&posted_within=14&sort=relevance&page=2&limit=20", nil)
	got := candidateJobFiltersFromRequest(req)

	if got.Query != "ICU Nursing" || got.Location != "Mumbai" || got.Company != "Care Health" {
		t.Fatalf("unexpected text facets: %#v", got)
	}
	if got.WorkMode != "onsite" || got.EmploymentType != "full_time" || got.RoleCategory != "Healthcare" || got.Competency != "Critical Care Nursing" {
		t.Fatalf("unexpected structured facets: %#v", got)
	}
	if got.ExperienceMonths == nil || *got.ExperienceMonths != 48 {
		t.Fatalf("experience months = %v, want 48", got.ExperienceMonths)
	}
	if len(got.Education) != 2 || got.Education[0] != "B.Sc" || got.Education[1] != "Any Graduate" {
		t.Fatalf("education = %#v", got.Education)
	}
	if got.MinSalary == nil || *got.MinSalary != 800000 || got.MaxSalary == nil || *got.MaxSalary != 1800000 {
		t.Fatalf("salary range = %v..%v", got.MinSalary, got.MaxSalary)
	}
	if got.SalaryCurrency != "INR" || got.PostedWithinDays != 14 || got.Sort != "relevance" || got.Page != 2 || got.Limit != 20 {
		t.Fatalf("unexpected paging/sort facets: %#v", got)
	}
}

func TestCandidateJobFiltersFromRequestRejectsOutOfRangeNumbers(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/candidate/jobs?experience=61&posted_within=999&min_salary=-1&max_salary=not-a-number", nil)
	got := candidateJobFiltersFromRequest(req)

	if got.ExperienceMonths != nil {
		t.Fatalf("experience months = %v, want nil", got.ExperienceMonths)
	}
	if got.PostedWithinDays != 0 {
		t.Fatalf("posted within = %d, want 0", got.PostedWithinDays)
	}
	if got.MinSalary != nil || got.MaxSalary != nil {
		t.Fatalf("invalid salary values should be ignored: %v %v", got.MinSalary, got.MaxSalary)
	}
}
