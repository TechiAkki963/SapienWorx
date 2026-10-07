package recruiter

import (
	"fmt"
	"math"
	stdstrconv "strconv"
	"strings"
)

// Pool filters are applied to both count and page queries after the privacy predicate.
type TalentPoolFilters struct {
	Location                        string
	MinMonths, MaxMonths, MaxNotice *int
}

func ParseTalentPoolFilters(values map[string]string) (TalentPoolFilters, error) {
	f := TalentPoolFilters{Location: strings.TrimSpace(values["location"])}
	if len(f.Location) > 120 {
		return f, ErrInvalid
	}
	for _, pair := range []struct {
		key    string
		target **int
	}{{"min_experience", &f.MinMonths}, {"max_experience", &f.MaxMonths}} {
		if raw := values[pair.key]; raw != "" {
			v, err := stdstrconv.ParseFloat(raw, 64)
			if err != nil || math.IsNaN(v) || math.IsInf(v, 0) || v < 0 || v > 100 {
				return f, ErrInvalid
			}
			months := int(math.Round(v * 12))
			*pair.target = &months
		}
	}
	if raw := values["max_notice_days"]; raw != "" {
		v, err := stdstrconv.Atoi(raw)
		if err != nil || v < 0 || v > 365 {
			return f, ErrInvalid
		}
		f.MaxNotice = &v
	}
	if f.MinMonths != nil && f.MaxMonths != nil && *f.MinMonths > *f.MaxMonths {
		return f, ErrInvalid
	}
	return f, nil
}
func poolFilterSQL(args *[]any, options []TalentPoolFilters) string {
	if len(options) == 0 {
		return ""
	}
	f := options[0]
	clauses := []string{}
	add := func(value any, expression string) {
		*args = append(*args, value)
		clauses = append(clauses, fmt.Sprintf(expression, len(*args)))
	}
	if f.Location != "" {
		add(discoveryPattern(f.Location), `cp.current_city ILIKE $%d ESCAPE '\'`)
	}
	if f.MinMonths != nil {
		add(*f.MinMonths, `cp.total_experience_months >= $%d`)
	}
	if f.MaxMonths != nil {
		add(*f.MaxMonths, `cp.total_experience_months <= $%d`)
	}
	if f.MaxNotice != nil {
		add(*f.MaxNotice, `cp.notice_period_days <= $%d`)
	}
	if len(clauses) == 0 {
		return ""
	}
	return " AND " + strings.Join(clauses, " AND ")
}
