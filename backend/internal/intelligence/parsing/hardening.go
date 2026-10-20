package parsing

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

// Processing is private review evidence, persisted inside the existing encrypted
// operation. It is never a telemetry payload or an authoritative profile update.
type Processing struct {
	Raw        json.RawMessage                   `json:"provider_value"`
	Normalized json.RawMessage                   `json:"normalized_value"`
	Metadata   map[string]contract.FieldMetadata `json:"field_metadata"`
	Issues     []contract.Issue                  `json:"issues"`
	Resolved   int                               `json:"taxonomy_resolved"`
	Total      int                               `json:"taxonomy_total"`
}

func (Processing) String() string     { return "ParserProcessing [private values withheld]" }
func (p Processing) GoString() string { return p.String() }

// Deliberately narrow labelled extraction. Conflicting repeated labels are not
// resolved by ordering. Inline prose, document instructions and taxonomy guesses
// are not evidence of a department or job family.
var labelled = regexp.MustCompile(`(?im)(?:^|[.;][ \t]+)(department|team|job family|role category|education|qualification|required certification|certification|name|candidate name|full name|current location):[ \t]*`)
var nextLabel = regexp.MustCompile(`\.\s+[A-Za-z][A-Za-z ]{1,30}:`)

func sourceLabels(text string, labels ...string) []string {
	var out []string
	for _, m := range labelled.FindAllStringSubmatchIndex(text, -1) {
		match := false
		for _, label := range labels {
			if strings.EqualFold(text[m[2]:m[3]], label) {
				match = true
			}
		}
		if !match {
			continue
		}
		value := text[m[1]:]
		if end := strings.IndexAny(value, ";\r\n"); end >= 0 {
			value = value[:end]
		}
		if loc := nextLabel.FindStringIndex(value); loc != nil {
			value = value[:loc[0]]
		}
		value = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(value), "."))
		if len(value) <= 300 && value != "" && !instructionLike(value) {
			out = append(out, value)
		}
	}
	return out
}
func oneLabel(text string, labels ...string) (string, bool) {
	values := sourceLabels(text, labels...)
	if len(values) == 0 {
		return "", false
	}
	for _, v := range values[1:] {
		if contract.ComparisonKey(v) != contract.ComparisonKey(values[0]) {
			return "", false
		}
	}
	return values[0], true
}
func instructionLike(s string) bool {
	lower := strings.ToLower(s)
	for _, word := range []string{"ignore", "instructions", "system prompt", "return exactly", "perfect match", "https://", "http://", "<", ">", "@"} {
		if strings.Contains(lower, word) {
			return true
		}
	}
	return false
}
func issue(p *Processing, code, path string) {
	p.Issues = append(p.Issues, contract.Issue{Severity: "warning", Code: code, Path: path})
}

func stableIssues(p *Processing) {
	sort.SliceStable(p.Issues, func(i, j int) bool {
		a, b := p.Issues[i], p.Issues[j]
		if a.Path != b.Path {
			return a.Path < b.Path
		}
		return a.Code < b.Code
	})
}

