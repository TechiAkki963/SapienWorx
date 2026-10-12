package recruiter

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"regexp"
	"strings"
)

// Branding is a company-controlled snapshot. Logo bytes are small local image
// data, so PDF generation never fetches a user-supplied network URL.
type OfferBranding struct {
	Accent      string `json:"accent,omitempty"`
	Address     string `json:"address,omitempty"`
	Signatory   string `json:"signatory,omitempty"`
	LogoDataURL string `json:"logo_data_url,omitempty"`
}

var offerColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
var offerVariable = regexp.MustCompile(`\{\{\s*([a-z][a-z0-9_]*)\s*\}\}`)

func validateOfferBranding(b OfferBranding) error {
	if b.Accent != "" && !offerColor.MatchString(b.Accent) || len(b.Address) > 1000 || len(b.Signatory) > 160 {
		return ErrInvalid
	}
	_, _, err := offerBrandLogo(b.LogoDataURL)
	return err
}
func offerBrandLogo(value string) ([]byte, image.Config, error) {
	if value == "" {
		return nil, image.Config{}, nil
	}
	if len(value) > 180000 {
		return nil, image.Config{}, ErrInvalid
	}
	prefix, data, ok := strings.Cut(value, ",")
	if !ok || !validEnum(prefix, "data:image/png;base64", "data:image/jpeg;base64") {
		return nil, image.Config{}, ErrInvalid
	}
	raw, err := base64.StdEncoding.DecodeString(data)
	if err != nil || len(raw) > 131072 {
		return nil, image.Config{}, ErrInvalid
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || !validEnum(format, "png", "jpeg") || cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 1024 || cfg.Height > 1024 {
		return nil, image.Config{}, ErrInvalid
	}
	if format == "png" && prefix != "data:image/png;base64" || format == "jpeg" && prefix != "data:image/jpeg;base64" {
		return nil, image.Config{}, ErrInvalid
	}
	return raw, cfg, nil
}
func offerLetterVariables(snapshot OfferSnapshot) map[string]string {
	values := map[string]string{"candidate_name": snapshot.CandidateName, "company_name": snapshot.CompanyName, "job_title": snapshot.JobTitle, "joining_date": snapshot.JoiningDate, "expires_at": snapshot.ExpiresAt, "currency": snapshot.Currency, "title": snapshot.Title}
	for key, value := range snapshot.Values {
		if _, reserved := values[key]; !reserved {
			values[key] = value
		}
	}
	for _, field := range snapshot.Fields {
		if _, present := values[field.Key]; !present {
			values[field.Key] = ""
		}
	}
	return values
}
func renderOfferLetter(text string, values map[string]string) (string, error) {
	return renderOfferLetterText(text, values, false)
}
func renderOfferDraftLetter(text string, values map[string]string) (string, error) {
	return renderOfferLetterText(text, values, true)
}
func renderOfferLetterText(text string, values map[string]string, allowEmpty bool) (string, error) {
	var failed error
	result := offerVariable.ReplaceAllStringFunc(text, func(token string) string {
		key := offerVariable.FindStringSubmatch(token)[1]
		value, ok := values[key]
		if !ok || !allowEmpty && strings.TrimSpace(value) == "" {
			failed = fmt.Errorf("%w: unavailable letter variable %s", ErrInvalid, key)
			return token
		}
		return value
	})
	if failed != nil {
		return "", failed
	}
	if strings.Contains(result, "{{") || strings.Contains(result, "}}") {
		return "", ErrInvalid
	}
	if len(result) > 30000 {
		return "", ErrInvalid
	}
	return result, nil
}
func validateOfferVariables(d OfferTemplateDefinition) error {
	values := map[string]string{"candidate_name": "Candidate", "company_name": "Company", "job_title": "Role", "joining_date": "Date", "expires_at": "Date", "currency": d.Currency, "title": "Title"}
	for _, field := range d.Fields {
		if field.Kind == "section" {
			continue
		}
		if _, reserved := values[field.Key]; reserved {
			return ErrInvalid
		}
		values[field.Key] = "Value"
	}
	if _, err := renderOfferLetter(d.LetterText, values); err != nil {
		return err
	}
	for _, clause := range d.Clauses {
		if _, err := renderOfferLetter(clause.Text, values); err != nil {
			return err
		}
	}
	return nil
}
