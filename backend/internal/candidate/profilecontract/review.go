package profilecontract

import (
	"encoding/json"
	"log/slog"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Actor struct{ UserID, Role string }
type Decision struct {
	Path   string          `json:"path"`
	Status ReviewStatus    `json:"status"`
	Value  json.RawMessage `json:"value"`
}
type ReviewPatch struct {
	ExpectedRevision uint64     `json:"expected_revision"`
	Decisions        []Decision `json:"decisions"`
}
type FieldReview struct {
	Status         ReviewStatus    `json:"status"`
	OriginalValue  json.RawMessage `json:"original_value"`
	CorrectedValue json.RawMessage `json:"corrected_value"`
	ReviewedBy     string          `json:"reviewed_by"`
	ReviewedAt     time.Time       `json:"reviewed_at"`
}

// ReviewDraft is server-owned; JSON from a browser cannot construct one.
// The immutable parser result remains separate from candidate corrections.
type ReviewDraft struct {
	result   ParserResult
	revision uint64
	reviews  map[string]FieldReview
}

type ReviewedChange struct {
	HumanProvenance *Provenance     `json:"human_provenance,omitempty"`
	HumanConfidence *float64        `json:"human_confidence"`
	Path            string          `json:"path"`
	OriginalValue   json.RawMessage `json:"original_value"`
	Value           json.RawMessage `json:"value"`
	Status          ReviewStatus    `json:"review_status"`
	Provenance      Provenance      `json:"provenance"`
	Confidence      *float64        `json:"confidence"`
	ReviewedBy      string          `json:"reviewed_by"`
	ReviewedAt      time.Time       `json:"reviewed_at"`
}

// ReviewView is the private candidate-facing API shape. Provider operational
// identifiers, debug data and storage keys are deliberately absent.
type ReviewView struct {
	ContractVersion        string                 `json:"contract_version"`
	ResultID               string                 `json:"result_id"`
	ResumeID               string                 `json:"resume_id"`
	Revision               uint64                 `json:"revision"`
	ProposedProfile        ProfileData            `json:"proposed_profile"`
	ParserGeneratedSummary *string                `json:"parser_generated_summary"`
	Fields                 map[string]ReviewField `json:"fields"`
	Issues                 []Issue                `json:"issues"`
}
type ReviewField struct {
	Metadata FieldMetadata `json:"metadata"`
	Review   *FieldReview  `json:"review"`
}

func DecodeReviewPatch(raw []byte) (ReviewPatch, error) {
	var p ReviewPatch
	err := decodeStrict(raw, &p)
	return p, err
}

func (v *Validator) ReadReview(d *ReviewDraft, a Actor, asOf time.Time) (ReviewView, error) {
	if d == nil || !d.authorized(a) {
		return ReviewView{}, ErrForbidden
	}
	view := ReviewView{ContractVersion: Version, ResultID: d.result.ResultID, ResumeID: d.result.Resume.ResumeID, Revision: d.revision, ProposedProfile: d.result.Profile, ParserGeneratedSummary: d.result.ParserGeneratedSummary, Fields: map[string]ReviewField{}, Issues: v.ValidateResult(d.result, asOf).Issues}
	view.Issues = append(view.Issues, d.result.Issues...)
	for path, metadata := range d.result.FieldMetadata {
		field := ReviewField{Metadata: metadata}
		if review, ok := d.reviews[path]; ok {
			field.Review = &review
		}
		view.Fields[path] = field
	}
	// A caller editing a response must not mutate the server-owned draft.
	raw, err := json.Marshal(view)
	if err != nil {
		return ReviewView{}, ErrInvalidContract
	}
	var copy ReviewView
	if json.Unmarshal(raw, &copy) != nil {
		return ReviewView{}, ErrInvalidContract
	}
	return copy, nil
}

type ConfirmationPlan struct {
	CandidateID              string           `json:"candidate_id"`
	ResumeID                 string           `json:"resume_id"`
	ResultID                 string           `json:"result_id"`
	ExpectedProfileUpdatedAt *time.Time       `json:"expected_profile_updated_at"`
	Changes                  []ReviewedChange `json:"changes"`
	ContactSuggestions       []ReviewedChange `json:"contact_suggestions"`
	RejectedCount            int              `json:"rejected_count"`
}

func (d *ReviewDraft) authorized(a Actor) bool {
	return a.Role == "candidate" && a.UserID == d.result.CandidateID
}
func (d *ReviewDraft) Revision() uint64 { return d.revision }

// NewReviewDraft permits optional value errors to be corrected/rejected, while
// malformed ownership/version/provenance metadata fails closed.
func (v *Validator) NewReviewDraft(a Actor, p ParserResult, asOf time.Time) (*ReviewDraft, error) {
	if a.Role != "candidate" || a.UserID != p.CandidateID {
		return nil, ErrForbidden
	}
	if p.Status != ReadyForReview {
		return nil, ErrInvalidContract
	}
	valueErrors := map[string]bool{"INVALID_EMAIL": true, "INVALID_PHONE": true, "INVALID_DATE": true, "INVALID_ENUM": true, "INVALID_URL": true, "TEXT_LIMIT": true, "EMPTY_VALUE_USE_NULL": true, "INVALID_COUNTRY": true, "INVALID_CURRENCY": true, "INVALID_EXPERIENCE": true, "INVALID_NOTICE_PERIOD": true, "INVALID_YEAR": true, "INVALID_GRADE": true, "INVALID_AMOUNT": true, "CURRENCY_REQUIRED": true, "CURRENT_ROLE_HAS_END": true, "END_BEFORE_START": true, "NONEXPIRING_HAS_EXPIRY": true, "INVALID_ID": true, "INVALID_TAXONOMY_REFERENCE": true, "TAXONOMY_ID_MISSING": true}
	for _, issue := range v.ValidateResult(p, asOf).Issues {
		if issue.Severity == "error" && !(valueErrors[issue.Code] && profileValuePath(issue.Path)) {
			return nil, ErrInvalidContract
		}
	}
	raw, e := json.Marshal(p)
	if e != nil {
		return nil, ErrInvalidContract
	}
	copy, e := DecodeResult(raw)
	if e != nil {
		return nil, e
	}
	return &ReviewDraft{result: copy, reviews: map[string]FieldReview{}}, nil
}

func profileValuePath(path string) bool {
	if path == "/parser_generated_summary" {
		return true
	}
	t := reflect.TypeFor[ProfileData]()
	for i := 0; i < t.NumField(); i++ {
		prefix := "/" + strings.Split(t.Field(i).Tag.Get("json"), ",")[0]
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return true
		}
	}
	return false
}

