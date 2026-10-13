package recruiter

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/TechiAkki963/SapienWorx/backend/internal/resume"
	"github.com/TechiAkki963/SapienWorx/backend/internal/storage"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// OfferStudioStore is the persistence boundary used by the HTTP layer. Pure
// calculation, approval selection and PDF rendering have no database dependency.
type OfferStudioStore interface {
	Offers(context.Context, string, string, bool, ...OfferListQuery) (OfferList, error)
	Offer(context.Context, string, string, bool) (GovernedOffer, error)
	Save(context.Context, string, string, OfferWriteInput) (GovernedOffer, error)
	Command(context.Context, string, string, bool, OfferCommand) (GovernedOffer, error)
	Templates(context.Context, string) ([]OfferTemplate, error)
	SaveTemplate(context.Context, string, string, OfferTemplateInput) (OfferTemplate, error)
	ArchiveTemplate(context.Context, string, string, OfferTemplateArchiveInput) error
	Settings(context.Context, string) (OfferSettings, error)
	SaveSettings(context.Context, string, OfferSettingsInput) (OfferSettings, error)
	Document(context.Context, string, string, int, bool, string) (storage.PresignedRequest, error)
	Audit(context.Context, string, string) ([]OfferAuditEvent, error)
	UploadAttachment(context.Context, string, string, string, []byte) (OfferAttachment, error)
	AttachmentDocument(context.Context, string, string, int, string, bool, string) (storage.PresignedRequest, error)
	EligibleApplications(context.Context, string, string, string, string) ([]PipelineRow, error)
}
type sqlOfferStore struct {
	db      *pgxpool.Pool
	objects storage.ObjectStore
	scanner func(context.Context, []byte) error
}

func (s *Service) OfferStudio(objects storage.ObjectStore) OfferStudioStore {
	return &sqlOfferStore{db: s.db, objects: objects, scanner: func(ctx context.Context, body []byte) error {
		return resume.ScanClamD(ctx, os.Getenv("CV_CLAMD_ADDRESS"), body)
	}}
}
func offerError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func offerPermission(ctx context.Context, tx pgx.Tx, m company.Member, key string) (bool, error) {
	if !validEnum(key, OfferPermissions...) || m.Status != "active" {
		return false, nil
	}
	var allowed bool
	err := tx.QueryRow(ctx, `SELECT allowed FROM company_offer_permissions WHERE company_id=$1 AND user_id=$2 AND permission=$3`, m.CompanyID, m.UserID, key).Scan(&allowed)
	if err == nil {
		return allowed, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return false, err
	}
	if m.Owner() {
		return true, nil
	}
	if validEnum(m.Role, "legacy_recruiter", "recruiter", "sub_admin") {
		return validEnum(key, "offer.view", "offer.create", "offer.edit", "offer.send", "offer.withdraw", "offer.view_compensation", "offer.download_documents", "offer.view_audit"), nil
	}
	return false, nil
}
func offerPermissions(ctx context.Context, tx pgx.Tx, m company.Member) (map[string]bool, error) {
	// One query resolves all explicit grants; no query per offer or permission.
	result := defaultOfferPermissions(m)
	rows, err := tx.Query(ctx, `SELECT permission,allowed FROM company_offer_permissions WHERE company_id=$1 AND user_id=$2`, m.CompanyID, m.UserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		var value bool
		if err = rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		result[key] = value
	}
	return result, rows.Err()
}
func defaultOfferPermissions(m company.Member) map[string]bool {
	result := map[string]bool{}
	for _, key := range OfferPermissions {
		result[key] = m.Status == "active" && (m.Owner() || validEnum(m.Role, "legacy_recruiter", "recruiter", "sub_admin") && validEnum(key, "offer.view", "offer.create", "offer.edit", "offer.send", "offer.withdraw", "offer.view_compensation", "offer.download_documents", "offer.view_audit"))
	}
	return result
}
func (s *sqlOfferStore) recruiterTx(ctx context.Context, actor string, write bool) (pgx.Tx, company.Member, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, company.Member{}, err
	}
	m, err := company.MemberTx(ctx, tx, actor)
	if err == nil && write {
		err = company.LockCompanyTx(ctx, tx, m.CompanyID)
		if err == nil {
			m, err = company.MemberTx(ctx, tx, actor)
		}
	}
	if err != nil {
		tx.Rollback(ctx)
		return nil, m, err
	}
	return tx, m, nil
}
func requireOfferPermission(ctx context.Context, tx pgx.Tx, m company.Member, key string) error {
	allowed, err := offerPermission(ctx, tx, m, key)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrOfferForbidden
	}
	return nil
}
func requireOfferFeature(ctx context.Context, tx pgx.Tx, m company.Member, key string) error {
	e, err := company.EffectiveTx(ctx, tx, m.CompanyID)
	if err != nil {
		return err
	}
	if !e.Allows(key) {
		return company.ErrInactive
	}
	return nil
}
func offerQuota(ctx context.Context, tx pgx.Tx, m company.Member, key string, additional int64) error {
	e, err := company.EffectiveTx(ctx, tx, m.CompanyID)
	if err != nil {
		return err
	}
	limit := e.Limit(key, false)
	if limit == nil {
		return nil
	}
	var used int64
	switch key {
	case "offer_templates":
		err = tx.QueryRow(ctx, `SELECT count(*) FROM offer_templates WHERE company_id=$1 AND NOT archived`, m.CompanyID).Scan(&used)
	case "offer_monthly_sends":
		err = tx.QueryRow(ctx, `SELECT count(*) FROM governed_offer_events WHERE company_id=$1 AND kind='sent' AND occurred_at>=date_trunc('month',now())`, m.CompanyID).Scan(&used)
	case "offer_document_bytes":
		err = tx.QueryRow(ctx, `SELECT COALESCE(sum(bytes),0)::bigint FROM (SELECT object_key,max(bytes) bytes FROM (SELECT object_key,bytes FROM offer_document_objects WHERE company_id=$1 UNION ALL SELECT object_key,bytes FROM offer_attachment_uploads WHERE company_id=$1) objects GROUP BY object_key) physical_objects`, m.CompanyID).Scan(&used)
	default:
		return ErrInvalid
	}
	if err != nil {
		return err
	}
	if used+additional > *limit {
		return company.ErrLimit
	}
	return nil
}

