package candidate

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"time"

	c "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

func TestCanonicalSnapshotPreservesExistingProfileAndPrivacy(t *testing.T) {
	text := func(v string) *string { return &v }
	now := time.Date(2026, 10, 15, 0, 0, 0, 0, time.UTC)
	salary := 1234.5
	notice := 15
	p := Profile{UserID: "10000000-0000-4000-8000-000000000001", Email: "synthetic@example.test", Phone: text("+919999900001"), FullName: "एकांश", Headline: text("Platform Engineer"), CurrentCity: text("Mumbai"), CountryCode: "IN", TotalExperienceMonths: 42, NoticePeriodDays: &notice}
	d := ProfileDetails{ProfileUpdatedAt: now, CurrentSalaryAmount: &salary, CurrentSalaryCurrency: "INR", CVOriginalFilename: text("legacy.pdf"), Details: map[string]any{"professional_summary": "Candidate-owned summary", "date_of_birth": "1990-01-01", "gender": "private", "disability_details": "private medical details", "discoverable_to_recruiters": false, "current_salary_unit": "Annual", "preferred_locations": "Mumbai, Remote", "employment": []any{map[string]any{"company": "Example Company", "job_title": "Platform Engineer", "joining_year": "2024", "joining_month": "Jan", "current_company": "yes"}}, "it_skills": []any{map[string]any{"name": "Go", "experience_years": 2, "experience_months": 3}}, "key_skills": []any{"Go", "SQL"}, "education": []any{map[string]any{"level": "Graduate", "university": "Example University", "start_year": "2018", "end_year": "2022", "score": "3.8", "grading_system": "GPA 4"}}}}
	before, _ := json.Marshal(d)
	snapshot, issues := CanonicalSnapshot(p, d, c.ContactVerification{EmailVerified: true})
	after, _ := json.Marshal(d)
	if !bytes.Equal(before, after) || len(issues) != 1 || issues[0].Code != "LEGACY_RESUME_NEEDS_STABLE_ID" {
		t.Fatal("adapter changed existing data or invented resume identity")
	}
	if snapshot.Profile.Identity.FirstName != nil || snapshot.Profile.Identity.LastName != nil || *snapshot.Profile.Identity.DisplayName != "एकांश" {
		t.Fatal("single-word name split")
	}
	if !snapshot.Verification.EmailVerified || snapshot.Verification.PhoneVerified || *snapshot.Profile.Professional.TotalExperienceMonths != 42 || len(snapshot.Profile.Skills) != 2 || *snapshot.Profile.Compensation.Current.Amount != "1234.50" {
		t.Fatal("existing source values lost")
	}
	if *snapshot.Profile.Professional.CurrentCompany.Name != "Example Company" || snapshot.Profile.Education[0].StartDate.Month != nil {
		t.Fatal("current company/date precision lost")
	}
	encoded, _ := json.Marshal(snapshot)
	for _, private := range []string{"date_of_birth", "disability_details", "1990-01-01", "cv_s3_key", "discoverable_to_recruiters"} {
		if strings.Contains(string(encoded), private) {
			t.Fatal("legacy-only protected/server field copied")
		}
	}
	v, e := CanonicalContractValidator()
	if e != nil || v.ValidateProfile(snapshot, now).HasErrors() {
		t.Fatal("valid legacy profile incompatible with canonical view")
	}
	*snapshot.Profile.Professional.Headline = "Changed view"
	if *p.Headline != "Platform Engineer" {
		t.Fatal("view aliases caller data")
	}
}

func TestCanonicalSnapshotHandlesLegacySparseAndUnstructuredSections(t *testing.T) {
	p := Profile{UserID: "10000000-0000-4000-8000-000000000001", FullName: "Synthetic", Email: "synthetic@example.test", CountryCode: "IN"}
	d := ProfileDetails{Details: map[string]any{"projects": "Legacy narrative retained in source"}}
	view, issues := CanonicalSnapshot(p, d, c.ContactVerification{})
	if len(issues) != 1 || issues[0].Code != "LEGACY_UNSTRUCTURED_SECTION" || view.Profile.Compensation.Current != nil || view.Profile.Location.RemotePreference != nil || len(view.Profile.Employment) != 0 {
		t.Fatal("sparse legacy data guessed or silently discarded")
	}
}
