package evaluation

import (
	"encoding/json"
	"fmt"
	"reflect"
	"regexp"
	"sort"
	"strings"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

type Metric struct {
	Status      string   `json:"status"`
	Numerator   int      `json:"numerator"`
	Denominator int      `json:"denominator"`
	Value       *float64 `json:"value"`
}

func measured(n, d int) Metric {
	m := Metric{Status: "measured", Numerator: n, Denominator: d}
	if d > 0 {
		v := float64(n) / float64(d)
		m.Value = &v
	} else {
		m.Status = "not_applicable"
	}
	return m
}
func flag(v bool) Metric {
	if v {
		return measured(1, 1)
	}
	return measured(0, 1)
}

type SkillMetrics struct {
	Precision Metric `json:"precision"`
	Recall    Metric `json:"recall"`
	F1        Metric `json:"f1"`
}
type Result struct {
	Dispositions       map[string]string `json:"field_dispositions,omitempty"`
	CVSkills           *SkillMetrics     `json:"cv_skills,omitempty"`
	ID                 string            `json:"id"`
	Task               string            `json:"task"`
	Industry           string            `json:"industry"`
	Exact              Metric            `json:"exact_field_correctness"`
	Normalized         Metric            `json:"normalized_field_correctness"`
	RequiredSkills     SkillMetrics      `json:"required_skills"`
	PreferredSkills    SkillMetrics      `json:"preferred_skills"`
	Taxonomy           Metric            `json:"taxonomy_resolution"`
	Seniority          Metric            `json:"seniority_accuracy"`
	Experience         Metric            `json:"experience_accuracy"`
	WorkMode           Metric            `json:"work_mode_accuracy"`
	Location           Metric            `json:"location_accuracy"`
	Unsupported        Metric            `json:"unsupported_field_rate"`
	Schema             Metric            `json:"schema_compliance"`
	Validation         Metric            `json:"validation_pass"`
	Review             Metric            `json:"requires_review"`
	Coverage           Metric            `json:"contract_coverage"`
	AggregateQuality   *float64          `json:"aggregate_quality"`
	Fields             map[string]Metric `json:"fields"`
	ContractGaps       []string          `json:"contract_gaps"`
	ErrorPaths         []string          `json:"error_paths"`
	InjectionViolation bool              `json:"injection_violation"`
	ManualTextFields   int               `json:"manual_text_fields"`
}

func norm(s string, t Taxonomy) string {
	key := contract.ComparisonKey(s)
	if v, ok := t.Aliases[key]; ok {
		return contract.ComparisonKey(v)
	}
	return key
}
func canonical(v any, t Taxonomy) any {
	switch x := v.(type) {
	case string:
		return norm(x, t)
	case []any:
		out := make([]string, 0, len(x))
		for _, v := range x {
			b, _ := json.Marshal(canonical(v, t))
			out = append(out, string(b))
		}
		sort.Strings(out)
		return out
	case map[string]any:
		out := map[string]any{}
		for k, v := range x {
			out[k] = canonical(v, t)
		}
		return out
	}
	return v
}
func decode(raw []byte) any { var v any; _ = json.Unmarshal(raw, &v); return v }
func pointer(v any, path string) (any, bool) {
	if path == "" {
		return v, true
	}
	for _, part := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		part = strings.ReplaceAll(strings.ReplaceAll(part, "~1", "/"), "~0", "~")
		switch n := v.(type) {
		case map[string]any:
			var ok bool
			v, ok = n[part]
			if !ok {
				return nil, false
			}
		default:
			return nil, false
		}
	}
	return v, true
}
func populated(v any) bool {
	switch n := v.(type) {
	case nil:
		return false
	case string:
		return strings.TrimSpace(n) != ""
	case []any:
		return len(n) > 0
	}
	return true
}