const offerProjection = `SELECT o.id,o.application_id,a.candidate_id,COALESCE(cp.full_name,'Candidate profile unavailable'),a.job_id,j.title,j.job_reference,o.title,o.status,o.active_version,v.revision,v.terms_hash,o.updated_at,o.expires_at,v.snapshot,(v.sent_at IS NOT NULL OR v.status IN ('sent','viewed','accepted','declined')) FROM recruiter_offers o JOIN applications a ON a.id=o.application_id JOIN jobs j ON j.id=a.job_id LEFT JOIN candidate_profiles cp ON cp.user_id=a.candidate_id JOIN governed_offer_versions v ON v.offer_id=o.id AND v.version=o.active_version AND v.company_id=o.company_id `

func scanGovernedOffer(row pgx.Row, permissions map[string]bool) (GovernedOffer, error) {
	var x GovernedOffer
	var snapshot []byte
	err := row.Scan(&x.ID, &x.ApplicationID, &x.CandidateID, &x.CandidateName, &x.JobID, &x.JobTitle, &x.JobReference, &x.Title, &x.Status, &x.ActiveVersion, &x.Revision, &x.TermsHash, &x.UpdatedAt, &x.ExpiresAt, &snapshot, &x.Released)
	if err != nil {
		return x, offerError(err)
	}
	x.Permissions = permissions
	if permissions["offer.view_compensation"] {
		var value OfferSnapshot
		if err = json.Unmarshal(snapshot, &value); err != nil {
			return x, err
		}
		x.Snapshot = &value
	}
	return x, nil
}
func (s *sqlOfferStore) Offers(ctx context.Context, actor, job string, candidate bool, options ...OfferListQuery) (OfferList, error) {
	if job != "" && !validUUID(job) {
		return OfferList{}, ErrInvalid
	}
	f := OfferListQuery{Page: 1, Limit: 25}
	if len(options) > 1 {
		return OfferList{}, ErrInvalid
	}
	if len(options) == 1 {
		f = options[0]
	}
	if f.Page < 1 || f.Page > 10000 || f.Limit < 1 || f.Limit > 50 || len(f.Query) > 160 || f.Status != "" && !validEnum(f.Status, "draft", "awaiting_approval", "approved", "sent", "viewed", "accepted", "declined", "withdrawn", "expired", "superseded", "cancelled") {
		return OfferList{}, ErrInvalid
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return OfferList{}, err
	}
	defer tx.Rollback(ctx)
	permissions := map[string]bool{"offer.view": true, "offer.view_compensation": true, "offer.download_documents": true}
	query := strings.Replace(offerProjection, "v.snapshot,", "jsonb_build_object('title',v.snapshot->>'title','currency',v.snapshot->>'currency','annual_compensation',v.snapshot->>'annual_compensation','joining_date',v.snapshot->>'joining_date','expires_at',v.snapshot->>'expires_at'),", 1)
	args := []any{actor, job}
	if candidate {
		query += `WHERE a.candidate_id=$1 AND ($2='' OR a.job_id::text=$2) AND EXISTS(SELECT 1 FROM governed_offer_versions released WHERE released.offer_id=o.id AND (released.sent_at IS NOT NULL OR released.status IN ('sent','viewed','accepted','declined')))`
	}
	if !candidate {
		m, err := company.MemberTx(ctx, tx, actor)
		if err != nil {
			return OfferList{}, err
		}
		permissions, err = offerPermissions(ctx, tx, m)
		if err != nil {
			return OfferList{}, err
		}
		if !permissions["offer.view"] {
			return OfferList{}, ErrOfferForbidden
		}
		query += `WHERE o.company_id=$1 AND j.company_id=$1 AND ($2='' OR j.id::text=$2) AND ($3::boolean OR j.department=ANY($4::text[]) OR j.city=ANY($5::text[]) OR j.id::text=ANY($6::text[]))`
		args = []any{m.CompanyID, job, m.Scope.All, m.Scope.Departments, m.Scope.Locations, m.Scope.JobIDs}
	}
	fromIndex := strings.Index(query, " FROM recruiter_offers ")
	fromClause := query[fromIndex:]
	result := OfferList{Items: []GovernedOffer{}, Page: f.Page, Limit: f.Limit, Counts: map[string]int{}}
	countRows, err := tx.Query(ctx, "SELECT o.status,count(*)"+fromClause+" GROUP BY o.status", args...)
	if err != nil {
		return OfferList{}, err
	}
	for countRows.Next() {
		var status string
		var n int
		if err = countRows.Scan(&status, &n); err != nil {
			countRows.Close()
			return OfferList{}, err
		}
		result.Counts[status] = n
	}
	err = countRows.Err()
	countRows.Close()
	if err != nil {
		return OfferList{}, err
	}
	args = append(args, f.Status, f.Query)
	if !candidate {
		effective, err := company.EffectiveTx(ctx, tx, args[0].(string))
		if err != nil {
			return OfferList{}, err
		}
		if effective.Allows("offers.analytics") {
			insightsClause := strings.Replace(fromClause, "v.version=o.active_version", "true", 1)
			insights := &OfferInsights{}
			err = tx.QueryRow(ctx, `SELECT count(*) FILTER(WHERE v.sent_at IS NOT NULL),count(*) FILTER(WHERE v.viewed_at IS NOT NULL),count(*) FILTER(WHERE v.status='accepted'),count(*) FILTER(WHERE v.status='declined'),avg(EXTRACT(epoch FROM(v.responded_at-v.sent_at))/3600.0) FILTER(WHERE v.responded_at IS NOT NULL AND v.sent_at IS NOT NULL AND v.status IN ('accepted','declined'))`+insightsClause, args[:len(args)-2]...).Scan(&insights.ReleasedVersions, &insights.ViewedVersions, &insights.AcceptedVersions, &insights.DeclinedVersions, &insights.AverageResponseHours)
			if err != nil {
				return OfferList{}, err
			}
			result.Insights = insights
		}
	}
	clause := fmt.Sprintf(" AND ($%d::text='' OR o.status=$%d) AND ($%d::text='' OR cp.full_name ILIKE '%%'||$%d||'%%' OR j.title ILIKE '%%'||$%d||'%%')", len(args)-1, len(args)-1, len(args), len(args), len(args))
	query += clause
	fromClause += clause
	if err = tx.QueryRow(ctx, "SELECT count(*)"+fromClause, args...).Scan(&result.Total); err != nil {
		return OfferList{}, err
	}
	args = append(args, f.Limit, (f.Page-1)*f.Limit)
	query += fmt.Sprintf(" ORDER BY o.updated_at DESC,o.id LIMIT $%d OFFSET $%d", len(args)-1, len(args))
	rows, err := tx.Query(ctx, query, args...)
	if err != nil {
		return OfferList{}, err
	}
	defer rows.Close()

	for rows.Next() {
		x, err := scanGovernedOffer(rows, permissions)
		if err != nil {
			return OfferList{}, err
		}
		if candidate && !x.Released {
			x.Snapshot = nil
			x.TermsHash = ""
			x.Status = "pending_revision"
		}
		result.Items = append(result.Items, x)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	if !candidate {
		err = decorateOfferCandidates(ctx, tx, actor, args[0].(string), result.Items)
	}
	return result, err
}
func loadOffer(ctx context.Context, tx pgx.Tx, m company.Member, id string, candidate bool, actor string) (GovernedOffer, error) {
	if !validUUID(id) {
		return GovernedOffer{}, ErrInvalid
	}
	permissions := map[string]bool{"offer.view": true, "offer.view_compensation": true, "offer.download_documents": true}
	query := offerProjection
	args := []any{id, actor}
	if candidate {
		query += `WHERE o.id=$1 AND a.candidate_id=$2 AND EXISTS(SELECT 1 FROM governed_offer_versions released WHERE released.offer_id=o.id AND (released.sent_at IS NOT NULL OR released.status IN ('sent','viewed','accepted','declined')))`
	}
	if !candidate {
		var err error
		permissions, err = offerPermissions(ctx, tx, m)
		if err != nil {
			return GovernedOffer{}, err
		}
		if !permissions["offer.view"] {
			return GovernedOffer{}, ErrOfferForbidden
		}
		query += `WHERE o.id=$1 AND o.company_id=$2 AND j.company_id=$2`
		args[1] = m.CompanyID
	}
	x, err := scanGovernedOffer(tx.QueryRow(ctx, query, args...), permissions)
	if err != nil {
		return x, err
	}
	if candidate && !x.Released {
		x.Snapshot = nil
		x.TermsHash = ""
		x.Status = "pending_revision"
	}
	if !candidate && !company.JobAllowedTx(ctx, tx, m, x.JobID) {
		return GovernedOffer{}, ErrNotFound
	}
	return x, nil
}
func (s *sqlOfferStore) Offer(ctx context.Context, actor, id string, candidate bool) (GovernedOffer, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return GovernedOffer{}, err
	}
	defer tx.Rollback(ctx)
	var m company.Member
	if !candidate {
		m, err = company.MemberTx(ctx, tx, actor)
		if err != nil {
			return GovernedOffer{}, err
		}
	}
	x, err := loadOffer(ctx, tx, m, id, candidate, actor)
	if err != nil {
		return x, err
	}
	rows, err := tx.Query(ctx, `SELECT version,revision,status,terms_hash,snapshot,created_at,sent_at,viewed_at,responded_at FROM governed_offer_versions WHERE offer_id=$1 AND ($2::boolean=false OR sent_at IS NOT NULL OR status IN ('sent','viewed','accepted','declined')) ORDER BY version DESC LIMIT 100`, id, candidate)
	if err != nil {
		return x, err
	}
	x.Versions = []OfferVersion{}
	for rows.Next() {
		var v OfferVersion
		var raw []byte
		if err = rows.Scan(&v.Version, &v.Revision, &v.Status, &v.TermsHash, &raw, &v.CreatedAt, &v.SentAt, &v.ViewedAt, &v.RespondedAt); err != nil {
			rows.Close()
			return x, err
		}
		v.Approvals = []OfferApproval{}
		v.Documents = []OfferDocument{}
		if x.Permissions["offer.view_compensation"] {
			var value OfferSnapshot
			if err = json.Unmarshal(raw, &value); err != nil {
				rows.Close()
				return x, err
			}
			v.Snapshot = &value
		}
		x.Versions = append(x.Versions, v)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return x, err
	}
	indices := map[int]int{}
	for i, v := range x.Versions {
		indices[v.Version] = i
	}
	if !candidate {
		rows, err = tx.Query(ctx, `SELECT r.version,r.step,r.approver_id,rp.full_name,r.decision,r.reason,r.acted_at FROM offer_approval_requests r JOIN recruiter_profiles rp ON rp.user_id=r.approver_id WHERE r.offer_id=$1 AND r.company_id=$2 ORDER BY r.version DESC,r.step,r.approver_id`, id, m.CompanyID)
		if err != nil {
			return x, err
		}
		for rows.Next() {
			var v int
			var a OfferApproval
			if err = rows.Scan(&v, &a.Step, &a.UserID, &a.Name, &a.Decision, &a.Reason, &a.ActedAt); err != nil {
				rows.Close()
				return x, err
			}
			if i, ok := indices[v]; ok {
				if !x.Permissions["offer.view_compensation"] {
					a.Reason = ""
				}
				x.Versions[i].Approvals = append(x.Versions[i].Approvals, a)
			}
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return x, err
		}
	}
	if x.Permissions["offer.view_compensation"] && x.Permissions["offer.download_documents"] {
		rows, err = tx.Query(ctx, `SELECT id,version,kind,filename,sha256,bytes FROM offer_document_objects WHERE offer_id=$1 ORDER BY version DESC,created_at,id`, id)
		if err != nil {
			return x, err
		}
		for rows.Next() {
			var d OfferDocument
			if err = rows.Scan(&d.ID, &d.Version, &d.Kind, &d.Filename, &d.SHA256, &d.Bytes); err != nil {
				rows.Close()
				return x, err
			}
			if i, ok := indices[d.Version]; ok {
				x.Versions[i].Documents = append(x.Versions[i].Documents, d)
			}
		}
		err = rows.Err()
		rows.Close()
	}
	if err == nil && !candidate {
		items := []GovernedOffer{x}
		err = decorateOfferCandidates(ctx, tx, actor, m.CompanyID, items)
		x = items[0]
	}
	return x, err
}
func cachedOfferCommand(ctx context.Context, tx pgx.Tx, companyID, actor, key string, input any) (string, bool, error) {
	if !validOfferCommandKey(key) {
		return "", false, ErrInvalid
	}
	hash, err := offerHash(input)
	if err != nil {
		return "", false, err
	}
	var previous, id string
	err = tx.QueryRow(ctx, `SELECT request_hash,result->>'offer_id' FROM offer_command_results WHERE company_id=$1 AND actor_id=$2 AND command_key=$3`, companyID, actor, key).Scan(&previous, &id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	if previous != hash {
		return "", false, ErrOfferStale
	}
	return id, true, nil
}
func recordOfferCommand(ctx context.Context, tx pgx.Tx, companyID, actor, key, id string, input any) error {
	hash, err := offerHash(input)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO offer_command_results(company_id,actor_id,command_key,request_hash,result) VALUES($1,$2,$3,$4,jsonb_build_object('offer_id',$5::text))`, companyID, actor, key, hash, id)
	return err
}
func offerEvent(ctx context.Context, tx pgx.Tx, companyID, id, actor, kind string, version int, detail any) error {
	raw, err := json.Marshal(detail)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO governed_offer_events(company_id,offer_id,version,actor_id,kind,detail) VALUES($1,$2,$3,$4,$5,$6)`, companyID, id, version, actor, kind, raw)
	return err
}

