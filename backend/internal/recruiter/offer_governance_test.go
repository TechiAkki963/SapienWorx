package recruiter

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestOfferApprovalPolicyExactConditions(t *testing.T) {
	first := "11111111-1111-4111-8111-111111111111"
	second := "22222222-2222-4222-8222-222222222222"
	policy := OfferApprovalPolicy{Mode: "conditional", Steps: []OfferApprovalStep{{UserIDs: []string{first}}}, Rules: []OfferApprovalRule{{Field: "annual_compensation", Operator: "gt", Value: "0.30", Steps: []OfferApprovalStep{{UserIDs: []string{second}}}}}}
	steps, err := offerPolicySteps(policy, map[string]string{"annual_compensation": "0.30"})
	if err != nil || len(steps) != 1 {
		t.Fatal("decimal equality incorrectly crossed configured threshold", err)
	}
	steps, err = offerPolicySteps(policy, map[string]string{"annual_compensation": "0.31"})
	if err != nil || len(steps) != 2 {
		t.Fatal("configured conditional approval was not selected", err)
	}
	if _, err = offerPolicySteps(policy, map[string]string{}); !errors.Is(err, ErrOfferCalculation) {
		t.Fatal("missing conditional field did not fail closed")
	}
	for _, invalid := range []OfferApprovalPolicy{{Mode: "none", Steps: policy.Steps}, {Mode: "single"}, {Mode: "conditional", Rules: []OfferApprovalRule{{Field: "salary", Operator: "exec", Value: "1", Steps: policy.Steps}}}, {Mode: "single", Steps: []OfferApprovalStep{{UserIDs: []string{first}, Role: "primary_admin"}}}} {
		if ValidateOfferPolicy(invalid) == nil {
			t.Fatal("invalid approval policy accepted")
		}
	}
}
func TestOfferPDFImmutableReadablePages(t *testing.T) {
	snapshot := OfferSnapshot{Branding: &OfferBranding{Accent: "#5348a7", Address: "QA office, Mumbai", Signatory: "Authorized QA reviewer"}, Provenance: "governed", EmploymentType: "full_time", WorkMode: "remote", WorkLocation: "Mumbai", Department: "Engineering", Title: "Employment offer", Currency: "EUR", AnnualCompensation: "84500.30", CandidateName: "Zoë Müller", CompanyName: "SapienWorx QA", JobTitle: "Senior Platform Engineer", JoiningDate: "2026-12-01", ExpiresAt: "2026-11-20", LetterText: "We are pleased to offer you this position. Please review the terms and respond through your secure candidate portal.", Fields: []OfferCalculationField{{Key: "annual_compensation", Label: "Annual compensation", Kind: "money"}}, Values: map[string]string{"annual_compensation": "84500.30"}, Clauses: []OfferClause{{Key: "privacy", Label: "Confidentiality", Text: "Your compensation and this offer are private to you and the authorized company team."}}}
	hash, err := offerHash(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	created := time.Date(2026, 10, 11, 8, 15, 0, 0, time.UTC)
	short, err := RenderOfferPDF(snapshot, 1, hash, created)
	if err != nil {
		t.Fatal(err)
	}
	again, err := RenderOfferPDF(snapshot, 1, hash, created)
	if err != nil || !bytes.Equal(short, again) {
		t.Fatal("same immutable version produced different PDF bytes", err)
	}
	if !bytes.HasPrefix(short, []byte("%PDF-")) || len(short) < 5000 {
		t.Fatal("invalid PDF document")
	}
	snapshot.Clauses = append(snapshot.Clauses, OfferClause{Key: "terms", Label: "Employment terms", Text: strings.Repeat("These are synthetic local quality-assurance terms. Text must wrap without clipping and continue on a new page when required. ", 120)})
	hash, err = offerHash(snapshot)
	if err != nil {
		t.Fatal(err)
	}
	long, err := RenderOfferPDF(snapshot, 2, hash, created)
	if err != nil {
		t.Fatal(err)
	}
	if output := os.Getenv("OFFER_PDF_TEST_OUTPUT"); output != "" {
		if err = os.MkdirAll(output, 0700); err != nil {
			t.Fatal(err)
		}
		for name, body := range map[string][]byte{"offer-letter-short.pdf": short, "offer-letter-long.pdf": long} {
			if err = os.WriteFile(filepath.Join(output, name), body, 0600); err != nil {
				t.Fatal(err)
			}
		}
	}
	snapshot.CandidateName = "Unsupported \U0001f980"
	if _, err = RenderOfferPDF(snapshot, 3, hash, created); err == nil {
		t.Fatal("unsupported font glyph was silently lost")
	}
}

func TestOfferConditionalApprovalsRespectTypedFrozenEmploymentTerms(t *testing.T) {
	reviewer := "11111111-1111-4111-8111-111111111111"
	policy := OfferApprovalPolicy{Mode: "conditional", Rules: []OfferApprovalRule{{Field: "employment_type", Operator: "eq", Value: "full_time", Steps: []OfferApprovalStep{{UserIDs: []string{reviewer}}}}}}
	snapshot := OfferSnapshot{EmploymentType: "full_time", WorkMode: "remote", Values: map[string]string{}}
	facts, kinds := offerPolicyFacts(snapshot)
	steps, err := offerPolicySteps(policy, facts, kinds)
	if err != nil || len(steps) != 1 {
		t.Fatal("employment condition did not select approval", steps, err)
	}
	snapshot.EmploymentType = "contract"
	facts, kinds = offerPolicyFacts(snapshot)
	steps, err = offerPolicySteps(policy, facts, kinds)
	if err != nil || len(steps) != 0 {
		t.Fatal("different employment terms selected approval", steps, err)
	}
	policy.Rules[0].Field = "contract_code"
	policy.Rules[0].Value = "1"
	if _, err = offerPolicySteps(policy, map[string]string{}, map[string]string{"contract_code": "text"}); !errors.Is(err, ErrOfferCalculation) {
		t.Fatal("missing typed fact did not fail closed", err)
	}
	steps, err = offerPolicySteps(policy, map[string]string{"contract_code": "01"}, map[string]string{"contract_code": "text"})
	if err != nil || len(steps) != 0 {
		t.Fatal("text codes were coerced to money", steps, err)
	}
	policy.Rules[0].Field = "annual_compensation"
	policy.Rules[0].Value = "not a number"
	if ValidateOfferPolicy(policy) == nil {
		t.Fatal("invalid salary threshold accepted")
	}
	policy.Rules[0].Field = "employment_type"
	policy.Rules[0].Operator = "gt"
	policy.Rules[0].Value = "full_time"
	if ValidateOfferPolicy(policy) == nil {
		t.Fatal("ordered comparison accepted for employment text")
	}
}