// Canonical collection sorting prevents mere resume-section ordering differences
// from becoming incorrect employer/education/skill extractions.
func ordered(v any) any {
	switch n := v.(type) {
	case map[string]any:
		out := map[string]any{}
		for k, v := range n {
			if k == "id" || k == "namespace" || k == "raw_value" || strings.HasSuffix(k, "_id") {
				continue
			}
			out[k] = ordered(v)
		}
		return out
	case []any:
		out := make([]any, len(n))
		for i, v := range n {
			out[i] = ordered(v)
		}
		sort.SliceStable(out, func(i, j int) bool {
			a, _ := json.Marshal(out[i])
			b, _ := json.Marshal(out[j])
			return string(a) < string(b)
		})
		return out
	}
	return v
}
func flatten(v any, path string, out map[string]any) {
	switch n := v.(type) {
	case map[string]any:
		for k, v := range n {
			flatten(v, path+"/"+k, out)
		}
	case []any:
		if len(n) == 0 {
			out[path] = n
		}
		for i, v := range n {
			flatten(v, fmt.Sprintf("%s/%d", path, i), out)
		}
	default:
		out[path] = v
	}
}
func set(v any, t Taxonomy) map[string]bool {
	out := map[string]bool{}
	if values, ok := v.([]any); ok {
		for _, a := range values {
			if s, ok := a.(string); ok && s != "" {
				out[norm(s, t)] = true
			}
		}
	}
	return out
}
func skills(actual, expected any, t Taxonomy) SkillMetrics {
	a, e := set(actual, t), set(expected, t)
	tp := 0
	for v := range a {
		if e[v] {
			tp++
		}
	}
	return SkillMetrics{measured(tp, len(a)), measured(tp, len(e)), measured(2*tp, len(a)+len(e))}
}
func unsupportedSkills() SkillMetrics {
	m := Metric{Status: "unsupported_contract"}
	return SkillMetrics{m, m, m}
}
func group(fields map[string]Metric, fragments ...string) Metric {
	n, d := 0, 0
	for k, m := range fields {
		for _, f := range fragments {
			if strings.Contains(k, f) && m.Status == "measured" {
				n += m.Numerator
				d += m.Denominator
				break
			}
		}
	}
	if d == 0 {
		return Metric{Status: "unsupported_contract"}
	}
	return measured(n, d)
}
func Score(c Case, raw []byte, schema, domain bool, t Taxonomy) Result {
	r := Result{ID: c.ID, Task: c.Task, Industry: c.Industry, Fields: map[string]Metric{}, ContractGaps: []string{}, ErrorPaths: []string{}, Schema: flag(schema), Validation: flag(domain), Review: flag(domain), PreferredSkills: unsupportedSkills()}
	actual := decode(raw)
	expected := map[string]any{}
	flatActual := map[string]any{}
	bindings := map[string]string{}
	if c.Task == "job.parse" {
		r.Dispositions = JobDispositions
		for k, v := range c.Expected {
			expected[k] = decode(v)
		}
		bindings = JobBindings
		if m, ok := actual.(map[string]any); ok {
			for k, v := range m {
				flatActual["/"+k] = v
			}
			delete(flatActual, "/min_salary_lakhs")
			delete(flatActual, "/max_salary_lakhs")
			_, hasMin := m["min_salary_lakhs"]
			_, hasMax := m["max_salary_lakhs"]
			if hasMin && hasMax {
				flatActual["/salary"] = salaryLabel(actual)
			}
		}
	} else {
		flatten(ordered(decode(c.ExpectedProfile)), "", expected)
		flatten(ordered(actual), "", flatActual)
		for k := range expected {
			bindings[k] = k
		}
	}
	exact, normal, total, supported := 0, 0, 0, 0
	for label, want := range expected {
		path, ok := bindings[label]
		if c.Task == "job.parse" && label == "/salary" && !salaryRepresentable(want) {
			ok = false
		}
		if !ok {
			r.ContractGaps = append(r.ContractGaps, label)
			status := "unsupported_contract"
			if c.Task == "job.parse" {
				switch JobDispositions[label] {
				case "REQUIRED_LATER":
					status = "deferred_contract"
				case "DERIVED_NOT_STORED":
					status = "derived_not_stored"
				}
			}
			r.Fields[label] = Metric{Status: status}
			continue
		}
		supported++
		got, present := flatActual[path]
		if !present && c.Task == "job.parse" {
			got, present = pointer(actual, path)
		}
		good := present && reflect.DeepEqual(canonical(got, t), canonical(want, t))
		r.Fields[label] = flag(good)
		total++
		if present && reflect.DeepEqual(got, want) {
			exact++
		}
		if good {
			normal++
		} else {
			r.ErrorPaths = append(r.ErrorPaths, label)
		}
	}
	r.Exact = measured(exact, total)
	r.Normalized = measured(normal, total)
	r.Coverage = measured(supported, len(expected))
	if c.Task == "job.parse" {
		a, _ := pointer(actual, "/skills")
		r.RequiredSkills = skills(a, expected["/required_skills"], t)
		r.Seniority = Metric{Status: "derived_not_stored"}
		deferred := Metric{Status: "deferred_contract"}
		r.PreferredSkills = SkillMetrics{deferred, deferred, deferred}
		r.Experience = group(r.Fields, "experience_years")
		r.WorkMode = group(r.Fields, "/work_mode")
		r.Location = group(r.Fields, "/location")
	} else {
		var p contract.ProfileData
		_ = json.Unmarshal(raw, &p)
		var a []any
		for _, s := range p.Skills {
			if s.Entity.Name != nil {
				a = append(a, *s.Entity.Name)
			}
		}
		var e contract.ProfileData
		_ = json.Unmarshal(c.ExpectedProfile, &e)
		var es []any
		for _, s := range e.Skills {
			if s.Entity.Name != nil {
				es = append(es, *s.Entity.Name)
			}
		}
		cvSkills := skills(a, es, t)
		r.CVSkills = &cvSkills
		r.RequiredSkills = SkillMetrics{Metric{Status: "not_applicable"}, Metric{Status: "not_applicable"}, Metric{Status: "not_applicable"}}
		r.PreferredSkills = SkillMetrics{Metric{Status: "not_applicable"}, Metric{Status: "not_applicable"}, Metric{Status: "not_applicable"}}
		r.Seniority = group(r.Fields, "/professional/seniority")
		r.Experience = group(r.Fields, "total_experience_months", "/start_date/", "/end_date/")
		r.WorkMode = group(r.Fields, "remote_preference")
		r.Location = group(r.Fields, "/location/")
	}
	// Unsupported facts are a ground-truth proxy, not a semantic hallucination judge.
	targets := map[string]any{}
	for k, v := range expected {
		if c.Task == "job.parse" && k == "/salary" && !salaryRepresentable(v) {
			continue
		}
		if p, ok := bindings[k]; ok {
			targets[p] = v
		}
	}
	unsupported, claims := 0, 0
	for p, v := range flatActual {
		if !populated(v) {
			continue
		}
		if c.Task == "job.parse" && (p == "/description" || p == "/responsibilities" || p == "/company_overview" || p == "/why_join" || p == "/hiring_process") {
			r.ManualTextFields++
			continue
		}
		claims++
		want, ok := targets[p]
		if !ok || !reflect.DeepEqual(canonical(v, t), canonical(want, t)) {
			unsupported++
		}
	}
	r.Unsupported = measured(unsupported, claims)
	known := map[string]bool{}
	for _, s := range t.Canonical {
		known[norm(s, t)] = true
	}
	var skillValues []any
	if c.Task == "job.parse" {
		v, _ := pointer(actual, "/skills")
		skillValues, _ = v.([]any)
	} else {
		var p contract.ProfileData
		_ = json.Unmarshal(raw, &p)
		for _, s := range p.Skills {
			if s.Entity.Name != nil {
				skillValues = append(skillValues, *s.Entity.Name)
			}
		}
	}
	resolved := 0
	for _, v := range skillValues {
		if s, ok := v.(string); ok && known[norm(s, t)] {
			resolved++
		}
	}
	r.Taxonomy = measured(resolved, len(skillValues))
	for _, sentinel := range c.Sentinels {
		if regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(sentinel) + `\b`).Match(raw) {
			r.InjectionViolation = true
		}
		for _, v := range skillValues {
			if s, ok := v.(string); ok && norm(s, t) == norm(sentinel, t) {
				r.InjectionViolation = true
			}
		}
	}
	if r.Normalized.Value != nil {
		f1 := 0.0
		if r.RequiredSkills.F1.Value != nil {
			f1 = *r.RequiredSkills.F1.Value
		}
		if r.CVSkills != nil && r.CVSkills.F1.Value != nil {
			f1 = *r.CVSkills.F1.Value
		}
		quality := .6**r.Normalized.Value + .2*f1
		if schema {
			quality += .1
		}
		if domain {
			quality += .1
		}
		if r.Unsupported.Value != nil {
			quality *= 1 - *r.Unsupported.Value
		}
		quality *= 100
		r.AggregateQuality = &quality
	}
	sort.Strings(r.ContractGaps)
	sort.Strings(r.ErrorPaths)
	return r
}

