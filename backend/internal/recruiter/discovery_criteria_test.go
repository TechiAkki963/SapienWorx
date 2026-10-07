package recruiter

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestDiscoveryCriteriaRangesAndPolicy(t *testing.T) {
	tests := []struct {
		name   string
		values map[string]string
		want   error
	}{
		{"decimal range", map[string]string{"min_experience": "2.5", "max_experience": "8.75"}, nil},
		{"zero maximum", map[string]string{"min_experience": "1", "max_experience": "0"}, ErrInvalid},
		{"reversed range", map[string]string{"min_experience": "8", "max_experience": "2"}, ErrInvalid},
		{"non finite", map[string]string{"min_experience": "NaN"}, ErrInvalid},
		{"page bound", map[string]string{"page_size": "51"}, ErrInvalid},
		{"bad boolean", map[string]string{"resume_available": "yes"}, ErrInvalid},
		{"bad date", map[string]string{"updated_since": "yesterday"}, ErrInvalid},
		{"missing degree", map[string]string{"ug_mode": "specific"}, ErrInvalid},
		{"bad Boolean expression", map[string]string{"keyword_mode": "boolean", "q": "Go AND ("}, ErrInvalid},
		{"unknown key", map[string]string{"email": "person@example.test"}, ErrInvalid},
	}
	for _, key := range restrictedDiscoveryKeys {
		tests = append(tests, struct {
			name   string
			values map[string]string
			want   error
		}{key, map[string]string{key: "false"}, ErrSearchRestricted})
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := ParseDiscoveryFilters(test.values)
			if err != test.want {
				t.Fatalf("got %v want %v", err, test.want)
			}
		})
	}
	skills := []string{}
	for n := 0; n < 50; n++ {
		skills = append(skills, fmt.Sprintf("Skill %d", n))
	}
	if _, err := ParseDiscoveryFilters(map[string]string{"skills": strings.Join(skills, ",")}); err != nil {
		t.Fatal(err)
	}
	skills = append(skills, "Skill 51")
	if _, err := ParseDiscoveryFilters(map[string]string{"skills": strings.Join(skills, ",")}); err != ErrInvalid {
		t.Fatalf("unbounded skill list: %v", err)
	}
}

func TestStructuredSearchBindsOnlyApprovedProfessionalFields(t *testing.T) {
	f, err := ParseDiscoveryFilters(map[string]string{"q": "Go AND NOT Python", "keyword_mode": "boolean", "keyword_scope": "skills", "location": "Mumbai, Pune", "include_relocation": "true", "excluded_companies": "x' OR 1=1 --", "pg_mode": "none", "verified_email": "true", "languages": "English"})
	if err != nil {
		t.Fatal(err)
	}
	args := []any{}
	conditions := []string{}
	if err := structuredDiscoveryConditions(f, &args, &conditions, time.Now()); err != nil {
		t.Fatal(err)
	}
	sql := strings.Join(conditions, " AND ")
	for _, private := range []string{"current_salary", "expected_salary", "date_of_birth", "completion_id", "x' OR 1=1"} {
		if strings.Contains(sql, private) {
			t.Fatalf("unsafe SQL: %s", sql)
		}
	}
	if !strings.Contains(sql, "NOT EXISTS") || !strings.Contains(sql, "OR") || !strings.Contains(sql, "email_verified_at IS NOT NULL") || len(args) < 5 {
		t.Fatalf("missing criteria: %s %+v", sql, args)
	}
}