func (s *sqlOfferStore) Save(ctx context.Context, actor, id string, in OfferWriteInput) (GovernedOffer, error) {
	if !validUUID(in.ApplicationID) || id != "" && !validUUID(id) || len(in.Title) < 1 || len(in.Title) > 200 || len(in.LetterText) > 20000 {
		return GovernedOffer{}, ErrInvalid
	}
	tx, m, err := s.recruiterTx(ctx, actor, true)
	if err != nil {
		return GovernedOffer{}, err
	}
	defer tx.Rollback(ctx)
	permission := "offer.create"
	if id != "" {
		permission = "offer.edit"
	}
	if err = requireOfferPermission(ctx, tx, m, permission); err != nil {
		return GovernedOffer{}, err
	}
	if err = requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
		return GovernedOffer{}, err
	}
	if err = requireOfferFeature(ctx, tx, m, "offers.studio"); err != nil {
		return GovernedOffer{}, err
	}
	request := struct {
		ID    string
		Input OfferWriteInput
	}{id, in}
	if prior, cached, e := cachedOfferCommand(ctx, tx, m.CompanyID, actor, in.CommandKey, request); e != nil {
		return GovernedOffer{}, e
	} else if cached {
		tx.Rollback(ctx)
		return s.Offer(ctx, actor, prior, false)
	}
	var snap OfferSnapshot
	var stage string
	err = tx.QueryRow(ctx, `SELECT cp.full_name,j.id,j.title,c.display_name,a.stage::text,j.employment_type::text,j.work_mode::text,COALESCE(j.city,''),COALESCE(j.department,'') FROM applications a JOIN candidate_profiles cp ON cp.user_id=a.candidate_id JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.id=$1 AND j.company_id=$2 FOR UPDATE OF a`, in.ApplicationID, m.CompanyID).Scan(&snap.CandidateName, &snap.JobID, &snap.JobTitle, &snap.CompanyName, &stage, &snap.EmploymentType, &snap.WorkMode, &snap.WorkLocation, &snap.Department)
	if err != nil {
		return GovernedOffer{}, offerError(err)
	}
	if stage != "offer" || !company.JobAllowedTx(ctx, tx, m, snap.JobID) {
		return GovernedOffer{}, ErrInvalid
	}
	joining, err := parseOptionalDate(in.JoiningDate)
	if err != nil {
		return GovernedOffer{}, err
	}
	expires, err := parseOptionalDate(in.ExpiresAt)
	if err != nil || !in.SaveIncomplete && (joining == nil || expires == nil) || expires != nil && (expires.Before(time.Now().UTC().Truncate(24*time.Hour)) || joining != nil && expires.After(*joining)) {
		return GovernedOffer{}, ErrInvalid
	}
	definition := defaultOfferDefinition(strings.ToUpper(strings.TrimSpace(in.Currency)))
	var template any
	if in.TemplateVersionID != "" {
		if !validUUID(in.TemplateVersionID) {
			return GovernedOffer{}, ErrInvalid
		}
		var raw []byte
		err = tx.QueryRow(ctx, `SELECT v.definition FROM offer_template_versions v JOIN offer_templates t ON t.id=v.template_id AND t.company_id=v.company_id WHERE v.id=$1 AND v.company_id=$2 AND v.status='published' AND NOT t.archived`, in.TemplateVersionID, m.CompanyID).Scan(&raw)
		if err != nil {
			return GovernedOffer{}, offerError(err)
		}
		if err = json.Unmarshal(raw, &definition); err != nil {
			return GovernedOffer{}, err
		}
		template = in.TemplateVersionID
		if err = requireOfferFeature(ctx, tx, m, "offers.templates"); err != nil {
			return GovernedOffer{}, err
		}
	}
	if err = validateOfferDefinition(definition); err != nil {
		return GovernedOffer{}, err
	}
	if in.SaveIncomplete {
		snap.Values, err = CalculateOfferDraftFields(definition.Currency, definition.Fields, in.Values)
	} else {
		snap.Values, err = CalculateOfferFields(definition.Currency, definition.Fields, in.Values)
	}
	if err != nil {
		return GovernedOffer{}, err
	}
	// Freeze company branding only when the feature is active for this new version.
	effective, e := company.EffectiveTx(ctx, tx, m.CompanyID)
	if e != nil {
		return GovernedOffer{}, e
	}
	if effective.Allows("offers.branding") {
		var raw []byte
		e = tx.QueryRow(ctx, `SELECT branding FROM company_offer_settings WHERE company_id=$1`, m.CompanyID).Scan(&raw)
		if e != nil && !errors.Is(e, pgx.ErrNoRows) {
			return GovernedOffer{}, e
		}
		if e == nil {
			var branding OfferBranding
			if e = json.Unmarshal(raw, &branding); e != nil {
				return GovernedOffer{}, e
			}
			if e = validateOfferBranding(branding); e != nil {
				return GovernedOffer{}, e
			}
			snap.Branding = &branding
		}
	}
	snap.Provenance = "governed"
	snap.TemplateVersionID = in.TemplateVersionID
	snap.Title = strings.TrimSpace(in.Title)
	snap.Currency = definition.Currency
	snap.Fields = definition.Fields
	snap.AnnualCompensation = snap.Values["annual_compensation"]
	snap.JoiningDate = in.JoiningDate
	snap.ExpiresAt = in.ExpiresAt
	_, completeErr := CalculateOfferFields(definition.Currency, definition.Fields, in.Values)
	snap.Incomplete = completeErr != nil || joining == nil || expires == nil
	var databaseCompensation any = snap.AnnualCompensation
	if snap.AnnualCompensation == "" {
		databaseCompensation = nil
	}
	snap.LetterText = definition.LetterText
	snap.Annexures = []OfferAttachment{}
	if len(in.AttachmentIDs) > 10 {
		return GovernedOffer{}, ErrInvalid
	}
	if len(in.AttachmentIDs) > 0 {
		if err = requireOfferFeature(ctx, tx, m, "offers.annexures"); err != nil {
			return GovernedOffer{}, err
		}
	}
	seenAttachments := map[string]bool{}
	for _, attachmentID := range in.AttachmentIDs {
		if !validUUID(attachmentID) || seenAttachments[attachmentID] {
			return GovernedOffer{}, ErrInvalid
		}
		seenAttachments[attachmentID] = true
		var attachment OfferAttachment
		if err = tx.QueryRow(ctx, `SELECT id,filename,sha256,bytes,object_key FROM offer_attachment_uploads WHERE id=$1 AND company_id=$2 AND application_id=$3`, attachmentID, m.CompanyID, in.ApplicationID).Scan(&attachment.ID, &attachment.Filename, &attachment.SHA256, &attachment.Bytes, &attachment.Key); err != nil {
			return GovernedOffer{}, offerError(err)
		}
		snap.Annexures = append(snap.Annexures, attachment)
	}
	if in.LetterText != "" {
		snap.LetterText = strings.TrimSpace(in.LetterText)
	}
	if len(snap.LetterText) < 10 {
		return GovernedOffer{}, ErrInvalid
	}
	omitted := map[string]bool{}
	if len(in.OmittedClauses) > 40 {
		return GovernedOffer{}, ErrInvalid
	}
	for _, key := range in.OmittedClauses {
		if omitted[key] {
			return GovernedOffer{}, ErrInvalid
		}
		omitted[key] = true
	}
	seenClauses := map[string]bool{}
	for _, clause := range definition.Clauses {
		seenClauses[clause.Key] = true
		if omitted[clause.Key] {
			if !clause.Optional {
				return GovernedOffer{}, ErrOfferForbidden
			}
			delete(omitted, clause.Key)
			continue
		}
		if override, ok := in.Clauses[clause.Key]; ok {
			if clause.Locked && override != clause.Text {
				return GovernedOffer{}, ErrOfferForbidden
			}
			if !clause.Locked {
				clause.Text = strings.TrimSpace(override)
			}
		}
		if len(clause.Text) > 8000 {
			return GovernedOffer{}, ErrInvalid
		}
		snap.Clauses = append(snap.Clauses, clause)
	}
	for key := range in.Clauses {
		if !seenClauses[key] {
			return GovernedOffer{}, ErrInvalid
		}
	}
	if len(omitted) > 0 {
		return GovernedOffer{}, ErrInvalid
	}
	snap.LetterSource = snap.LetterText
	snap.ClauseSources = make(map[string]string, len(snap.Clauses))
	variables := offerLetterVariables(snap)
	render := func(source string) (string, error) {
		text, err := renderOfferLetter(source, variables)
		if err != nil && in.SaveIncomplete {
			text, err = renderOfferDraftLetter(source, variables)
			if err == nil {
				snap.Incomplete = true
			}
		}
		return text, err
	}
	if snap.LetterText, err = render(snap.LetterText); err != nil {
		return GovernedOffer{}, err
	}
	for i := range snap.Clauses {
		snap.ClauseSources[snap.Clauses[i].Key] = snap.Clauses[i].Text
		if snap.Clauses[i].Text, err = render(snap.Clauses[i].Text); err != nil {
			return GovernedOffer{}, err
		}
	}

	var policyRaw []byte
	err = tx.QueryRow(ctx, `SELECT approval_policy FROM company_offer_settings WHERE company_id=$1`, m.CompanyID).Scan(&policyRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		policyRaw = []byte(`{"mode":"none","steps":[],"rules":[]}`)
	} else if err != nil {
		return GovernedOffer{}, err
	}
	var policy OfferApprovalPolicy
	if err = json.Unmarshal(policyRaw, &policy); err != nil {
		return GovernedOffer{}, err
	}
	if err = ValidateOfferPolicy(policy); err != nil {
		return GovernedOffer{}, err
	}
	if !snap.Incomplete {
		facts, kinds := offerPolicyFacts(snap)
		if _, err = offerPolicySteps(policy, facts, kinds); err != nil {
			return GovernedOffer{}, err
		}
	}
	version := 1
	if id != "" {
		old, err := loadOffer(ctx, tx, m, id, false, actor)
		if err != nil {
			return GovernedOffer{}, err
		}
		if old.ApplicationID != in.ApplicationID || old.ActiveVersion != in.ExpectedVersion || old.Revision != in.ExpectedRevision {
			return GovernedOffer{}, ErrOfferStale
		}
		if validEnum(old.Status, "accepted", "declined", "withdrawn", "cancelled") || len(strings.TrimSpace(in.ChangeReason)) < 10 || len(in.ChangeReason) > 1000 {
			return GovernedOffer{}, ErrInvalid
		}
		version = old.ActiveVersion + 1
		if _, err = tx.Exec(ctx, `UPDATE governed_offer_versions SET status='superseded',revision=revision+1 WHERE offer_id=$1 AND version=$2`, id, old.ActiveVersion); err != nil {
			return GovernedOffer{}, err
		}
	} else {
		err = tx.QueryRow(ctx, `INSERT INTO recruiter_offers(application_id,company_id,recruiter_id,title,currency,annual_compensation,joining_date,expires_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'draft') RETURNING id`, in.ApplicationID, m.CompanyID, actor, snap.Title, snap.Currency, databaseCompensation, joining, expires).Scan(&id)
		if err != nil {
			if duplicateKey(err) {
				return GovernedOffer{}, ErrOfferStale
			}
			return GovernedOffer{}, err
		}
	}
	hash, err := offerHash(snap)
	if err != nil {
		return GovernedOffer{}, err
	}
	raw, err := json.Marshal(snap)
	if err != nil {
		return GovernedOffer{}, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO governed_offer_versions(offer_id,company_id,version,status,template_version_id,snapshot,terms_hash,approval_policy,created_by,expires_at) VALUES($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9)`, id, m.CompanyID, version, template, raw, hash, policyRaw, actor, expires)
	if err != nil {
		return GovernedOffer{}, err
	}
	for _, attachment := range snap.Annexures {
		if _, err = tx.Exec(ctx, `INSERT INTO offer_document_objects(company_id,offer_id,version,kind,object_key,filename,sha256,bytes,created_by) VALUES($1,$2,$3,'annexure',$4,$5,$6,$7,$8)`, m.CompanyID, id, version, attachment.Key, attachment.Filename, attachment.SHA256, attachment.Bytes, actor); err != nil {
			return GovernedOffer{}, err
		}
		if _, err = tx.Exec(ctx, `UPDATE offer_attachment_uploads SET consumed_at=COALESCE(consumed_at,now()) WHERE id=$1`, attachment.ID); err != nil {
			return GovernedOffer{}, err
		}
	}
	_, err = tx.Exec(ctx, `UPDATE recruiter_offers SET active_version=$2,status='draft',title=$3,currency=$4,annual_compensation=$5,joining_date=$6,expires_at=$7,sent_at=NULL,responded_at=NULL,updated_at=now() WHERE id=$1`, id, version, snap.Title, snap.Currency, databaseCompensation, joining, expires)
	if err != nil {
		return GovernedOffer{}, err
	}
	if err = offerEvent(ctx, tx, m.CompanyID, id, actor, "version_created", version, map[string]any{"previous_version": version - 1, "terms_hash": hash, "reason": in.ChangeReason}); err != nil {
		return GovernedOffer{}, err
	}
	if err = recordOfferCommand(ctx, tx, m.CompanyID, actor, in.CommandKey, id, request); err != nil {
		return GovernedOffer{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return GovernedOffer{}, err
	}
	return s.Offer(ctx, actor, id, false)
}
func duplicateKey(err error) bool {
	var sql interface{ SQLState() string }
	return errors.As(err, &sql) && sql.SQLState() == "23505"
}

// A letter is generated and stored before a send commits. The deterministic
// key permits safe retry after a storage/transaction failure without duplicates.
func (s *sqlOfferStore) ensureLetter(ctx context.Context, tx pgx.Tx, m company.Member, x GovernedOffer) error {
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM offer_document_objects WHERE offer_id=$1 AND version=$2 AND kind='letter')`, x.ID, x.ActiveVersion).Scan(&exists); err != nil {
		return err
	}
	if exists {
		return nil
	}
	if s.objects == nil {
		return storage.ErrUnavailable
	}
	var created time.Time
	var raw []byte
	if err := tx.QueryRow(ctx, `SELECT created_at,snapshot FROM governed_offer_versions WHERE offer_id=$1 AND version=$2`, x.ID, x.ActiveVersion).Scan(&created, &raw); err != nil {
		return err
	}
	var snap OfferSnapshot
	if err := json.Unmarshal(raw, &snap); err != nil {
		return err
	}
	body, err := RenderOfferPDF(snap, x.ActiveVersion, x.TermsHash, created)
	if err != nil {
		return err
	}
	if len(body) > 10485760 {
		return company.ErrLimit
	}
	if err = offerQuota(ctx, tx, m, "offer_document_bytes", int64(len(body))); err != nil {
		return err
	}
	hash := sha256.Sum256(body)
	checksum := hex.EncodeToString(hash[:])
	key := fmt.Sprintf("companies/%s/offers/%s/v%d/%s.pdf", m.CompanyID, x.ID, x.ActiveVersion, checksum)
	if err = s.objects.PutObject(ctx, key, "application/pdf", body); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO offer_document_objects(company_id,offer_id,version,kind,object_key,filename,sha256,bytes,created_by) VALUES($1,$2,$3,'letter',$4,$5,$6,$7,$8)`, m.CompanyID, x.ID, x.ActiveVersion, key, fmt.Sprintf("offer-v%d.pdf", x.ActiveVersion), checksum, len(body), m.UserID)
	return err
}
