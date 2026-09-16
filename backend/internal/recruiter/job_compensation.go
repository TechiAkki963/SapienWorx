package recruiter

import (
	"context"
)

type JobCompensationInput struct {
	MinSalaryAmount *float64 `json:"min_salary_amount"`
	MaxSalaryAmount *float64 `json:"max_salary_amount"`
	SalaryCurrency  string   `json:"salary_currency"`
}

func (s *Service) SetJobCompensation(ctx context.Context, userID, jobID string, in JobCompensationInput) error {
	if in.MinSalaryAmount != nil && *in.MinSalaryAmount < 0 {
		return ErrInvalid
	}
	if in.MaxSalaryAmount != nil && *in.MaxSalaryAmount < 0 {
		return ErrInvalid
	}
	if in.MinSalaryAmount != nil && in.MaxSalaryAmount != nil && *in.MaxSalaryAmount < *in.MinSalaryAmount {
		return ErrInvalid
	}
	if in.SalaryCurrency == "" {
		in.SalaryCurrency = "INR"
	}
	if len(in.SalaryCurrency) != 3 {
		return ErrInvalid
	}
	companyID, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	tag, err := s.db.Exec(ctx, `UPDATE jobs SET min_salary_amount=$3,max_salary_amount=$4,salary_currency=upper($5),updated_at=now() WHERE id=$1 AND company_id=$2`, jobID, companyID, in.MinSalaryAmount, in.MaxSalaryAmount, in.SalaryCurrency)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
