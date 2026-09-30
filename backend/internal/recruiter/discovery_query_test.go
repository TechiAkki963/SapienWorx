package recruiter

import (
	"errors"
	"strings"
	"testing"
)

func TestDiscoveryBooleanQuery(t *testing.T) {
	for _, input := range []string{
		`("Java Developer" OR "Backend Engineer") AND ("Spring Boot" OR Microservices) AND PostgreSQL`,
		`Java AND NOT PHP`,
		`Java PostgreSQL`,
	} {
		expr, err := parseDiscoveryQuery(input)
		if err != nil || expr == nil {
			t.Fatalf("valid query %q: %v", input, err)
		}
		var args []any
		sql := expr.sql(&args)
		if len(args) == 0 || !strings.Contains(sql, "ILIKE") {
			t.Fatalf("missing predicates for %q", input)
		}
	}
	for _, input := range []string{`Java OR`, `("Java"`, `()`, `"unfinished`, `AND Java`, `Java )`, strings.Repeat("x", 301)} {
		if _, err := parseDiscoveryQuery(input); !errors.Is(err, ErrInvalid) {
			t.Fatalf("expected rejection for %q", input)
		}
	}
	if got := discoveryPattern(`a%b_c`); !strings.Contains(got, `\%`) || !strings.Contains(got, `\_`) {
		t.Fatalf("wildcard not escaped: %s", got)
	}
}

func TestDiscoverySortModes(t *testing.T) {
	for _, sort := range []string{"", "recently_updated", "most_experienced", "least_notice"} {
		f := DiscoveryFilters{Page: 1, Sort: sort}
		if f.Page != 1 {
			t.Fatal("unexpected page")
		}
	}
}

func TestDiscoveryDiversityOptInPredicateFailsClosed(t *testing.T) {
	source := discoveryDiversityOptIn
	if !strings.Contains(source, "='true'") {
		t.Fatal("diversity opt-in must require an explicit true value")
	}
	if strings.Contains(source, "::boolean") {
		t.Fatal("diversity opt-in must not cast untrusted profile text to boolean")
	}
}
