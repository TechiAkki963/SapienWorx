package recruiter

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"
)

func decorateOfferCandidates(ctx context.Context, tx pgx.Tx, actor, companyID string, items []GovernedOffer) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ApplicationID)
	}
	candidates, err := pipelineSummariesForApplications(ctx, tx, actor, companyID, ids)
	if err != nil {
		return err
	}
	for i := range items {
		if candidate, ok := candidates[items[i].ApplicationID]; ok {
			items[i].Candidate = &candidate
		}
	}
	return nil
}

// Callers supply only application identities already authorized in their job
// scope. This is the same bounded card projection across workspace modules.
func pipelineSummariesForApplications(ctx context.Context, tx pgx.Tx, actor, companyID string, ids []string) (map[string]PipelineRow, error) {
	if len(ids) > 100 {
		return nil, ErrInvalid
	}
	candidates := map[string]PipelineRow{}
	if len(ids) == 0 {
		return candidates, nil
	}
	fields := strings.Replace(pipelineCandidateFields, "tpm.recruiter_id=$8", "tpm.recruiter_id=$3", 1)
	rows, err := tx.Query(ctx, `SELECT `+fields+` FROM applications a JOIN candidate_profiles cp ON cp.user_id=a.candidate_id JOIN users u ON u.id=cp.user_id JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND a.id=ANY($2::uuid[])`, companyID, ids, actor)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		x, err := scanPipelineRow(rows)
		if err != nil {
			return nil, err
		}
		candidates[x.ApplicationID] = x
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return candidates, nil
}
func (s *sqlOfferStore) EligibleApplications(ctx context.Context, actor, job, application, q string) ([]PipelineRow, error) {
	if job != "" && !validUUID(job) || application != "" && !validUUID(application) || len(q) > 160 {
		return nil, ErrInvalid
	}
	tx, m, err := s.recruiterTx(ctx, actor, false)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err = requireOfferPermission(ctx, tx, m, "offer.create"); err != nil {
		return nil, err
	}
	if err = requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
		return nil, err
	}
	fields := strings.Replace(pipelineCandidateFields, "tpm.recruiter_id=$8", "tpm.recruiter_id=$3", 1)
	rows, err := tx.Query(ctx, `SELECT `+fields+` FROM applications a JOIN candidate_profiles cp ON cp.user_id=a.candidate_id JOIN users u ON u.id=cp.user_id JOIN jobs j ON j.id=a.job_id WHERE j.company_id=$1 AND ($2::text='' OR j.id::text=$2) AND a.stage='offer' AND ($4::text='' OR a.id::text=$4) AND ($5::text='' OR cp.full_name ILIKE '%'||$5||'%' OR j.title ILIKE '%'||$5||'%') AND ($6::boolean OR j.department=ANY($7::text[]) OR j.city=ANY($8::text[]) OR j.id::text=ANY($9::text[])) AND ($4<>'' OR NOT EXISTS(SELECT 1 FROM recruiter_offers o WHERE o.application_id=a.id AND o.status IN ('draft','awaiting_approval','approved','sent','viewed','accepted'))) ORDER BY a.updated_at DESC,a.id LIMIT 50`, m.CompanyID, job, actor, application, q, m.Scope.All, m.Scope.Departments, m.Scope.Locations, m.Scope.JobIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []PipelineRow{}
	for rows.Next() {
		x, err := scanPipelineRow(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, x)
	}
	return items, rows.Err()
}