// NormalizeJobProposal preserves JSON nulls on the parser wire. DetailedJobInput
// has legacy non-optional ints, so serializing that editor DTO would turn an
// unknown minimum experience/openings into zero. The editor DTO remains unchanged.
func NormalizeJobProposal(raw []byte, text, hash string, aliases map[string]SkillMapping) (Processing, error) {
	p := Processing{Raw: append(json.RawMessage(nil), raw...), Issues: []contract.Issue{}}
	if len(raw) > contract.MaxContractBytes || len(text) > 128000 || len(hash) < 16 || len(hash) > 64 {
		return p, ErrInvalid
	}
	var fields map[string]json.RawMessage
	var job recruiter.DetailedJobInput
	if json.Unmarshal(raw, &fields) != nil || json.Unmarshal(raw, &job) != nil {
		return p, ErrInvalid
	}
	set := func(key string, value any, code string) {
		b, _ := json.Marshal(value)
		if string(b) != string(fields[key]) {
			fields[key] = b
			issue(&p, code, "/"+key)
		}
	}
	if value, ok := oneLabel(text, "department", "team"); ok {
		set("department", value, "SOURCE_LABEL_NORMALIZED")
	} else {
		if job.Department != "" {
			set("department", nil, "UNSUPPORTED_DEPARTMENT_REMOVED")
		}
		if len(sourceLabels(text, "department", "team")) > 0 {
			issue(&p, "CONFLICTING_SOURCE_LABELS", "/department")
		}
	}
	if value, ok := oneLabel(text, "job family", "role category"); ok {
		set("role_category", value, "SOURCE_LABEL_NORMALIZED")
	} else if len(sourceLabels(text, "job family", "role category")) > 1 {
		set("role_category", nil, "CONFLICTING_SOURCE_LABELS")
	}
	// Licences/certifications have no typed field on this existing JD wire. Retain
	// them in the original evidence and explicitly route to owner review, never
	// relabel them as degrees or silently create new contract fields.
	certs := sourceLabels(text, "required certification", "certification")
	for _, cert := range certs {
		var kept []string
		removed := false
		for _, value := range job.EducationRequirements {
			key := contract.ComparisonKey(value)
			certKey := contract.ComparisonKey(cert)
			isCert := key == certKey || key == certKey+" certification"
			for _, edu := range sourceLabels(text, "education", "qualification") {
				if contract.ComparisonKey(edu) == key {
					isCert = false
				}
			}
			if isCert {
				removed = true
			} else {
				kept = append(kept, value)
			}
		}
		if removed {
			set("education_requirements", kept, "CREDENTIAL_FIELD_PLACEMENT")
			job.EducationRequirements = kept
		}
		issue(&p, "TYPED_CREDENTIAL_REQUIRES_REVIEW", "/education_requirements")
	}
	p.Total = len(job.Skills)
	if job.Skills != nil {
		var skills []string
		skills, p.Resolved = normalizeJob(job.Skills, aliases)
		fields["skills"], _ = json.Marshal(skills)
	}
	encoded, _ := json.Marshal(fields)
	job = recruiter.DetailedJobInput{}
	if json.Unmarshal(encoded, &job) != nil || recruiter.ValidateAIJobParseProposal(job) != nil || !JobSalarySourceMatches(job, text) {
		return p, ErrInvalid
	}
	if job.Title == "" && len(job.Skills) == 0 && job.Description == "" && job.RoleCategory == "" {
		return p, ErrInvalid
	}
	p.Normalized = encoded
	p.Metadata = jobMetadata(fields, hash)
	providerField := jsonReader(p.Raw)
	for path, m := range p.Metadata {
		m.RawValue = providerField(path)
		if path == "/skills" && p.Resolved > 0 {
			m.Provenance.Source = "system_derived"
			m.Provenance.Kind = "normalized"
		}
		p.Metadata[path] = m
	}
	for key, value := range fields {
		if string(value) == "null" {
			issue(&p, "SOURCE_VALUE_UNKNOWN", "/"+key)
		}
	}
	for _, change := range p.Issues {
		if m, ok := p.Metadata[change.Path]; ok && change.Code == "SOURCE_LABEL_NORMALIZED" {
			m.Provenance.Source = "system_derived"
			m.Provenance.Kind = "normalized"
			p.Metadata[change.Path] = m
		}
	}
	stableIssues(&p)
	return p, nil
}