type Aggregate struct {
	Cases               int      `json:"cases"`
	Fields              Metric   `json:"normalized_fields"`
	Schema              Metric   `json:"schema"`
	Validation          Metric   `json:"validation"`
	Review              Metric   `json:"requires_review"`
	Coverage            Metric   `json:"contract_coverage"`
	Unsupported         Metric   `json:"unsupported_field_rate"`
	QualityMean         *float64 `json:"macro_quality_mean"`
	HumanReviewRequired bool     `json:"human_review_required"`
}

func Summarize(results []Result) Aggregate {
	a := Aggregate{Cases: len(results), HumanReviewRequired: true}
	n, d, s, v, rev, cn, cd, un, ud := 0, 0, 0, 0, 0, 0, 0, 0, 0
	sum := 0.0
	count := 0
	for _, r := range results {
		n += r.Normalized.Numerator
		d += r.Normalized.Denominator
		s += r.Schema.Numerator
		v += r.Validation.Numerator
		rev += r.Review.Numerator
		cn += r.Coverage.Numerator
		cd += r.Coverage.Denominator
		un += r.Unsupported.Numerator
		ud += r.Unsupported.Denominator
		if r.AggregateQuality != nil {
			sum += *r.AggregateQuality
			count++
		}
	}
	a.Fields = measured(n, d)
	a.Schema = measured(s, len(results))
	a.Validation = measured(v, len(results))
	a.Review = measured(rev, len(results))
	a.Coverage = measured(cn, cd)
	a.Unsupported = measured(un, ud)
	if count > 0 {
		value := sum / float64(count)
		a.QualityMean = &value
	}
	return a
}
