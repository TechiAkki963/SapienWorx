package profilecontract

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/mail"
	"net/url"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const MaxContractBytes = 1 << 20

var uuidPattern = regexp.MustCompile(`(?i)^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$`)
var phonePattern = regexp.MustCompile(`^\+[1-9][0-9]{7,14}$`)
var decimalPattern = regexp.MustCompile(`^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?$`)
var codePattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]{0,63}$`)
var providerPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$`)

type rules struct {
	Countries  string
	Currencies []string
	Limits     map[string]float64
}
type Validator struct{ rules rules }

// NewValidator reuses the existing embedded candidate profile_contract.json.
// There is no second currency/country list and no permissive default policy.
func NewValidator(existingRules []byte) (*Validator, error) {
	var r rules
	if json.Unmarshal(existingRules, &r) != nil || len(strings.Fields(r.Countries)) < 1 || len(r.Currencies) < 1 || r.Limits["max_experience_months"] <= 0 || r.Limits["max_notice_days"] <= 0 {
		return nil, ErrInvalidContract
	}
	return &Validator{rules: r}, nil
}

func indexPath(path string, i int) string { return path + "/" + strconv.Itoa(i) }
func has(items []string, s string) bool {
	for _, v := range items {
		if v == s {
			return true
		}
	}
	return false
}
func (r *ValidationReport) add(severity, code, path string) {
	if len(r.Issues) < 1000 {
		r.Issues = append(r.Issues, Issue{severity, code, path})
	}
}

func safeURL(text string) bool {
	u, e := url.Parse(text)
	return e == nil && u.Scheme == "https" && u.Hostname() != "" && u.User == nil && len(text) <= 2048 && !strings.ContainsAny(text, "\r\n\t")
}

func (v *Validator) ValidateProfile(p CandidateProfile, asOf time.Time) ValidationReport {
	r := v.ValidateData(p.Profile, asOf)
	if p.SchemaVersion != Version {
		r.add("error", "UNSUPPORTED_VERSION", "/schema_version")
	}
	if !uuidPattern.MatchString(p.CandidateID) {
		r.add("error", "INVALID_ID", "/candidate_id")
	}
	if p.Profile.Identity.DisplayName == nil || strings.TrimSpace(*p.Profile.Identity.DisplayName) == "" {
		r.add("error", "DISPLAY_NAME_REQUIRED", "/identity/display_name")
	}
	if len(p.Resumes) > 30 {
		r.add("error", "COLLECTION_LIMIT", "/resumes")
	}
	seen := map[string]bool{}
	for i, resume := range p.Resumes {
		if i >= 30 {
			break
		}
		v.validateResume(resume, indexPath("/resumes", i), &r)
		if seen[resume.ResumeID] {
			r.add("error", "DUPLICATE_RESUME_ID", indexPath("/resumes", i))
		}
		seen[resume.ResumeID] = true
	}
	return r
}

