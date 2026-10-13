package recruiter

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math/big"
	"strings"
	"time"
)

var ErrOfferStale = errors.New("offer version changed; reload before continuing")
var ErrOfferForbidden = errors.New("offer permission denied")
var ErrOfferApproval = errors.New("offer approval requirements are not satisfied")
var OfferPermissions = []string{"offer.view", "offer.create", "offer.edit", "offer.send", "offer.withdraw", "offer.approve", "offer.view_compensation", "offer.manage_templates", "offer.manage_formulas", "offer.manage_approval_policy", "offer.download_documents", "offer.view_audit"}

type OfferClause struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Text     string `json:"text"`
	Locked   bool   `json:"locked"`
	Optional bool   `json:"optional,omitempty"`
}
type OfferTemplateDefinition struct {
	Currency   string                  `json:"currency"`
	Fields     []OfferCalculationField `json:"fields"`
	Clauses    []OfferClause           `json:"clauses"`
	LetterText string                  `json:"letter_text"`
}
type OfferApprovalStep struct {
	UserIDs    []string `json:"user_ids"`
	Role       string   `json:"role,omitempty"`
	Department string   `json:"department,omitempty"`
}
type OfferApprovalRule struct {
	Field    string              `json:"field"`
	Operator string              `json:"operator"`
	Value    string              `json:"value"`
	Steps    []OfferApprovalStep `json:"steps"`
}
type OfferApprovalPolicy struct {
	Mode  string              `json:"mode"`
	Steps []OfferApprovalStep `json:"steps"`
	Rules []OfferApprovalRule `json:"rules"`
}
type OfferSnapshot struct {
	Incomplete         bool                    `json:"incomplete,omitempty"`
	Branding           *OfferBranding          `json:"branding,omitempty"`
	TemplateVersionID  string                  `json:"template_version_id,omitempty"`
	Provenance         string                  `json:"provenance"`
	Title              string                  `json:"title"`
	Currency           string                  `json:"currency"`
	AnnualCompensation string                  `json:"annual_compensation"`
	JoiningDate        string                  `json:"joining_date"`
	ExpiresAt          string                  `json:"expires_at"`
	CandidateName      string                  `json:"candidate_name"`
	CompanyName        string                  `json:"company_name"`
	JobID              string                  `json:"job_id"`
	JobTitle           string                  `json:"job_title"`
	EmploymentType     string                  `json:"employment_type,omitempty"`
	WorkMode           string                  `json:"work_mode,omitempty"`
	WorkLocation       string                  `json:"work_location,omitempty"`
	Department         string                  `json:"department,omitempty"`
	Fields             []OfferCalculationField `json:"fields"`
	Values             map[string]string       `json:"values"`
	Clauses            []OfferClause           `json:"clauses"`
	LetterText         string                  `json:"letter_text"`
	LetterSource       string                  `json:"letter_source,omitempty"`
	ClauseSources      map[string]string       `json:"clause_sources,omitempty"`
	Annexures          []OfferAttachment       `json:"annexures"`
}
type OfferWriteInput struct {
	SaveIncomplete    bool              `json:"save_incomplete,omitempty"`
	ApplicationID     string            `json:"application_id"`
	TemplateVersionID string            `json:"template_version_id"`
	Title             string            `json:"title"`
	Currency          string            `json:"currency"`
	JoiningDate       string            `json:"joining_date"`
	ExpiresAt         string            `json:"expires_at"`
	Values            map[string]string `json:"values"`
	Clauses           map[string]string `json:"clauses"`
	OmittedClauses    []string          `json:"omitted_clauses,omitempty"`
	LetterText        string            `json:"letter_text"`
	ExpectedVersion   int               `json:"expected_version"`
	ExpectedRevision  int64             `json:"expected_revision"`
	CommandKey        string            `json:"command_key"`
	ChangeReason      string            `json:"change_reason"`
	AttachmentIDs     []string          `json:"attachment_ids"`
}
type OfferCommand struct {
	Action           string `json:"action"`
	ExpectedVersion  int    `json:"expected_version"`
	ExpectedRevision int64  `json:"expected_revision"`
	TermsHash        string `json:"terms_hash"`
	Reason           string `json:"reason"`
	CommandKey       string `json:"command_key"`
}
type OfferApproval struct {
	Step     int        `json:"step"`
	UserID   string     `json:"user_id"`
	Name     string     `json:"name"`
	Decision string     `json:"decision"`
	Reason   string     `json:"reason"`
	ActedAt  *time.Time `json:"acted_at,omitempty"`
}
type OfferVersion struct {
	Version     int             `json:"version"`
	Revision    int64           `json:"revision"`
	Status      string          `json:"status"`
	TermsHash   string          `json:"terms_hash"`
	Snapshot    *OfferSnapshot  `json:"snapshot,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	SentAt      *time.Time      `json:"sent_at,omitempty"`
	ViewedAt    *time.Time      `json:"viewed_at,omitempty"`
	RespondedAt *time.Time      `json:"responded_at,omitempty"`
	Approvals   []OfferApproval `json:"approvals"`
	Documents   []OfferDocument `json:"documents"`
}
type OfferListQuery struct {
	Page   int
	Limit  int
	Status string
	Query  string
}
type OfferList struct {
	Items    []GovernedOffer `json:"items"`
	Total    int             `json:"total"`
	Page     int             `json:"page"`
	Limit    int             `json:"limit"`
	Counts   map[string]int  `json:"counts"`
	Insights *OfferInsights  `json:"insights,omitempty"`
}
type OfferInsights struct {
	ReleasedVersions     int      `json:"released_versions"`
	ViewedVersions       int      `json:"viewed_versions"`
	AcceptedVersions     int      `json:"accepted_versions"`
	DeclinedVersions     int      `json:"declined_versions"`
	AverageResponseHours *float64 `json:"average_response_hours"`
}
type GovernedOffer struct {
	Candidate     *PipelineRow    `json:"candidate,omitempty"`
	Released      bool            `json:"-"`
	ID            string          `json:"id"`
	ApplicationID string          `json:"application_id"`
	CandidateID   string          `json:"candidate_id"`
	CandidateName string          `json:"candidate_name"`
	JobID         string          `json:"job_id"`
	JobTitle      string          `json:"job_title"`
	JobReference  string          `json:"job_reference"`
	Title         string          `json:"title"`
	Status        string          `json:"status"`
	ActiveVersion int             `json:"active_version"`
	Revision      int64           `json:"revision"`
	TermsHash     string          `json:"terms_hash"`
	UpdatedAt     time.Time       `json:"updated_at"`
	ExpiresAt     *time.Time      `json:"expires_at,omitempty"`
	Snapshot      *OfferSnapshot  `json:"snapshot,omitempty"`
	Permissions   map[string]bool `json:"permissions"`
	Versions      []OfferVersion  `json:"versions,omitempty"`
}
type OfferDocument struct {
	ID       string `json:"id"`
	Version  int    `json:"version"`
	Kind     string `json:"kind"`
	Filename string `json:"filename"`
	SHA256   string `json:"sha256"`
	Bytes    int64  `json:"bytes"`
	Key      string `json:"-"`
}
type OfferAttachment struct {
	ID       string `json:"id"`
	Filename string `json:"filename"`
	SHA256   string `json:"sha256"`
	Bytes    int64  `json:"bytes"`
	Key      string `json:"-"`
}
type OfferTemplate struct {
	OwnerName  string                  `json:"owner_name,omitempty"`
	UpdatedAt  time.Time               `json:"updated_at,omitempty"`
	ID         string                  `json:"id"`
	Name       string                  `json:"name"`
	VersionID  string                  `json:"version_id"`
	Version    int                     `json:"version"`
	Status     string                  `json:"status"`
	Definition OfferTemplateDefinition `json:"definition"`
	Hash       string                  `json:"hash"`
}

func offerHash(value any) (string, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(raw)
	return hex.EncodeToString(hash[:]), nil
}
func validOfferCommandKey(key string) bool {
	return len(key) >= 8 && len(key) <= 128 && !strings.ContainsAny(key, "\r\n\t ")
}
func validOfferStep(step OfferApprovalStep) bool {
	if len(step.UserIDs) > 20 || len(step.Department) > 160 {
		return false
	}
	if (len(step.UserIDs) == 0) == (step.Role == "") {
		return false
	}
	if step.Role != "" && !validEnum(step.Role, "primary_admin", "sub_admin", "recruiter") {
		return false
	}
	seen := map[string]bool{}
	for _, id := range step.UserIDs {
		if !validUUID(id) || seen[id] {
			return false
		}
		seen[id] = true
	}
	return true
}
func ValidateOfferPolicy(policy OfferApprovalPolicy) error {
	if !validEnum(policy.Mode, "none", "single", "sequential", "parallel", "conditional") || len(policy.Steps) > 20 || len(policy.Rules) > 20 {
		return ErrInvalid
	}
	if policy.Mode == "none" && (len(policy.Steps) > 0 || len(policy.Rules) > 0) {
		return ErrInvalid
	}
	if policy.Mode == "single" && len(policy.Steps) != 1 {
		return ErrInvalid
	}
	if validEnum(policy.Mode, "sequential", "parallel") && len(policy.Steps) == 0 {
		return ErrInvalid
	}
	if policy.Mode != "conditional" && len(policy.Rules) > 0 {
		return ErrInvalid
	}
	if policy.Mode == "conditional" && len(policy.Rules) == 0 {
		return ErrInvalid
	}
	for _, step := range policy.Steps {
		if !validOfferStep(step) {
			return ErrInvalid
		}
	}
	for _, rule := range policy.Rules {
		textFact := validEnum(rule.Field, "employment_type", "work_mode", "work_location", "department", "currency", "joining_date", "expires_at")
		if rule.Value != strings.TrimSpace(rule.Value) || strings.ContainsAny(rule.Value, "\r\n\t") || textFact && !validEnum(rule.Operator, "eq", "ne") || rule.Field == "annual_compensation" && !offerDecimal.MatchString(rule.Value) {
			return ErrInvalid
		}
		if !offerFieldKey.MatchString(rule.Field) || !validEnum(rule.Operator, "gt", "gte", "lt", "lte", "eq", "ne") || strings.TrimSpace(rule.Value) == "" || len(rule.Value) > 120 || (!validEnum(rule.Operator, "eq", "ne") && !offerDecimal.MatchString(rule.Value)) || len(rule.Steps) == 0 || len(rule.Steps) > 20 {
			return ErrInvalid
		}
		for _, step := range rule.Steps {
			if !validOfferStep(step) {
				return ErrInvalid
			}
		}
	}
	return nil
}
func offerPolicySteps(policy OfferApprovalPolicy, values map[string]string, fieldKinds ...map[string]string) ([]OfferApprovalStep, error) {
	if err := ValidateOfferPolicy(policy); err != nil {
		return nil, err
	}
	steps := append([]OfferApprovalStep{}, policy.Steps...)
	for _, rule := range policy.Rules {
		value, present := values[rule.Field]
		if !present || strings.TrimSpace(value) == "" {
			return nil, ErrOfferCalculation
		}
		kind := ""
		if len(fieldKinds) > 0 {
			kind = fieldKinds[0][rule.Field]
		}
		numeric := validEnum(kind, "money", "number", "percent") || kind == "" && offerDecimal.MatchString(value) && offerDecimal.MatchString(rule.Value)
		cmp := strings.Compare(value, rule.Value)
		if numeric {
			if !offerDecimal.MatchString(value) || !offerDecimal.MatchString(rule.Value) {
				return nil, ErrOfferCalculation
			}
			left, _ := new(big.Rat).SetString(value)
			right, _ := new(big.Rat).SetString(rule.Value)
			cmp = left.Cmp(right)
		} else if !validEnum(rule.Operator, "eq", "ne") {
			return nil, ErrOfferCalculation
		}
		applies := rule.Operator == "eq" && cmp == 0 || rule.Operator == "ne" && cmp != 0 || rule.Operator == "gt" && cmp > 0 || rule.Operator == "gte" && cmp >= 0 || rule.Operator == "lt" && cmp < 0 || rule.Operator == "lte" && cmp <= 0
		if applies {
			steps = append(steps, rule.Steps...)
		}
	}
	if len(steps) > 20 {
		return nil, ErrInvalid
	}
	return steps, nil
}

// Facts are frozen with the offer version. Company-defined editable fields may
// replace a job default only through the authorized template's typed schema.
func offerPolicyFacts(snapshot OfferSnapshot) (map[string]string, map[string]string) {
	values := map[string]string{"employment_type": snapshot.EmploymentType, "work_mode": snapshot.WorkMode, "work_location": snapshot.WorkLocation, "department": snapshot.Department, "currency": snapshot.Currency, "joining_date": snapshot.JoiningDate, "expires_at": snapshot.ExpiresAt}
	kinds := map[string]string{"employment_type": "select", "work_mode": "select", "work_location": "text", "department": "text", "currency": "text", "joining_date": "date", "expires_at": "date"}
	for _, field := range snapshot.Fields {
		kinds[field.Key] = field.Kind
	}
	for key, value := range snapshot.Values {
		values[key] = value
	}
	return values, kinds
}
func validateOfferDefinition(d OfferTemplateDefinition) error {
	if _, err := offerCurrencyScale(d.Currency); err != nil {
		return ErrInvalid
	}
	if len(d.LetterText) < 10 || len(d.LetterText) > 20000 || len(d.Clauses) > 40 || len(d.Fields) > 100 {
		return ErrInvalid
	}
	fields := map[string]bool{}
	hasAnnual := false
	for _, f := range d.Fields {
		if fields[f.Key] {
			return ErrInvalid
		}
		fields[f.Key] = true
		if f.Key == "annual_compensation" && f.Kind == "money" {
			hasAnnual = true
		}
	}
	if !hasAnnual {
		return ErrInvalid
	}
	seen := map[string]bool{}
	for _, c := range d.Clauses {
		if !offerFieldKey.MatchString(c.Key) || seen[c.Key] || len(c.Text) > 8000 || len(c.Label) == 0 || len(c.Label) > 120 {
			return ErrInvalid
		}
		seen[c.Key] = true
	}
	if err := validateOfferCalculationDefinitions(d.Currency, d.Fields); err != nil {
		return err
	}
	return validateOfferVariables(d)
}
func defaultOfferDefinition(currency string) OfferTemplateDefinition {
	return OfferTemplateDefinition{Currency: currency, Fields: []OfferCalculationField{{Key: "annual_compensation", Label: "Annual compensation", Kind: "money", Currency: currency, Required: true}}, Clauses: []OfferClause{}, LetterText: "We are pleased to offer you the position described below. Please review your compensation, joining date and the terms of this offer before responding."}
}
