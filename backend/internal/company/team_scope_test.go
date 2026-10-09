package company

import "testing"

func TestDelegatedTeamScopeCannotBroadenAccess(t *testing.T) {
	actor := Member{Role: "sub_admin", Status: "active", Scope: Scope{Departments: []string{"Engineering"}, Locations: []string{"Pune"}}}
	for _, c := range []struct {
		role  string
		scope Scope
		want  bool
	}{
		{"recruiter", Scope{Departments: []string{"Engineering"}}, true},
		{"collaborator", Scope{Locations: []string{"Pune"}}, true},
		{"recruiter", Scope{Departments: []string{"Engineering"}, Locations: []string{"Pune"}}, true},
		{"recruiter", Scope{All: true}, false},
		{"recruiter", Scope{Departments: []string{"Sales"}}, false},
		{"recruiter", Scope{Departments: []string{"engineering"}}, false},
		{"recruiter", Scope{Departments: []string{" Engineering "}}, false},
		{"recruiter", Scope{Departments: []string{"Engineering"}, Locations: []string{"Mumbai"}}, false},
		{"recruiter", Scope{JobIDs: []string{"unassigned-job"}}, false},
		{"primary_admin", Scope{Departments: []string{"Engineering"}}, false},
		{"sub_admin", Scope{Departments: []string{"Engineering"}}, false},
	} {
		if got := canManageTeammate(actor, c.role, c.scope); got != c.want {
			t.Errorf("%s %+v: %v", c.role, c.scope, got)
		}
	}
	if !actor.Can("company.team") || actor.Can("company.billing") {
		t.Fatal("delegated permission boundary incorrect")
	}
	actor.Status = "inactive"
	if canManageTeammate(actor, "recruiter", Scope{Departments: []string{"Engineering"}}) {
		t.Fatal("inactive delegation allowed")
	}
}