func (v *Validator) ValidateData(p ProfileData, asOf time.Time) ValidationReport {
	r := ValidationReport{Issues: []Issue{}}
	v.walk(reflect.ValueOf(p), "", asOf, &r)
	for path, value := range map[string]*string{"/contact/primary_email": p.Contact.PrimaryEmail, "/contact/alternate_email": p.Contact.AlternateEmail} {
		if value != nil {
			address, e := mail.ParseAddress(*value)
			if e != nil || address.Address != *value || address.Name != "" || !strings.Contains(*value, ".") {
				r.add("error", "INVALID_EMAIL", path)
			}
		}
	}
	for path, value := range map[string]*string{"/contact/primary_phone": p.Contact.PrimaryPhone, "/contact/alternate_phone": p.Contact.AlternatePhone} {
		if value != nil && !phonePattern.MatchString(*value) {
			r.add("error", "INVALID_PHONE", path)
		}
	}
	current := 0
	for i, item := range p.Employment {
		if i >= 30 {
			break
		}
		path := indexPath("/employment", i)
		v.chronology(item.StartDate, item.EndDate, path, asOf, true, &r)
		if item.IsCurrent != nil && *item.IsCurrent {
			current++
			if item.EndDate != nil {
				r.add("error", "CURRENT_ROLE_HAS_END", path+"/end_date")
			}
		}
		if item.Company.Name == nil {
			r.add("warning", "EMPLOYER_MISSING", path+"/company/name")
		}
	}
	if current > 1 {
		r.add("warning", "MULTIPLE_CURRENT_ROLES", "/employment")
	}
	calculation := CalculateExperience(p.Employment, asOf)
	for _, issue := range calculation.Issues {
		r.add(issue.Severity, issue.Code, issue.Path)
	}
	if calculation.Months != nil && p.Professional.TotalExperienceMonths != nil && abs(*calculation.Months-*p.Professional.TotalExperienceMonths) > 12 {
		r.add("warning", "EXPERIENCE_TOTAL_DIFFERS", "/professional/total_experience_months")
	}
	for i, item := range p.Education {
		if i >= 30 {
			break
		}
		path := indexPath("/education", i)
		v.chronology(item.StartDate, item.EndDate, path, asOf, false, &r)
		if item.Grade != nil && item.GradeType != nil {
			max := 0.0
			switch *item.GradeType {
			case "cgpa_10":
				max = 10
			case "gpa_4":
				max = 4
			case "percentage":
				max = 100
			}
			if max > 0 {
				n, e := strconv.ParseFloat(strings.TrimSuffix(*item.Grade, "%"), 64)
				if e != nil || math.IsNaN(n) || math.IsInf(n, 0) || n < 0 || n > max {
					r.add("error", "INVALID_GRADE", path+"/grade")
				}
			}
		}
	}
	for i, item := range p.Certifications {
		if i >= 30 {
			break
		}
		path := indexPath("/certifications", i)
		v.chronology(item.IssueDate, item.ExpiryDate, path, asOf, false, &r)
		if item.DoesNotExpire != nil && *item.DoesNotExpire && item.ExpiryDate != nil {
			r.add("error", "NONEXPIRING_HAS_EXPIRY", path+"/expiry_date")
		}
	}
	for i, item := range p.Projects {
		if i >= 30 {
			break
		}
		v.chronology(item.StartDate, item.EndDate, indexPath("/projects", i), asOf, false, &r)
	}
	if p.Availability.ImmediateJoiner != nil && *p.Availability.ImmediateJoiner && p.Availability.NoticePeriodDays != nil && *p.Availability.NoticePeriodDays > 0 {
		r.add("warning", "AVAILABILITY_CONFLICT", "/availability")
	}
	v.duplicates(reflect.ValueOf(p), "", &r)
	return r
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}
func (v *Validator) chronology(start, end *PartialDate, path string, asOf time.Time, past bool, r *ValidationReport) {
	if start == nil {
		return
	}
	minStart, _, ok := start.bounds()
	if !ok || minStart.IsZero() {
		return
	}
	if past && minStart.After(asOf) {
		r.add("warning", "FUTURE_EMPLOYMENT_DATE", path+"/start_date")
	}
	if end != nil {
		minEnd, maxEnd, ok := end.bounds()
		if ok && !minEnd.IsZero() {
			if maxEnd.Before(minStart) {
				r.add("error", "END_BEFORE_START", path+"/end_date")
			}
			if past && minEnd.After(asOf) {
				r.add("warning", "FUTURE_EMPLOYMENT_DATE", path+"/end_date")
			}
		}
	}
}

