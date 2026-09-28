package recruiter

import (
	"strings"
	"testing"
)

func TestPipelineWhereKeepsOrganizationScopeAndParameterizesFilters(t *testing.T) {
	where, args, err := pipelineWhere("company-1", PipelineFilters{
		Query: "Go", Stages: []string{"screening", "shortlisted"}, JobID: "job-1",
		CurrentCompany: "Acme", Location: "Mumbai", MinExperienceYears: 3,
		MaxNoticeDays: 30, HasCV: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(where, "j.company_id=$1 AND ") {
		t.Fatalf("organization guard missing or not first: %s", where)
	}
	for _, fragment := range []string{"a.stage::text = ANY($3::text[])", "j.id::text=$4", "cp.total_experience_months >= $7", "cp.cv_s3_key IS NOT NULL"} {
		if !strings.Contains(where, fragment) {
			t.Errorf("missing condition %q in %s", fragment, where)
		}
	}
	if len(args) != 8 || args[0] != "company-1" || args[1] != "%Go%" || args[6] != 36 || args[7] != 30 {
		t.Fatalf("unexpected bound values: %#v", args)
	}
	if strings.Contains(where, "Acme") || strings.Contains(where, "Mumbai") {
		t.Fatal("user-supplied search text was interpolated into SQL")
	}
}

func TestPipelineRejectsInvalidRangesAndSorts(t *testing.T) {
	if _, _, err := pipelineWhere("company-1", PipelineFilters{MinExperienceYears: 8, MaxExperienceYears: 3, MaxExperienceSet: true}); err != ErrInvalid {
		t.Fatalf("expected invalid range, got %v", err)
	}
	if _, err := pipelineSort("a.updated_at; DROP TABLE jobs"); err != ErrInvalid {
		t.Fatalf("expected invalid sort, got %v", err)
	}
}