// Apply is atomic and revision-checked. Rejected fields generate no profile write.
func (d *ReviewDraft) Apply(a Actor, patch ReviewPatch, at time.Time) error {
	if !d.authorized(a) {
		return ErrForbidden
	}
	if patch.ExpectedRevision != d.revision {
		return ErrConflict
	}
	if len(patch.Decisions) == 0 || len(patch.Decisions) > 8192 || at.IsZero() {
		return ErrInvalidContract
	}
	values := FieldValues(d.result.Profile)
	if d.result.ParserGeneratedSummary != nil {
		raw, _ := json.Marshal(*d.result.ParserGeneratedSummary)
		values["/parser_generated_summary"] = raw
	}
	next := map[string]FieldReview{}
	for k, v := range d.reviews {
		next[k] = v
	}
	seen := map[string]bool{}
	for _, decision := range patch.Decisions {
		original, exists := values[decision.Path]
		if !exists || seen[decision.Path] || !has([]string{string(ReviewConfirmed), string(Edited), string(Rejected)}, string(decision.Status)) {
			return ErrInvalidContract
		}
		seen[decision.Path] = true
		value := original
		if decision.Status == Edited {
			if len(decision.Value) == 0 || len(decision.Value) > 16384 || !json.Valid(decision.Value) {
				return ErrInvalidContract
			}
			if decision.Path == "/parser_generated_summary" {
				var s string
				if json.Unmarshal(decision.Value, &s) != nil {
					return ErrInvalidContract
				}
			} else {
				copy := cloneData(d.result.Profile)
				if setTypedField(&copy, decision.Path, decision.Value) != nil {
					return ErrInvalidContract
				}
			}
			value = decision.Value
		} else if len(decision.Value) > 0 {
			return ErrInvalidContract
		}
		next[decision.Path] = FieldReview{Status: decision.Status, OriginalValue: append(json.RawMessage(nil), original...), CorrectedValue: append(json.RawMessage(nil), value...), ReviewedBy: a.UserID, ReviewedAt: at.UTC()}
	}
	d.reviews = next
	d.revision++
	return nil
}

