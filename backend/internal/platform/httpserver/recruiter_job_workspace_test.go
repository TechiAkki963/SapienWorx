package httpserver

import (
	"net/http/httptest"
	"testing"
)

func TestRecruiterJobWorkspaceFiltersFromRequest(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/recruiter/jobs?q=nurse&status=active&employment_type=full_time&work_mode=onsite&role_category=Healthcare&deadline=soon&sort=applications&page=2&limit=25", nil)
	got, err := recruiterJobWorkspaceFiltersFromRequest(req)
	if err != nil {
		t.Fatalf("parse filters: %v", err)
	}
	if got.Query != "nurse" || got.Status != "active" || got.EmploymentType != "full_time" || got.WorkMode != "onsite" || got.RoleCategory != "Healthcare" || got.Deadline != "soon" || got.Sort != "applications" {
		t.Fatalf("unexpected filters: %#v", got)
	}
	if got.Page != 2 || got.Limit != 25 {
		t.Fatalf("page/limit = %d/%d, want 2/25", got.Page, got.Limit)
	}
}

func TestRecruiterJobWorkspaceFiltersRejectInvalidPagination(t *testing.T) {
	for _, target := range []string{
		"/api/v1/recruiter/jobs?page=zero",
		"/api/v1/recruiter/jobs?page=0",
		"/api/v1/recruiter/jobs?limit=100",
	} {
		req := httptest.NewRequest("GET", target, nil)
		if _, err := recruiterJobWorkspaceFiltersFromRequest(req); err == nil {
			t.Fatalf("%s: expected validation error", target)
		}
	}
}