func plausibleName(value string, labelled bool) bool {
	words := strings.Fields(value)
	if len(value) > 100 || len(words) < 1 || len(words) > 7 || (!labelled && len(words) < 2) || instructionLike(value) {
		return false
	}
	for _, word := range []string{"resume", "curriculum", "vitae", "profile", "summary", "engineer", "manager", "developer", "accountant", "nurse", "technician", "recruiter", "anonymous", "unknown", "redacted"} {
		for _, w := range words {
			if strings.EqualFold(w, word) {
				return false
			}
		}
	}
	letters := 0
	for _, r := range value {
		if unicode.IsLetter(r) {
			letters++
		} else if !unicode.IsSpace(r) && !unicode.IsDigit(r) && !strings.ContainsRune("'-.\u2019", r) {
			return false
		}
	}
	return letters >= 2
}
func sourceName(text string, data contract.ProfileData) (string, bool) {
	if name, ok := oneLabel(text, "name", "candidate name", "full name"); ok && plausibleName(name, true) {
		return name, true
	}
	if len(sourceLabels(text, "name", "candidate name", "full name")) > 0 {
		return "", false
	}
	// Unlabelled header recovery needs a matching independent headline and at
	// least two CV section markers. Ambiguous headers remain absent for review.
	lines := strings.Split(strings.TrimSpace(text), "\n")
	if len(lines) < 3 || data.Professional.Headline == nil {
		return "", false
	}
	name, headline := strings.TrimSpace(lines[0]), strings.TrimSpace(lines[1])
	if !plausibleName(name, false) || contract.ComparisonKey(headline) != contract.ComparisonKey(*data.Professional.Headline) || strings.EqualFold(name, headline) {
		return "", false
	}
	sections := 0
	for _, marker := range []string{"\neducation:", "\nskills:", "\nemployer:", "\ncurrent location:"} {
		if strings.Contains(strings.ToLower(text), marker) {
			sections++
		}
	}
	return name, sections >= 2
}

