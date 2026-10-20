package evaluation

// Dispositions are product decisions, not model grades. Source-authored labels
// remain present even when they cannot be represented by the current contract.
var JobDispositions = map[string]string{
	"/title": "REQUIRED_NOW", "/normalized_title": "DERIVED_NOT_STORED",
	"/job_family": "REQUIRED_NOW", "/industry": "REQUIRED_LATER",
	"/seniority": "DERIVED_NOT_STORED", "/min_experience_years": "REQUIRED_NOW",
	"/max_experience_years": "REQUIRED_NOW", "/required_skills": "REQUIRED_NOW",
	"/preferred_skills": "REQUIRED_LATER", "/certifications": "REQUIRED_LATER",
	"/education_requirements": "REQUIRED_NOW", "/location": "REQUIRED_NOW",
	"/work_mode": "REQUIRED_NOW", "/employment_type": "REQUIRED_NOW",
	"/notice_period_days": "REQUIRED_LATER", "/salary": "REQUIRED_NOW", "/openings": "REQUIRED_NOW",
}

func salaryRepresentable(want any) bool {
	if want == nil {
		return true
	}
	m, ok := want.(map[string]any)
	return ok && m["currency"] == "INR" && m["period"] == "annual"
}

// The editor stores annual INR in lakhs. Compare to authored currency/period
// labels without hiding either endpoint, an absent range or invented salary.
func salaryLabel(actual any) any {
	m, ok := actual.(map[string]any)
	if !ok {
		return nil
	}
	lo, hi := m["min_salary_lakhs"], m["max_salary_lakhs"]
	if lo == nil && hi == nil {
		return nil
	}
	convert := func(v any) any {
		if n, ok := v.(float64); ok {
			return n * 100000
		}
		return v
	}
	return map[string]any{"currency": "INR", "period": "annual", "minimum": convert(lo), "maximum": convert(hi)}
}
