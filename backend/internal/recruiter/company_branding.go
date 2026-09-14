package recruiter

import (
	"context"
	"net/url"
	"strings"
)

type CompanyBranding struct {
	CompanyName string  `json:"company_name"`
	LogoURL     *string `json:"logo_url,omitempty"`
}

func (s *Service) CompanyBranding(ctx context.Context, userID string) (CompanyBranding, error) {
	companyID, _, companyName, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return CompanyBranding{}, err
	}
	var logoURL *string
	if err := s.db.QueryRow(ctx, `SELECT logo_url FROM companies WHERE id=$1`, companyID).Scan(&logoURL); err != nil {
		return CompanyBranding{}, err
	}
	return CompanyBranding{CompanyName: companyName, LogoURL: logoURL}, nil
}

func (s *Service) UpdateCompanyLogo(ctx context.Context, userID, rawURL string) error {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	rawURL = strings.TrimSpace(rawURL)
	if rawURL != "" {
		parsed, parseErr := url.ParseRequestURI(rawURL)
		if parseErr != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") {
			return ErrInvalid
		}
	}
	_, err = s.db.Exec(ctx, `UPDATE companies SET logo_url=NULLIF($2,'') WHERE id=$1`, companyID, rawURL)
	return err
}