func (v *Validator) walk(value reflect.Value, path string, asOf time.Time, r *ValidationReport) {
	if value.Kind() == reflect.Pointer {
		if value.IsNil() {
			return
		}
		value = value.Elem()
	}
	if value.Type() == reflect.TypeFor[PartialDate]() {
		d := value.Interface().(PartialDate)
		if _, _, ok := d.bounds(); !ok {
			r.add("error", "INVALID_DATE", path)
		}
		if d.RawValue != nil && (!utf8.ValidString(*d.RawValue) || utf8.RuneCountInString(*d.RawValue) > 5000) {
			r.add("error", "TEXT_LIMIT", path+"/raw_value")
		}
		return
	}
	if value.Type() == reflect.TypeFor[EntityRef]() {
		e := value.Interface().(EntityRef)
		if e.ID != nil {
			if !uuidPattern.MatchString(*e.ID) || e.Namespace == nil || !has([]string{"workforce", "intelligence", "companies"}, *e.Namespace) {
				r.add("error", "INVALID_TAXONOMY_REFERENCE", path)
			} else {
				r.add("info", "TAXONOMY_RESOLUTION_REQUIRED", path)
			}
		} else if e.Namespace != nil {
			r.add("error", "TAXONOMY_ID_MISSING", path)
		}
	}
	if value.Type() == reflect.TypeFor[Money]() {
		m := value.Interface().(Money)
		if m.Amount != nil {
			if !decimalPattern.MatchString(*m.Amount) {
				r.add("error", "INVALID_AMOUNT", path+"/amount")
			}
			if m.Currency == nil {
				r.add("error", "CURRENCY_REQUIRED", path+"/currency")
			}
			if m.Period == nil {
				r.add("warning", "SALARY_PERIOD_UNKNOWN", path+"/period")
			}
		}
	}
	switch value.Kind() {
	case reflect.Struct:
		t := value.Type()
		for i := 0; i < value.NumField(); i++ {
			field := t.Field(i)
			key := strings.Split(field.Tag.Get("json"), ",")[0]
			if key == "" || key == "-" {
				continue
			}
			child := value.Field(i)
			p := path + "/" + key
			check := child
			if check.Kind() == reflect.Pointer {
				if check.IsNil() {
					continue
				}
				check = check.Elem()
			}
			if choices := field.Tag.Get("enum"); choices != "" {
				if check.Kind() == reflect.String && !has(strings.Split(choices, ","), check.String()) {
					r.add("error", "INVALID_ENUM", p)
				}
				if check.Kind() == reflect.Slice {
					for j := 0; j < check.Len() && j < 100; j++ {
						if !has(strings.Split(choices, ","), check.Index(j).String()) {
							r.add("error", "INVALID_ENUM", indexPath(p, j))
						}
					}
				}
			}
			if check.Kind() == reflect.String {
				str := check.String()
				max := 240
				if key == "summary" || key == "description" {
					max = 5000
				}
				if key == "raw_value" {
					max = 5000
				}
				if key == "url" || strings.HasSuffix(key, "_url") {
					max = 2048
					if !safeURL(str) {
						r.add("error", "INVALID_URL", p)
					}
				}
				if !utf8.ValidString(str) || utf8.RuneCountInString(str) > max {
					r.add("error", "TEXT_LIMIT", p)
				}
				if str == "" {
					r.add("error", "EMPTY_VALUE_USE_NULL", p)
				}
				if key == "country_code" && !has(strings.Fields(v.rules.Countries), str) {
					r.add("error", "INVALID_COUNTRY", p)
				}
				if key == "currency" && !has(v.rules.Currencies, str) {
					r.add("error", "INVALID_CURRENCY", p)
				}
				if (field.Tag.Get("system") == "true" || key == "id") && !uuidPattern.MatchString(str) {
					r.add("error", "INVALID_ID", p)
				}
			}
			if check.Kind() == reflect.Int {
				n := check.Int()
				switch key {
				case "total_experience_months", "relevant_experience_months", "experience_months":
					if n < 0 || n > int64(v.rules.Limits["max_experience_months"]) {
						r.add("error", "INVALID_EXPERIENCE", p)
					}
				case "notice_period_days":
					if n < 0 || n > int64(v.rules.Limits["max_notice_days"]) {
						r.add("error", "INVALID_NOTICE_PERIOD", p)
					}
				case "graduation_year":
					if n < 1900 || n > 2100 {
						r.add("error", "INVALID_YEAR", p)
					}
				}
			}
			v.walk(child, p, asOf, r)
		}
	case reflect.Slice:
		max := collectionLimit(path)
		if value.Len() > max {
			r.add("error", "COLLECTION_LIMIT", path)
		}
		for i := 0; i < value.Len() && i < max; i++ {
			v.walk(value.Index(i), indexPath(path, i), asOf, r)
		}
	case reflect.String:
		if !utf8.ValidString(value.String()) || utf8.RuneCountInString(value.String()) > 5000 {
			r.add("error", "TEXT_LIMIT", path)
		}
	}
}

func collectionLimit(path string) int {
	if strings.Contains(path, "/skills") {
		return 100
	}
	if strings.HasSuffix(path, "/links") {
		return 20
	}
	if strings.HasSuffix(path, "/preferred") {
		return 10
	}
	return 30
}

