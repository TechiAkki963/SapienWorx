package recruiter

import "testing"

func TestNormalizeBulkJobIDs(t *testing.T) {
	id := "60000000-0000-4000-8000-000000000001"
	other := "60000000-0000-4000-8000-000000000002"
	got, err := normalizeBulkJobIDs([]string{id, " " + id + " ", other})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != id || got[1] != other {
		t.Fatalf("unexpected normalized IDs: %#v", got)
	}
}

func TestNormalizeBulkJobIDsRejectsUnsafeRequests(t *testing.T) {
	if _, err := normalizeBulkJobIDs(nil); err == nil {
		t.Fatal("expected empty bulk request to fail")
	}
	if _, err := normalizeBulkJobIDs([]string{"not-a-uuid"}); err == nil {
		t.Fatal("expected invalid uuid to fail")
	}
	many := make([]string, MaxBulkJobActions+1)
	for i := range many {
		many[i] = "60000000-0000-4000-8000-000000000001"
	}
	if _, err := normalizeBulkJobIDs(many); err == nil {
		t.Fatal("expected oversized bulk request to fail")
	}
}

func TestBulkJobErrorCode(t *testing.T) {
	if got := bulkJobErrorCode(ErrNotFound); got != "not_found" {
		t.Fatalf("unexpected not found code: %s", got)
	}
	if got := bulkJobErrorCode(ErrInvalid); got != "invalid_transition" {
		t.Fatalf("unexpected invalid code: %s", got)
	}
}
