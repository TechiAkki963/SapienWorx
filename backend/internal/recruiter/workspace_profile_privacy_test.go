package recruiter

import "testing"

func TestWorkspacePrivateCompensationUnitsStayOwnerOnly(t *testing.T) {
	values := map[string]any{"current_salary_unit": "Monthly", "expected_salary_unit": "Annual", "current_salary_amount": 123456, "expected_salary_amount": 234567, "employment": []any{map[string]any{"company": "Example", "job_title": "Engineer", "current_salary": "123456", "current_salary_unit": "Monthly"}}}
	got := recruiterVisibleCandidateDetails(values)
	for _, key := range []string{"current_salary_unit", "expected_salary_unit", "current_salary_amount", "expected_salary_amount"} {
		if _, exists := got[key]; exists {
			t.Fatalf("private field leaked: %s", key)
		}
	}
	record := got["employment"].([]map[string]any)[0]
	if _, exists := record["current_salary_unit"]; exists {
		t.Fatal("employment unit leaked")
	}
	if _, exists := record["current_salary"]; exists {
		t.Fatal("employment pay leaked")
	}
}