func (v *Validator) validateResume(resume ResumeMetadata, path string, r *ValidationReport) {
	if !uuidPattern.MatchString(resume.ResumeID) {
		r.add("error", "INVALID_ID", path+"/resume_id")
	}
	if resume.OriginalFilename != nil {
		f := *resume.OriginalFilename
		if len(f) > 255 || !utf8.ValidString(f) || strings.TrimSpace(f) == "" || strings.ContainsAny(f, "/\\\r\n\x00") {
			r.add("error", "INVALID_FILENAME", path+"/original_filename")
		}
	}
	if resume.MIMEType != nil && !has([]string{"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}, *resume.MIMEType) {
		r.add("error", "INVALID_MIME_TYPE", path+"/mime_type")
	}
	if resume.FileSize != nil && (*resume.FileSize <= 0 || *resume.FileSize > 100<<20) {
		r.add("error", "INVALID_FILE_SIZE", path+"/file_size")
	}
	if resume.PageCount != nil && (*resume.PageCount < 1 || *resume.PageCount > 100) {
		r.add("error", "INVALID_PAGE_COUNT", path+"/page_count")
	}
	if resume.Purpose != nil && !has([]string{"primary", "historical", "role_specific"}, *resume.Purpose) {
		r.add("error", "INVALID_ENUM", path+"/purpose")
	}
	if resume.UploadedAt != nil && resume.UploadedAt.IsZero() {
		r.add("error", "INVALID_DATE", path+"/uploaded_at")
	}
}

// ValidateResult validates a proposal, not an authority assertion. Candidate
// verification/consent/roles are absent from ProfileData and cannot be parsed.
func (v *Validator) ValidateResult(p ParserResult, asOf time.Time) ValidationReport {
	r := v.ValidateData(p.Profile, asOf)
	for i, item := range p.Profile.Employment {
		if i >= 30 {
			break
		}
		if item.ExperienceID != nil {
			r.add("error", "PARSER_SYSTEM_FIELD_FORBIDDEN", indexPath("/employment", i)+"/experience_id")
		}
	}
	for i, item := range p.Profile.Education {
		if i >= 30 {
			break
		}
		if item.EducationID != nil {
			r.add("error", "PARSER_SYSTEM_FIELD_FORBIDDEN", indexPath("/education", i)+"/education_id")
		}
	}
	for i, item := range p.Profile.Projects {
		if i >= 30 {
			break
		}
		if item.ProjectID != nil {
			r.add("error", "PARSER_SYSTEM_FIELD_FORBIDDEN", indexPath("/projects", i)+"/project_id")
		}
	}
	if p.ContractVersion != Version || p.ProfileSchemaVersion != Version {
		r.add("error", "UNSUPPORTED_VERSION", "/contract_version")
	}
	for path, id := range map[string]string{"/result_id": p.ResultID, "/candidate_id": p.CandidateID} {
		if !uuidPattern.MatchString(id) {
			r.add("error", "INVALID_ID", path)
		}
	}
	if p.SourceType != "resume" || !providerPattern.MatchString(p.ParserProvider) || !providerPattern.MatchString(p.ParserVersion) || p.CreatedAt.IsZero() || !validParseStatus(p.Status) {
		r.add("error", "INVALID_ENVELOPE", "")
	}
	v.validateResume(p.Resume, "/resume", &r)
	values := FieldValues(p.Profile)
	if p.ParserGeneratedSummary != nil {
		values["/parser_generated_summary"] = json.RawMessage(strconv.Quote(*p.ParserGeneratedSummary))
		if !utf8.ValidString(*p.ParserGeneratedSummary) || utf8.RuneCountInString(*p.ParserGeneratedSummary) > 5000 {
			r.add("error", "TEXT_LIMIT", "/parser_generated_summary")
		}
	}
	if len(p.FieldMetadata) > 8192 {
		r.add("error", "METADATA_LIMIT", "/field_metadata")
		return r
	}
	for path := range values {
		if _, ok := p.FieldMetadata[path]; !ok {
			r.add("error", "PROVENANCE_REQUIRED", path)
		}
	}
	for path, m := range p.FieldMetadata {
		if _, exists := values[path]; !exists {
			r.add("error", "UNKNOWN_METADATA_PATH", "/field_metadata")
			continue
		}
		if m.Confidence != nil && (!(*m.Confidence >= 0 && *m.Confidence <= 1) || math.IsNaN(*m.Confidence) || math.IsInf(*m.Confidence, 0)) {
			r.add("error", "INVALID_CONFIDENCE", path)
		}
		if m.Review != Unreviewed {
			r.add("error", "PARSER_CANNOT_CONFIRM", path)
		}
		if !has([]string{"resume", "profile_import", "external_integration", "ai_derived", "system_derived"}, m.Provenance.Source) || !has([]string{"explicit", "normalized", "derived", "inferred"}, m.Provenance.Kind) {
			r.add("error", "INVALID_PROVENANCE", path)
		}
		if m.Provenance.Section == "" || len(m.Provenance.Section) > 80 || m.Provenance.Reference == "" || len(m.Provenance.Reference) > 240 {
			r.add("error", "PROVENANCE_REQUIRED", path)
		}
		if m.Provenance.Page != nil && (*m.Provenance.Page < 1 || p.Resume.PageCount != nil && *m.Provenance.Page > *p.Resume.PageCount) {
			r.add("error", "INVALID_PAGE_REFERENCE", path)
		}
		if len(m.RawValue) > 16384 || len(m.RawValue) > 0 && !json.Valid(m.RawValue) {
			r.add("error", "INVALID_RAW_VALUE", path)
		}
	}
	if len(p.Issues) > 1000 {
		r.add("error", "COLLECTION_LIMIT", "/issues")
	}
	for i, issue := range p.Issues {
		if i >= 1000 {
			break
		}
		if !has([]string{"error", "warning", "info"}, issue.Severity) || !codePattern.MatchString(issue.Code) || len(issue.Path) > 512 || strings.ContainsAny(issue.Path, "\r\n\x00") {
			r.add("error", "INVALID_ISSUE", "/issues")
		}
	}
	return r
}

func decodeStrict(data []byte, target any) error {
	if len(data) > MaxContractBytes || !utf8.Valid(data) {
		return ErrInvalidContract
	}
	d := json.NewDecoder(bytes.NewReader(data))
	d.UseNumber()
	if err := uniqueJSON(d, 0); err != nil {
		return ErrInvalidContract
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		return ErrInvalidContract
	}
	var shape any
	if json.Unmarshal(data, &shape) != nil || !exactJSONKeys(shape, reflect.TypeOf(target).Elem()) {
		return ErrInvalidContract
	}
	d = json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if d.Decode(target) != nil {
		return ErrInvalidContract
	}
	return nil
}

// encoding/json accepts case-insensitive aliases; contract field names do not.
// This prevents differently-cased duplicate fields from changing ownership or
// review data while passing the duplicate-key scanner and JSON Schema checks.
func exactJSONKeys(value any, t reflect.Type) bool {
	if t == reflect.TypeFor[json.RawMessage]() {
		return true
	}
	if value == nil {
		return t.Kind() == reflect.Pointer || t.Kind() == reflect.Slice || t.Kind() == reflect.Map
	}
	if t.Kind() == reflect.Pointer {
		return exactJSONKeys(value, t.Elem())
	}
	if t == reflect.TypeFor[time.Time]() {
		_, ok := value.(string)
		return ok
	}
	switch t.Kind() {
	case reflect.Struct:
		object, ok := value.(map[string]any)
		if !ok {
			return false
		}
		fields := map[string]reflect.Type{}
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			name := strings.Split(f.Tag.Get("json"), ",")[0]
			if name != "" && name != "-" {
				fields[name] = f.Type
			}
		}
		for name, nested := range object {
			field, ok := fields[name]
			if !ok || !exactJSONKeys(nested, field) {
				return false
			}
		}
	case reflect.Slice:
		items, ok := value.([]any)
		if !ok {
			return false
		}
		for _, item := range items {
			if !exactJSONKeys(item, t.Elem()) {
				return false
			}
		}
	case reflect.Map:
		object, ok := value.(map[string]any)
		if !ok {
			return false
		}
		for _, item := range object {
			if !exactJSONKeys(item, t.Elem()) {
				return false
			}
		}
	}
	return true
}
func uniqueJSON(d *json.Decoder, depth int) error {
	if depth > 32 {
		return ErrInvalidContract
	}
	t, e := d.Token()
	if e != nil {
		return e
	}
	delim, ok := t.(json.Delim)
	if !ok {
		return nil
	}
	if delim == '{' {
		seen := map[string]bool{}
		for d.More() {
			key, e := d.Token()
			if e != nil {
				return e
			}
			s, ok := key.(string)
			if !ok || seen[s] {
				return ErrInvalidContract
			}
			seen[s] = true
			if uniqueJSON(d, depth+1) != nil {
				return ErrInvalidContract
			}
		}
	} else if delim == '[' {
		for d.More() {
			if uniqueJSON(d, depth+1) != nil {
				return ErrInvalidContract
			}
		}
	} else {
		return ErrInvalidContract
	}
	_, e = d.Token()
	return e
}
func DecodeProfile(data []byte) (CandidateProfile, error) {
	var p CandidateProfile
	e := decodeStrict(data, &p)
	return p, e
}
func DecodeResult(data []byte) (ParserResult, error) {
	var p ParserResult
	e := decodeStrict(data, &p)
	return p, e
}

