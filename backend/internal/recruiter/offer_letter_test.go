package recruiter

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestOfferLetterVariablesAreBoundedAndServerResolved(t *testing.T) {
	snapshot := OfferSnapshot{CandidateName: "A <Candidate>", CompanyName: "QA & Co", JobTitle: "Engineer", Currency: "INR", JoiningDate: "2027-01-15", ExpiresAt: "2026-12-31", Title: "Employment", Values: map[string]string{"annual_compensation": "1234567.89", "bonus": "100.00"}}
	text, err := renderOfferLetter("Dear {{ candidate_name }}, {{company_name}} offers {{job_title}} for {{annual_compensation}} {{currency}} plus {{bonus}}.", offerLetterVariables(snapshot))
	if err != nil || strings.Contains(text, "{{") || !strings.Contains(text, "1234567.89 INR") {
		t.Fatal(text, err)
	}
	for _, bad := range []string{"{{foreign_secret}}", "{{candidate_name", "{{}}", "missing }}"} {
		if _, err = renderOfferLetter(bad, offerLetterVariables(snapshot)); err == nil {
			t.Fatal("unresolved variable accepted", bad)
		}
	}
	d := defaultOfferDefinition("INR")
	d.LetterText = "Welcome {{candidate_name}}. Your salary is {{annual_compensation}}."
	if err = validateOfferDefinition(d); err != nil {
		t.Fatal(err)
	}
	d.LetterText = "Welcome {{unknown_variable}}."
	if err = validateOfferDefinition(d); err == nil {
		t.Fatal("unknown template variable")
	}
}
func TestOfferBrandingNeverFetchesRemoteLogo(t *testing.T) {
	for _, brand := range []OfferBranding{{Accent: "red"}, {LogoDataURL: "https://example.test/logo.png"}, {LogoDataURL: "data:image/svg+xml;base64,PHN2Zy8+"}, {LogoDataURL: "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("not a PNG"))}, {Address: strings.Repeat("x", 1001)}} {
		if err := validateOfferBranding(brand); err == nil {
			t.Fatal("unsafe logo/branding accepted")
		}
	}
	if err := validateOfferBranding(OfferBranding{Accent: "#5348a7", Signatory: "QA signatory", Address: "QA office"}); err != nil {
		t.Fatal(err)
	}
}
