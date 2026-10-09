package recruiter

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	companyaccess "github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/jackc/pgx/v5"
	"strings"
	"time"
)

type NamedPool struct {
	Paused     bool              `json:"paused"`
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Kind       string            `json:"kind"`
	Visibility string            `json:"visibility"`
	OwnerID    string            `json:"owner_id"`
	OwnerName  string            `json:"owner_name"`
	Criteria   map[string]string `json:"criteria"`
	TeamIDs    []string          `json:"team_ids"`
	Count      int               `json:"count"`
	CanEdit    bool              `json:"can_edit"`
	UpdatedAt  time.Time         `json:"updated_at"`
}
type NamedPoolInput struct {
	Name       string            `json:"name"`
	Kind       string            `json:"kind"`
	Visibility string            `json:"visibility"`
	Criteria   map[string]string `json:"criteria"`
	TeamIDs    []string          `json:"team_ids"`
}

const poolACL = `p.company_id=$1 AND (p.owner_id=$2 OR p.visibility='company' OR (p.visibility='team' AND EXISTS(SELECT 1 FROM recruiter_talent_pool_shares share WHERE share.pool_id=p.id AND share.recruiter_id=$2)))`

func (s *Service) namedPool(ctx context.Context, userID, poolID string) (NamedPool, error) {
	if !validUUID(poolID) {
		return NamedPool{}, ErrInvalid
	}
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return NamedPool{}, err
	}
	var p NamedPool
	var raw []byte
	err = s.db.QueryRow(ctx, `SELECT p.id,p.name,p.kind,p.visibility,p.owner_id,rp.full_name,p.criteria,ARRAY(SELECT recruiter_id::text FROM recruiter_talent_pool_shares WHERE pool_id=p.id),p.updated_at FROM recruiter_talent_pools p JOIN recruiter_profiles rp ON rp.user_id=p.owner_id WHERE p.id=$3 AND `+poolACL, company, userID, poolID).Scan(&p.ID, &p.Name, &p.Kind, &p.Visibility, &p.OwnerID, &p.OwnerName, &raw, &p.TeamIDs, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, ErrNotFound
	}
	if err != nil {
		return p, err
	}
	if err = json.Unmarshal(raw, &p.Criteria); err != nil {
		return p, err
	}
	p.CanEdit = p.OwnerID == userID
	return p, nil
}
func (s *Service) NamedPools(ctx context.Context, userID string) ([]NamedPool, error) {
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `SELECT p.id FROM recruiter_talent_pools p WHERE `+poolACL+` ORDER BY p.updated_at DESC,p.id LIMIT 100`, company, userID)
	if err != nil {
		return nil, err
	}
	ids := []string{}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		ids = append(ids, id)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	out := []NamedPool{}
	for _, id := range ids {
		p, err := s.namedPool(ctx, userID, id)
		if err != nil {
			return nil, err
		}
		list, err := s.NamedPoolCandidates(ctx, userID, id, "", "", 1, 1)
		if errors.Is(err, companyaccess.ErrInactive) {
			p.Paused = true
			out = append(out, p)
			continue
		}
		if err != nil {
			return nil, err
		}
		p.Count = list.Total
		out = append(out, p)
	}
	return out, nil
}
func (s *Service) CreateNamedPool(ctx context.Context, userID string, in NamedPoolInput) (NamedPool, error) {
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return NamedPool{}, err
	}
	in.Name = strings.TrimSpace(in.Name)
	if len(in.Name) < 1 || len(in.Name) > 120 || !validEnum(in.Kind, "manual", "smart") || !validEnum(in.Visibility, "private", "team", "company") || len(in.TeamIDs) > 50 {
		return NamedPool{}, ErrInvalid
	}
	if in.Criteria == nil {
		in.Criteria = map[string]string{}
	}
	if in.Kind == "manual" && len(in.Criteria) > 0 {
		return NamedPool{}, ErrInvalid
	}
	if in.Kind == "smart" {
		f, e := ParseDiscoveryFilters(in.Criteria)
		if e != nil {
			return NamedPool{}, e
		}
		if f.Criteria["client_company_id"] != "" && f.Criteria["client_company_id"] != company {
			return NamedPool{}, ErrNotFound
		}
		if len(in.Criteria) == 0 {
			return NamedPool{}, ErrInvalid
		}
	}
	if in.Visibility != "team" && len(in.TeamIDs) > 0 {
		return NamedPool{}, ErrInvalid
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return NamedPool{}, err
	}
	defer tx.Rollback(ctx)
	if in.Kind == "smart" {
		if err = companyaccess.RequireFeatureTx(ctx, tx, userID, "talent.smart_pools"); err != nil {
			return NamedPool{}, err
		}
		if err = companyaccess.CheckCapacityTx(ctx, tx, company, "smart_pools", 1); err != nil {
			return NamedPool{}, err
		}
	}
	raw, err := json.Marshal(in.Criteria)
	if err != nil {
		return NamedPool{}, err
	}
	var id string
	if err = tx.QueryRow(ctx, `INSERT INTO recruiter_talent_pools(company_id,owner_id,name,kind,visibility,criteria) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, company, userID, in.Name, in.Kind, in.Visibility, raw).Scan(&id); err != nil {
		return NamedPool{}, err
	}
	for _, member := range in.TeamIDs {
		if !validUUID(member) {
			return NamedPool{}, ErrInvalid
		}
		var valid bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id WHERE rp.user_id=$1 AND rp.company_id=$2 AND rp.verification_status='verified' AND u.is_active AND u.status='active')`, member, company).Scan(&valid); err != nil {
			return NamedPool{}, err
		}
		if !valid {
			return NamedPool{}, ErrNotFound
		}
		if _, err = tx.Exec(ctx, `INSERT INTO recruiter_talent_pool_shares VALUES($1,$2) ON CONFLICT DO NOTHING`, id, member); err != nil {
			return NamedPool{}, err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO recruiter_talent_pool_events(pool_id,actor_id,action) VALUES($1,$2,'created')`, id, userID); err != nil {
		return NamedPool{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return NamedPool{}, err
	}
	return s.namedPool(ctx, userID, id)
}
func (s *Service) NamedPoolCandidates(ctx context.Context, userID, poolID, q, tag string, page, limit int, filters ...TalentPoolFilters) (TalentPoolList, error) {
	p, err := s.namedPool(ctx, userID, poolID)
	if err != nil {
		return TalentPoolList{}, err
	}
	if page < 1 || page > 10000 || limit < 1 || limit > 100 || len(q) > 300 || len(tag) > 80 {
		return TalentPoolList{}, ErrInvalid
	}
	if p.Kind == "smart" {
		access, err := companyaccess.NewService(companyaccess.NewSQLStore(s.db)).RecruiterAccess(ctx, userID)
		if err != nil {
			return TalentPoolList{}, err
		}
		if !access.Allows("talent.smart_pools") {
			return TalentPoolList{}, companyaccess.ErrInactive
		}
		criteria := map[string]string{}
		for k, v := range p.Criteria {
			criteria[k] = v
		}
		criteria["page"] = "1"
		criteria["page_size"] = "50"
		f, err := ParseDiscoveryFilters(criteria)
		if err != nil {
			return TalentPoolList{}, err
		}
		f.Page = page
		f.PageSize = limit
		if q != "" || tag != "" || poolFilterSQL(&[]any{}, filters) != "" {
			return TalentPoolList{}, ErrInvalid
		}
		matches, err := s.discover(ctx, userID, f, false)
		if err != nil {
			return TalentPoolList{}, err
		}
		out := TalentPoolList{Items: []TalentPoolCandidate{}, Page: page, Limit: limit, Total: matches.Total}
		for _, c := range matches.Items {
			out.Items = append(out.Items, TalentPoolCandidate{CandidateID: c.ID, FullName: c.FullName, Headline: c.Headline, CurrentCity: c.CurrentCity, ExperienceMonths: c.ExperienceMonths, NoticePeriodDays: c.NoticePeriodDays, Tags: []string{}, CurrentCompany: c.CurrentCompany, LastActiveAt: c.LastActiveAt, Skills: c.Skills})
		}
		return out, nil
	}
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return TalentPoolList{}, err
	}
	args := []any{poolID, company, discoveryPattern(strings.TrimSpace(q)), strings.TrimSpace(tag)}
	from := ` FROM recruiter_talent_pool_entries e JOIN candidate_profiles cp ON cp.user_id=e.candidate_id JOIN users u ON u.id=cp.user_id JOIN recruiter_profiles saver ON saver.user_id=e.added_by WHERE e.pool_id=$1 AND u.is_active AND u.status='active' AND (` + candidateDiscoverablePredicate + ` OR EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=cp.user_id AND j.company_id=$2)) AND concat_ws(' ',cp.full_name,cp.headline,cp.current_city,array_to_string(candidate_discovery_skill_names(cp.profile_details),' ')) ILIKE $3 ESCAPE '\' AND ($4='' OR EXISTS(SELECT 1 FROM unnest(e.tags) tag WHERE lower(tag)=lower($4)))`
	from += poolFilterSQL(&args, filters)
	out := TalentPoolList{Items: []TalentPoolCandidate{}, Page: page, Limit: limit}
	if err = s.db.QueryRow(ctx, `SELECT count(*)`+from, args...).Scan(&out.Total); err != nil {
		return out, err
	}
	args = append(args, limit, (page-1)*limit)
	rows, err := s.db.Query(ctx, `SELECT cp.user_id,cp.full_name,cp.headline,cp.current_city,cp.total_experience_months,cp.notice_period_days,e.tags,e.created_at,saver.full_name,u.last_active_at,(candidate_discovery_skill_names(cp.profile_details))[1:6],coalesce((SELECT item->>'company' FROM `+discoveryEmployment+` item WHERE lower(item->>'current_company')='yes' LIMIT 1),'')`+from+fmt.Sprintf(` ORDER BY e.created_at DESC,e.candidate_id LIMIT $%d OFFSET $%d`, len(args)-1, len(args)), args...)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		var c TalentPoolCandidate
		if err = rows.Scan(&c.CandidateID, &c.FullName, &c.Headline, &c.CurrentCity, &c.ExperienceMonths, &c.NoticePeriodDays, &c.Tags, &c.SavedAt, &c.SavedBy, &c.LastActiveAt, &c.Skills, &c.CurrentCompany); err != nil {
			return out, err
		}
		out.Items = append(out.Items, c)
	}
	return out, rows.Err()
}
func (s *Service) SetNamedPoolCandidate(ctx context.Context, userID, poolID, candidateID string, tags []string, remove bool) error {
	if !validUUID(candidateID) {
		return ErrInvalid
	}
	p, err := s.namedPool(ctx, userID, poolID)
	if err != nil {
		return err
	}
	if !p.CanEdit || p.Kind != "manual" {
		return ErrNotFound
	}
	company, _, _, err := s.recruiterCompany(ctx, userID)
	if err != nil {
		return err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	// Serialize membership changes with the parent ACL, so future visibility edits cannot race writes.
	var owner string
	if err = tx.QueryRow(ctx, `SELECT owner_id FROM recruiter_talent_pools WHERE id=$1 AND company_id=$2 FOR UPDATE`, poolID, company).Scan(&owner); err != nil {
		return err
	}
	if owner != userID {
		return ErrNotFound
	}
	action := "removed"
	if remove {
		if _, err = tx.Exec(ctx, `DELETE FROM recruiter_talent_pool_entries WHERE pool_id=$1 AND candidate_id=$2`, poolID, candidateID); err != nil {
			return err
		}
	} else {
		var accessible bool
		if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM candidate_profiles cp JOIN users u ON u.id=cp.user_id WHERE cp.user_id=$1 AND u.is_active AND u.status='active' AND (`+candidateDiscoverablePredicate+` OR EXISTS(SELECT 1 FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.candidate_id=cp.user_id AND j.company_id=$2)))`, candidateID, company).Scan(&accessible); err != nil {
			return err
		}
		if !accessible {
			return ErrNotFound
		}
		action = "saved"
		if _, err = tx.Exec(ctx, `INSERT INTO recruiter_talent_pool_entries(pool_id,candidate_id,added_by,tags) VALUES($1,$2,$3,$4) ON CONFLICT(pool_id,candidate_id) DO UPDATE SET tags=CASE WHEN $5 THEN recruiter_talent_pool_entries.tags ELSE EXCLUDED.tags END,updated_at=now()`, poolID, candidateID, userID, normalizeTags(tags), tags == nil); err != nil {
			return err
		}
	}
	if _, err = tx.Exec(ctx, `INSERT INTO recruiter_talent_pool_events(pool_id,actor_id,action,candidate_id) VALUES($1,$2,$3,$4)`, poolID, userID, action, candidateID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
