package candidate

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

func TestReviewedCVPreservesPrivacyAndRequiresPreciseRecords(t *testing.T) {
	previous := map[string]any{"discoverable_to_recruiters": false, "private_contact": true, "onboarding_status": "completed", "professional_summary": "Original", "employment": []any{map[string]any{"company": "Original Co", "job_title": "Engineer", "joining_year": "2020", "joining_month": "Jan", "end_year": "2021", "end_month": "Feb", "current_company": "No"}}}
	raw, _ := json.Marshal(previous)
	change := func(path string, value any) contract.ReviewedChange {
		v, _ := json.Marshal(value)
		return contract.ReviewedChange{Path: path, Value: v, Status: contract.ReviewConfirmed}
	}
	changes := []contract.ReviewedChange{change("/professional/headline", "Reviewed engineer"), change("/skills/0/entity/name", "Go"), change("/skills/0/entity/raw_value", "Go"), change("/compensation/current/amount", "200000"), change("/employment/0/company/name", "New Co"), change("/employment/0/designation/name", "Engineer"), change("/employment/0/start_date/year", 2022), change("/employment/0/is_current", true)}
	changes = append(changes, change("/professional/summary", nil))
	core := ProfileUpdate{FullName: "Candidate", CountryCode: "IN"}
	out, err := ProjectReviewedCV(core, previous, changes, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if out.Core.Headline != "Reviewed engineer" || len(out.Details["employment"].([]any)) != 1 {
		t.Fatal("imprecise date was invented or scalar lost")
	}
	if out.Details["discoverable_to_recruiters"] != false || out.Details["private_contact"] != true || out.Details["professional_summary"] != "Original" {
		t.Fatal("unselected privacy/profile values changed")
	}
	var before map[string]any
	_ = json.Unmarshal(raw, &before)
	if !reflect.DeepEqual(previous, before) {
		t.Fatal("projector mutated existing profile")
	}
	if len(out.ManualPaths) < 5 {
		t.Fatal("unsupported accepted fields not disclosed")
	}
	changes = append(changes, change("/employment/0/start_date/month", 3))
	out, err = ProjectReviewedCV(core, previous, changes, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Details["employment"].([]any)) != 2 {
		t.Fatal("complete reviewed employment not appended")
	}
	if out.Core.TotalExperienceMonths == 0 {
		t.Fatal("existing date-derived experience rule was lost")
	}
}