// Confirmation returns a proposal for a future transaction adapter. It performs
// no persistence, verification, discovery/consent toggle or automatic merge.
// The adapter must recheck owner/session and updated_at, apply existing section
// validation, and commit profile/audit/outbox together through current stores.
func (v *Validator) PrepareConfirmation(d *ReviewDraft, a Actor, revision uint64, updatedAt *time.Time, asOf time.Time) (ConfirmationPlan, error) {
	if d == nil || !d.authorized(a) {
		return ConfirmationPlan{}, ErrForbidden
	}
	if d.revision != revision {
		return ConfirmationPlan{}, ErrConflict
	}
	if updatedAt == nil || updatedAt.IsZero() {
		return ConfirmationPlan{}, ErrInvalidContract
	}
	values := FieldValues(d.result.Profile)
	if d.result.ParserGeneratedSummary != nil {
		values["/parser_generated_summary"] = json.RawMessage(strconv.Quote(*d.result.ParserGeneratedSummary))
	}
	stamp := *updatedAt
	plan := ConfirmationPlan{CandidateID: d.result.CandidateID, ResumeID: d.result.Resume.ResumeID, ResultID: d.result.ResultID, ExpectedProfileUpdatedAt: &stamp, Changes: []ReviewedChange{}, ContactSuggestions: []ReviewedChange{}}
	copyRaw, _ := json.Marshal(d.result.Profile)
	var effective ProfileData
	_ = json.Unmarshal(copyRaw, &effective)
	for path := range values {
		review, ok := d.reviews[path]
		if !ok {
			return ConfirmationPlan{}, ErrInvalidContract
		}
		if review.Status == Rejected {
			plan.RejectedCount++
			if path != "/parser_generated_summary" {
				_ = setTypedField(&effective, path, json.RawMessage("null"))
			}
			continue
		}
		// A generated summary is never silently promoted into candidate summary.
		if path == "/parser_generated_summary" {
			continue
		}
		if setTypedField(&effective, path, review.CorrectedValue) != nil {
			return ConfirmationPlan{}, ErrInvalidContract
		}
		if path == "/identity/display_name" && (effective.Identity.DisplayName == nil || strings.TrimSpace(*effective.Identity.DisplayName) == "") {
			return ConfirmationPlan{}, ErrInvalidContract
		}
		metadata := d.result.FieldMetadata[path]
		change := ReviewedChange{Path: path, OriginalValue: append(json.RawMessage(nil), review.OriginalValue...), Value: append(json.RawMessage(nil), review.CorrectedValue...), Status: review.Status, Provenance: metadata.Provenance, Confidence: metadata.Confidence, ReviewedBy: review.ReviewedBy, ReviewedAt: review.ReviewedAt}
		if review.Status == Edited {
			// Preserve the existing extraction lineage fields. Human replacement
			// provenance is additive; original model confidence is not a score
			// for the human correction (HumanConfidence remains unknown).
			change.HumanProvenance = &Provenance{Source: "candidate_input", Kind: "manual", Section: metadata.Provenance.Section, Reference: "review:" + d.result.ResultID}
			change.HumanConfidence = nil
		}
		if strings.HasPrefix(path, "/contact/") {
			plan.ContactSuggestions = append(plan.ContactSuggestions, change)
		} else {
			plan.Changes = append(plan.Changes, change)
		}
	}
	for _, issue := range v.ValidateData(effective, asOf).Issues {
		if issue.Severity != "error" {
			continue
		}
		for _, change := range append(append([]ReviewedChange{}, plan.Changes...), plan.ContactSuggestions...) {
			if issue.Path == change.Path || strings.HasPrefix(change.Path, issue.Path+"/") {
				return ConfirmationPlan{}, ErrInvalidContract
			}
		}
	}
	sort.Slice(plan.Changes, func(i, j int) bool { return plan.Changes[i].Path < plan.Changes[j].Path })
	sort.Slice(plan.ContactSuggestions, func(i, j int) bool { return plan.ContactSuggestions[i].Path < plan.ContactSuggestions[j].Path })
	raw, _ := json.Marshal(plan)
	var copy ConfirmationPlan
	if json.Unmarshal(raw, &copy) != nil {
		return ConfirmationPlan{}, ErrInvalidContract
	}
	return copy, nil
}

func setTypedField(profile *ProfileData, path string, raw json.RawMessage) error {
	if !strings.HasPrefix(path, "/") {
		return ErrInvalidContract
	}
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	value := reflect.ValueOf(profile).Elem()
	for i, part := range parts {
		for value.Kind() == reflect.Pointer {
			if value.IsNil() {
				return ErrInvalidContract
			}
			value = value.Elem()
		}
		if value.Kind() == reflect.Struct {
			found := false
			t := value.Type()
			for n := 0; n < value.NumField(); n++ {
				f := t.Field(n)
				if strings.Split(f.Tag.Get("json"), ",")[0] == part && f.Tag.Get("system") != "true" {
					value = value.Field(n)
					found = true
					break
				}
			}
			if !found {
				return ErrInvalidContract
			}
		} else if value.Kind() == reflect.Slice {
			n, e := strconv.Atoi(part)
			if e != nil || n < 0 || n >= value.Len() {
				return ErrInvalidContract
			}
			value = value.Index(n)
		} else {
			return ErrInvalidContract
		}
		if i == len(parts)-1 {
			if !value.CanAddr() {
				return ErrInvalidContract
			}
			if decodeStrict(raw, value.Addr().Interface()) != nil {
				return ErrInvalidContract
			}
			return nil
		}
	}
	return ErrInvalidContract
}

func (*ReviewDraft) String() string             { return "ReviewDraft [private values withheld]" }
func (d *ReviewDraft) GoString() string         { return d.String() }
func (d *ReviewDraft) LogValue() slog.Value     { return slog.StringValue(d.String()) }
func (ConfirmationPlan) String() string         { return "ConfirmationPlan [private values withheld]" }
func (p ConfirmationPlan) GoString() string     { return p.String() }
func (p ConfirmationPlan) LogValue() slog.Value { return slog.StringValue(p.String()) }
func (ReviewView) String() string               { return "ReviewView [private values withheld]" }
func (p ReviewView) GoString() string           { return p.String() }
func (p ReviewView) LogValue() slog.Value       { return slog.StringValue(p.String()) }