// NormalizeCVProposal is shared by the production adapter and offline captured
// replay. It never consults golden labels and never writes candidate data.
func NormalizeCVProposal(raw []byte, text, hash string, aliases map[string]SkillMapping, asOf time.Time) (Processing, contract.ProfileData, error) {
	p := Processing{Raw: append(json.RawMessage(nil), raw...), Issues: []contract.Issue{}}
	var data contract.ProfileData
	if len(raw) > contract.MaxContractBytes || len(text) > 128000 || len(hash) < 16 || len(hash) > 64 || json.Unmarshal(raw, &data) != nil {
		return p, data, ErrInvalid
	}
	data, p.Resolved, p.Total = normalizeCV(data, aliases)
	kinds := map[string]contract.Provenance{}
	mark := func(path, kind, ref, code string) {
		kinds[path] = contract.Provenance{Source: "system_derived", Kind: kind, Section: strings.Split(strings.TrimPrefix(path, "/"), "/")[0], Reference: ref}
		issue(&p, code, path)
	}
	for i, skill := range data.Skills {
		if skill.Entity.ID != nil {
			for _, field := range []string{"name", "id", "namespace", "raw_value"} {
				path := fmt.Sprintf("/skills/%d/entity/%s", i, field)
				kinds[path] = contract.Provenance{Source: "system_derived", Kind: "normalized", Section: "skills", Reference: "intelligence:" + *skill.Entity.ID}
			}
		}
	}
	if data.Identity.DisplayName == nil || strings.TrimSpace(*data.Identity.DisplayName) == "" {
		if name, ok := sourceName(text, data); ok {
			data.Identity.DisplayName = &name
			mark("/identity/display_name", "explicit", "document:"+hash, "SOURCE_NAME_RECOVERED")
		} else {
			issue(&p, "DISPLAY_NAME_REQUIRES_REVIEW", "/identity/display_name")
		}
	}
	// Existing singular/multiple work-mode projections have defined ownership:
	// mirror one explicit enum only; never choose among conflicting preferences.
	if len(data.Preferences.WorkModes) == 1 {
		mode := data.Preferences.WorkModes[0]
		if data.Location.RemotePreference == nil {
			data.Location.RemotePreference = &mode
			mark("/location/remote_preference", "normalized", "preferences/work_modes/0", "DUPLICATE_PROJECTION_NORMALIZED")
		} else if *data.Location.RemotePreference != mode && *data.Location.RemotePreference != "flexible" {
			issue(&p, "WORK_PREFERENCE_CONFLICT", "/location/remote_preference")
		}
	}
	// Country normalization only from an explicit current-location label with
	// the same existing city/state. Never inherit it for preferred cities.
	if data.Location.Current != nil && data.Location.Current.CountryCode == nil {
		if location, ok := oneLabel(text, "current location"); ok {
			parts := strings.Split(location, ",")
			if len(parts) == 2 && strings.EqualFold(strings.TrimSpace(parts[1]), "India") {
				place := strings.TrimSpace(parts[0])
				current := data.Location.Current
				if current.City != nil && strings.EqualFold(place, *current.City) || current.State != nil && strings.EqualFold(place, *current.State) {
					country := "IN"
					current.CountryCode = &country
					mark("/location/current/country_code", "normalized", "document:"+hash, "EXPLICIT_COUNTRY_NORMALIZED")
				}
			}
		}
	}
	// A missing duplicate qualification may use the explicit degree, but do not
	// concatenate or guess a taxonomy ID. Full qualification vs degree+study is
	// deliberately preserved as a representation difference in strict metrics.
	for i := range data.Education {
		edu := &data.Education[i]
		path := fmt.Sprintf("/education/%d", i)
		if edu.Qualification.Name == nil && edu.Degree != nil {
			value := *edu.Degree
			edu.Qualification.Name = &value
			mark(path+"/qualification/name", "normalized", path+"/degree", "DUPLICATE_PROJECTION_NORMALIZED")
		}
		if edu.Degree == nil && edu.Qualification.Name != nil {
			value := *edu.Qualification.Name
			edu.Degree = &value
			mark(path+"/degree", "normalized", path+"/qualification/name", "DUPLICATE_PROJECTION_NORMALIZED")
		}
	}
	calc := contract.CalculateExperience(data.Employment, asOf)
	if calc.Months != nil {
		if data.Professional.TotalExperienceMonths != nil && *data.Professional.TotalExperienceMonths != *calc.Months {
			issue(&p, "EXPERIENCE_SOURCE_CONFLICT", "/professional/total_experience_months")
		}
		data.Professional.TotalExperienceMonths = calc.Months
		mark("/professional/total_experience_months", "derived", "employment", "EXPERIENCE_CALCULATED")
	} else if data.Professional.TotalExperienceMonths != nil {
		issue(&p, "EXPERIENCE_TOTAL_REQUIRES_REVIEW", "/professional/total_experience_months")
	} // Unknown derivation is not evidence against an explicit zero (or total).
	p.Issues = append(p.Issues, calc.Issues...)
	current, issues := contract.CurrentEmployment(data.Employment, asOf)
	p.Issues = append(p.Issues, issues...)
	if current != nil {
		data.Professional.CurrentCompany = current.Company
		data.Professional.CurrentDesignation = current.Designation
		for _, key := range []string{"current_company", "current_designation"} {
			mark("/professional/"+key+"/name", "derived", "employment", "CURRENT_ROLE_CALCULATED")
		}
	}
	if data.Professional.EmploymentStatus == nil {
		if sourceBackedEmployeeStatus(text, current, asOf) {
			status := "employed"
			data.Professional.EmploymentStatus = &status
			mark("/professional/employment_status", "derived", "document:"+hash+"#employment", "EMPLOYMENT_STATUS_SOURCE_DERIVED")
		} else {
			issue(&p, "EMPLOYMENT_STATUS_REQUIRES_REVIEW", "/professional/employment_status")
		}
	}
	p.Metadata = contract.ProposedMetadata(data, "ai_derived")
	providerField := jsonReader(p.Raw)
	for path, m := range p.Metadata {
		normalizedValue := m.RawValue
		m.Confidence = nil
		m.Provenance.Kind = "inferred"
		m.Provenance.Reference = "document:" + hash
		m.RawValue = providerField(path)
		if provenance, ok := kinds[path]; ok {
			m.Provenance = provenance
			if provenance.Kind == "explicit" {
				m.RawValue = normalizedValue
			}
		}
		p.Metadata[path] = m
	}
	for _, path := range []string{"roles", "functions", "industries", "domains"} {
		var entries []contract.EntityRef
		switch path {
		case "roles":
			entries = data.Classification.Roles
		case "functions":
			entries = data.Classification.Functions
		case "industries":
			entries = data.Classification.Industries
		case "domains":
			entries = data.Classification.Domains
		}
		if len(entries) > 0 {
			issue(&p, "INFERRED_CLASSIFICATION_REQUIRES_REVIEW", "/classification/"+path)
		}
	}
	p.Normalized, _ = json.Marshal(data)
	stableIssues(&p)
	return p, data, nil
}

func (v Processing) LogValue() slog.Value { return slog.StringValue(v.String()) }
