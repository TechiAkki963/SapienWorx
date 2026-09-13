package recruiter

import (
	"context"
	"strings"
)

func normalizeEducationRequirements(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func (s *Service) SetJobEducation(ctx context.Context, userID, jobID string, values []string) error {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	clean := normalizeEducationRequirements(values)
	if len(clean) == 0 {
		return ErrInvalid
	}
	tag, err := s.db.Exec(ctx, `UPDATE jobs SET education_requirements=$3 WHERE id=$1 AND company_id=$2`, jobID, companyID, clean)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
