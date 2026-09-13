package recruiter

import (
	"context"
	"strings"
)

func normalizeSkills(skills []string) []string {
	seen := make(map[string]struct{}, len(skills))
	out := make([]string, 0, len(skills))
	for _, skill := range skills {
		skill = strings.ToLower(strings.TrimSpace(skill))
		if skill == "" {
			continue
		}
		if _, ok := seen[skill]; ok {
			continue
		}
		seen[skill] = struct{}{}
		out = append(out, skill)
	}
	return out
}

func (s *Service) SetJobSkills(ctx context.Context, userID, jobID string, skills []string) error {
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	clean := normalizeSkills(skills)
	if len(clean) == 0 {
		return ErrInvalid
	}
	tag, err := s.db.Exec(ctx, `UPDATE jobs SET required_skills=$3 WHERE id=$1 AND company_id=$2`, jobID, companyID, clean)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
