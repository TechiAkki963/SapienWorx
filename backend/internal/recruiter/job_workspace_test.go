package recruiter

import "testing"

func TestNormalizeJobWorkspaceFilters(t *testing.T) {
	filters := JobWorkspaceFilters{
		Query:        "  nurse ",
		Status:       "ACTIVE",
		WorkMode:     "HYBRID",
		RoleCategory: " Healthcare ",
		Sort:         "",
		Page:         0,
		Limit:        1000,
	}
	if err := normalizeJobWorkspaceFilters(&filters); err != nil {
		t.Fatalf("normalize filters: %v", err)
	}
	if filters.Query != "nurse" || filters.Status != "active" || filters.WorkMode != "hybrid" || filters.RoleCategory != "Healthcare" {
		t.Fatalf("unexpected normalized filters: %#v", filters)
	}
	if filters.Sort != "updated" || filters.Page != 1 || filters.Limit != 20 {
		t.Fatalf("unexpected defaults: %#v", filters)
	}
}

func TestNormalizeJobWorkspaceFiltersRejectsInvalidEnums(t *testing.T) {
	cases := []JobWorkspaceFilters{
		{Status: "deleted"},
		{EmploymentType: "permanent"},
		{WorkMode: "flexible"},
		{Deadline: "yesterday"},
		{Sort: "salary"},
	}
	for _, input := range cases {
		filters := input
		if err := normalizeJobWorkspaceFilters(&filters); err != ErrInvalid {
			t.Fatalf("filters %#v: error = %v, want ErrInvalid", input, err)
		}
	}
}