// FieldValues yields populated non-system leaf pointers. It is also the review
// path allow-list; callers cannot patch the owner, verification or consent.
func FieldValues(p ProfileData) map[string]json.RawMessage {
	result := map[string]json.RawMessage{}
	var visit func(reflect.Value, string)
	visit = func(value reflect.Value, path string) {
		if len(result) >= 8192 {
			return
		}
		if value.Kind() == reflect.Pointer {
			if value.IsNil() {
				return
			}
			value = value.Elem()
		}
		switch value.Kind() {
		case reflect.Struct:
			t := value.Type()
			for i := 0; i < value.NumField(); i++ {
				f := t.Field(i)
				if f.Tag.Get("system") == "true" {
					continue
				}
				visit(value.Field(i), path+"/"+strings.Split(f.Tag.Get("json"), ",")[0])
			}
		case reflect.Slice:
			for i := 0; i < value.Len() && i < collectionLimit(path); i++ {
				visit(value.Index(i), indexPath(path, i))
			}
		default:
			raw, e := json.Marshal(value.Interface())
			if e == nil {
				result[path] = raw
			}
		}
	}
	visit(reflect.ValueOf(p), "")
	return result
}

func (v *Validator) duplicates(value reflect.Value, path string, r *ValidationReport) {
	if value.Kind() == reflect.Pointer {
		if value.IsNil() {
			return
		}
		value = value.Elem()
	}
	if value.Kind() == reflect.Struct {
		t := value.Type()
		for i := 0; i < value.NumField(); i++ {
			v.duplicates(value.Field(i), path+"/"+strings.Split(t.Field(i).Tag.Get("json"), ",")[0], r)
		}
	}
	if value.Kind() == reflect.Slice {
		seen := map[string]bool{}
		for i := 0; i < value.Len() && i < 100; i++ {
			item := value.Index(i)
			key := ""
			switch t := item.Interface().(type) {
			case Skill:
				key = entityKey(t.Entity)
			case Employment:
				key = entityKey(t.Company) + "|" + entityKey(t.Designation) + "|" + dateKey(t.StartDate) + "|" + dateKey(t.EndDate)
			case Education:
				key = entityKey(t.Institution) + "|" + entityKey(t.Qualification) + "|" + dateKey(t.StartDate) + "|" + dateKey(t.EndDate)
			}
			if key != "" && strings.Trim(key, "|") != "" {
				if seen[key] {
					r.add("warning", "DUPLICATE_ENTRY", indexPath(path, i))
				}
				seen[key] = true
			}
			v.duplicates(item, indexPath(path, i), r)
		}
	}
}
func entityKey(e EntityRef) string {
	if e.ID != nil && e.Namespace != nil {
		return *e.Namespace + ":" + strings.ToLower(*e.ID)
	}
	if e.Name != nil {
		return ComparisonKey(*e.Name)
	}
	return ""
}
func dateKey(d *PartialDate) string {
	if d == nil {
		return ""
	}
	return fmt.Sprintf("%s:%v:%v:%v", d.Precision, intValue(d.Year), intValue(d.Month), intValue(d.Day))
}
func intValue(n *int) int {
	if n == nil {
		return 0
	}
	return *n
}
