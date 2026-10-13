package recruiter

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/jackc/pgx/v5"
)

type OfferSettings struct {
	Branding     OfferBranding         `json:"branding"`
	Revision     int64                 `json:"revision"`
	Policy       OfferApprovalPolicy   `json:"policy"`
	Permissions  map[string]bool       `json:"permissions"`
	Entitlements company.Effective     `json:"entitlements"`
	Members      []OfferSettingsMember `json:"members"`
	Usage        map[string]int64      `json:"usage"`
}
type OfferSettingsMember struct {
	UserID      string          `json:"user_id"`
	Name        string          `json:"name"`
	Role        string          `json:"role"`
	Permissions map[string]bool `json:"permissions"`
}
type OfferPermissionGrant struct {
	UserID     string `json:"user_id"`
	Permission string `json:"permission"`
	Allowed    bool   `json:"allowed"`
}
type OfferSettingsInput struct {
	Branding         *OfferBranding         `json:"branding,omitempty"`
	ExpectedRevision int64                  `json:"expected_revision"`
	Policy           OfferApprovalPolicy    `json:"policy"`
	Grants           []OfferPermissionGrant `json:"grants"`
	Reason           string                 `json:"reason"`
}
type OfferTemplateInput struct {
	Name            string                  `json:"name"`
	Definition      OfferTemplateDefinition `json:"definition"`
	Publish         bool                    `json:"publish"`
	Review          bool                    `json:"review,omitempty"`
	ExpectedVersion int                     `json:"expected_version"`
	CommandKey      string                  `json:"command_key"`
}

func (s *sqlOfferStore) Settings(ctx context.Context, actor string) (OfferSettings, error) {
	tx, m, err := s.recruiterTx(ctx, actor, false)
	if err != nil {
		return OfferSettings{}, err
	}
	defer tx.Rollback(ctx)
	result := OfferSettings{Revision: 0, Policy: OfferApprovalPolicy{Mode: "none", Steps: []OfferApprovalStep{}, Rules: []OfferApprovalRule{}}, Members: []OfferSettingsMember{}}
	result.Permissions, err = offerPermissions(ctx, tx, m)
	if err != nil {
		return result, err
	}
	if !result.Permissions["offer.view"] {
		return result, ErrOfferForbidden
	}
	result.Entitlements, err = company.EffectiveTx(ctx, tx, m.CompanyID)
	if err != nil {
		return result, err
	}
	result.Usage = map[string]int64{}
	var templates, sends, documentBytes int64
	err = tx.QueryRow(ctx, `SELECT (SELECT count(*) FROM offer_templates WHERE company_id=$1 AND NOT archived),(SELECT count(*) FROM governed_offer_events WHERE company_id=$1 AND kind='sent' AND occurred_at>=date_trunc('month',now())),(SELECT COALESCE(sum(bytes),0)::bigint FROM (SELECT object_key,max(bytes) bytes FROM (SELECT object_key,bytes FROM offer_document_objects WHERE company_id=$1 UNION ALL SELECT object_key,bytes FROM offer_attachment_uploads WHERE company_id=$1) objects GROUP BY object_key) physical_objects)`, m.CompanyID).Scan(&templates, &sends, &documentBytes)
	if err != nil {
		return result, err
	}
	result.Usage["offer_templates"], result.Usage["offer_monthly_sends"], result.Usage["offer_document_bytes"] = templates, sends, documentBytes
	if result.Permissions["offer.manage_approval_policy"] && result.Permissions["offer.view_compensation"] {
		var raw, branding []byte
		err = tx.QueryRow(ctx, `SELECT revision,approval_policy,branding FROM company_offer_settings WHERE company_id=$1`, m.CompanyID).Scan(&result.Revision, &raw, &branding)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return result, err
		}
		if err == nil {
			if err = json.Unmarshal(branding, &result.Branding); err != nil {
				return result, err
			}
			if err = json.Unmarshal(raw, &result.Policy); err != nil {
				return result, err
			}
		}
	}
	if m.Owner() {
		rows, err := tx.Query(ctx, `SELECT rp.user_id,rp.full_name,COALESCE(cm.role,'legacy_recruiter') FROM recruiter_profiles rp JOIN users u ON u.id=rp.user_id LEFT JOIN company_memberships cm ON cm.user_id=rp.user_id AND cm.company_id=rp.company_id WHERE rp.company_id=$1 AND u.is_active AND u.status='active' AND COALESCE(cm.status,'active')='active' ORDER BY rp.full_name,rp.user_id LIMIT 200`, m.CompanyID)
		if err != nil {
			return result, err
		}
		for rows.Next() {
			var member OfferSettingsMember
			if err = rows.Scan(&member.UserID, &member.Name, &member.Role); err != nil {
				rows.Close()
				return result, err
			}
			member.Permissions = map[string]bool{}
			result.Members = append(result.Members, member)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return result, err
		}
		indices := map[string]int{}
		for i := range result.Members {
			member := company.Member{CompanyID: m.CompanyID, UserID: result.Members[i].UserID, Role: result.Members[i].Role, Status: "active"}
			result.Members[i].Permissions = defaultOfferPermissions(member)
			indices[member.UserID] = i
		}
		grants, err := tx.Query(ctx, `SELECT user_id,permission,allowed FROM company_offer_permissions WHERE company_id=$1`, m.CompanyID)
		if err != nil {
			return result, err
		}
		for grants.Next() {
			var id, key string
			var allowed bool
			if err = grants.Scan(&id, &key, &allowed); err != nil {
				grants.Close()
				return result, err
			}
			if i, exists := indices[id]; exists {
				result.Members[i].Permissions[key] = allowed
			}
		}
		err = grants.Err()
		grants.Close()
		if err != nil {
			return result, err
		}
	}
	return result, nil
}
func (s *sqlOfferStore) SaveSettings(ctx context.Context, actor string, in OfferSettingsInput) (OfferSettings, error) {
	if ValidateOfferPolicy(in.Policy) != nil || len(in.Grants) > 240 || len(in.Reason) < 10 || len(in.Reason) > 1000 {
		return OfferSettings{}, ErrInvalid
	}
	tx, m, err := s.recruiterTx(ctx, actor, true)
	if err != nil {
		return OfferSettings{}, err
	}
	defer tx.Rollback(ctx)
	if err = requireOfferPermission(ctx, tx, m, "offer.manage_approval_policy"); err != nil {
		return OfferSettings{}, err
	}
	if err = requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
		return OfferSettings{}, err
	}
	if len(in.Grants) > 0 && !m.Owner() {
		return OfferSettings{}, ErrOfferForbidden
	}
	if in.Policy.Mode != "none" {
		if err = requireOfferFeature(ctx, tx, m, "offers.approvals"); err != nil {
			return OfferSettings{}, err
		}
		if in.Policy.Mode != "single" {
			if err = requireOfferFeature(ctx, tx, m, "offers."+in.Policy.Mode+"_approvals"); err != nil {
				return OfferSettings{}, err
			}
		}
	}
	if in.Branding != nil {
		if !m.Owner() {
			return OfferSettings{}, ErrOfferForbidden
		}
		if err = validateOfferBranding(*in.Branding); err != nil {
			return OfferSettings{}, err
		}
		if err = requireOfferFeature(ctx, tx, m, "offers.branding"); err != nil {
			return OfferSettings{}, err
		}
	}
	var revision int64
	err = tx.QueryRow(ctx, `SELECT revision FROM company_offer_settings WHERE company_id=$1`, m.CompanyID).Scan(&revision)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return OfferSettings{}, err
	}
	if in.ExpectedRevision != revision {
		return OfferSettings{}, ErrOfferStale
	}
	raw, err := json.Marshal(in.Policy)
	if err != nil {
		return OfferSettings{}, err
	}
	var branding any
	if in.Branding != nil {
		encoded, e := json.Marshal(in.Branding)
		if e != nil {
			return OfferSettings{}, e
		}
		branding = encoded
	}
	_, err = tx.Exec(ctx, `INSERT INTO company_offer_settings(company_id,revision,approval_policy,updated_by,branding) VALUES($1,1,$2,$3,COALESCE($4::jsonb,'{}'::jsonb)) ON CONFLICT(company_id) DO UPDATE SET revision=company_offer_settings.revision+1,approval_policy=EXCLUDED.approval_policy,updated_by=EXCLUDED.updated_by,branding=COALESCE($4::jsonb,company_offer_settings.branding),updated_at=now()`, m.CompanyID, raw, actor, branding)
	if err != nil {
		return OfferSettings{}, err
	}
	seen := map[string]bool{}
	for _, grant := range in.Grants {
		key := grant.UserID + grant.Permission
		if !validUUID(grant.UserID) || !validEnum(grant.Permission, OfferPermissions...) || seen[key] {
			return OfferSettings{}, ErrInvalid
		}
		seen[key] = true
		member, err := company.MemberTx(ctx, tx, grant.UserID)
		if err != nil || member.CompanyID != m.CompanyID {
			return OfferSettings{}, ErrNotFound
		}
		if grant.UserID == actor && grant.Permission == "offer.manage_approval_policy" && !grant.Allowed {
			return OfferSettings{}, ErrInvalid
		}
		if _, err = tx.Exec(ctx, `INSERT INTO company_offer_permissions(company_id,user_id,permission,allowed,updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT(company_id,user_id,permission) DO UPDATE SET allowed=EXCLUDED.allowed,updated_by=EXCLUDED.updated_by,updated_at=now()`, m.CompanyID, grant.UserID, grant.Permission, grant.Allowed, actor); err != nil {
			return OfferSettings{}, err
		}
	}
	// Audit contains the mode and changed grant identities, never compensation or formulas.
	audit, err := json.Marshal(map[string]any{"mode": in.Policy.Mode, "revision": revision + 1, "grant_count": len(in.Grants), "reason": in.Reason})
	if err != nil {
		return OfferSettings{}, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO company_offer_policy_audit(company_id,actor_id,action,detail) VALUES($1,$2,'policy.updated',$3)`, m.CompanyID, actor, audit)
	if err != nil {
		return OfferSettings{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return OfferSettings{}, err
	}
	return s.Settings(ctx, actor)
}
func (s *sqlOfferStore) Templates(ctx context.Context, actor string) ([]OfferTemplate, error) {
	tx, m, err := s.recruiterTx(ctx, actor, false)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err = requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
		return nil, err
	}
	if err = requireOfferPermission(ctx, tx, m, "offer.view"); err != nil {
		return nil, err
	}
	manage, err := offerPermission(ctx, tx, m, "offer.manage_templates")
	if err != nil {
		return nil, err
	}
	// Preserve the last published version while an authorized editor prepares a
	// newer draft/review. At most three versions per bounded template are returned.
	rows, err := tx.Query(ctx, `SELECT t.id,t.name,v.id,v.version,v.status,v.definition,v.definition_hash,COALESCE(NULLIF(rp.full_name,''),'Company administrator'),v.created_at FROM (SELECT * FROM offer_templates WHERE company_id=$1 AND NOT archived ORDER BY created_at DESC,id LIMIT 100)t JOIN LATERAL(SELECT DISTINCT ON(status) * FROM offer_template_versions WHERE template_id=t.id AND status IN('draft','in_review','published') AND ($2::boolean OR status='published') ORDER BY status,version DESC)v ON true LEFT JOIN recruiter_profiles rp ON rp.user_id=t.created_by AND rp.company_id=t.company_id ORDER BY t.created_at DESC,t.id,v.version DESC`, m.CompanyID, manage)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []OfferTemplate{}
	for rows.Next() {
		var x OfferTemplate
		var raw []byte
		if err = rows.Scan(&x.ID, &x.Name, &x.VersionID, &x.Version, &x.Status, &raw, &x.Hash, &x.OwnerName, &x.UpdatedAt); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(raw, &x.Definition); err != nil {
			return nil, err
		}
		result = append(result, x)
	}
	return result, rows.Err()
}
func (s *sqlOfferStore) SaveTemplate(ctx context.Context, actor, id string, in OfferTemplateInput) (OfferTemplate, error) {
	name, definition, publish := in.Name, in.Definition, in.Publish
	if len(name) < 1 || len(name) > 160 || id != "" && !validUUID(id) || validateOfferDefinition(definition) != nil || !validOfferCommandKey(in.CommandKey) || in.ExpectedVersion < 0 || publish && in.Review {
		return OfferTemplate{}, ErrInvalid
	}
	tx, m, err := s.recruiterTx(ctx, actor, true)
	if err != nil {
		return OfferTemplate{}, err
	}
	defer tx.Rollback(ctx)
	if err = requireOfferPermission(ctx, tx, m, "offer.manage_templates"); err != nil {
		return OfferTemplate{}, err
	}
	if err = requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
		return OfferTemplate{}, err
	}
	if err = requireOfferFeature(ctx, tx, m, "offers.templates"); err != nil {
		return OfferTemplate{}, err
	}
	request := struct {
		Action, ID string
		Input      OfferTemplateInput
	}{"template.save", id, in}
	requestHash, err := offerHash(request)
	if err != nil {
		return OfferTemplate{}, err
	}
	var priorHash string
	var prior []byte
	err = tx.QueryRow(ctx, `SELECT request_hash,result->'template' FROM offer_command_results WHERE company_id=$1 AND actor_id=$2 AND command_key=$3`, m.CompanyID, actor, in.CommandKey).Scan(&priorHash, &prior)
	if err == nil {
		if priorHash != requestHash {
			return OfferTemplate{}, ErrOfferStale
		}
		var result OfferTemplate
		if err = json.Unmarshal(prior, &result); err != nil {
			return result, err
		}
		return result, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return OfferTemplate{}, err
	}
	for _, f := range definition.Fields {
		if f.Formula != "" {
			if err = requireOfferPermission(ctx, tx, m, "offer.manage_formulas"); err != nil {
				return OfferTemplate{}, err
			}
			if err = requireOfferFeature(ctx, tx, m, "offers.formulas"); err != nil {
				return OfferTemplate{}, err
			}
		}
	}
	if len(definition.Fields) > 1 {
		if err = requireOfferFeature(ctx, tx, m, "offers.custom_fields"); err != nil {
			return OfferTemplate{}, err
		}
		effective, err := company.EffectiveTx(ctx, tx, m.CompanyID)
		if err != nil {
			return OfferTemplate{}, err
		}
		if limit := effective.Limit("offer_custom_fields", false); limit != nil && int64(len(definition.Fields)-1) > *limit {
			return OfferTemplate{}, company.ErrLimit
		}
	}
	if err = validateOfferCalculationDefinitions(definition.Currency, definition.Fields); err != nil {
		return OfferTemplate{}, err
	}
	version := 1
	if id == "" {
		if in.ExpectedVersion != 0 {
			return OfferTemplate{}, ErrOfferStale
		}
		if err = offerQuota(ctx, tx, m, "offer_templates", 1); err != nil {
			return OfferTemplate{}, err
		}
		err = tx.QueryRow(ctx, `INSERT INTO offer_templates(company_id,name,created_by) VALUES($1,$2,$3) RETURNING id`, m.CompanyID, name, actor).Scan(&id)
		if err != nil {
			return OfferTemplate{}, err
		}
	} else {
		if err = tx.QueryRow(ctx, `SELECT COALESCE(max(v.version),0)+1 FROM offer_templates t LEFT JOIN offer_template_versions v ON v.template_id=t.id WHERE t.id=$1 AND t.company_id=$2 AND NOT t.archived GROUP BY t.id`, id, m.CompanyID).Scan(&version); err != nil {
			return OfferTemplate{}, offerError(err)
		}
		if in.ExpectedVersion != version-1 {
			return OfferTemplate{}, ErrOfferStale
		}
		if _, err = tx.Exec(ctx, `UPDATE offer_templates SET name=$3 WHERE id=$1 AND company_id=$2`, id, m.CompanyID, name); err != nil {
			return OfferTemplate{}, err
		}
	}
	hash, err := offerHash(definition)
	if err != nil {
		return OfferTemplate{}, err
	}
	raw, err := json.Marshal(definition)
	if err != nil {
		return OfferTemplate{}, err
	}
	status := "draft"
	if in.Review {
		status = "in_review"
	}
	var published any
	if publish {
		status = "published"
		published = time.Now().UTC()
	}
	result := OfferTemplate{ID: id, Name: name, Version: version, Status: status, Definition: definition, Hash: hash}
	err = tx.QueryRow(ctx, `INSERT INTO offer_template_versions(template_id,company_id,version,status,definition,definition_hash,created_by,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,created_at`, id, m.CompanyID, version, status, raw, hash, actor, published).Scan(&result.VersionID, &result.UpdatedAt)
	if err != nil {
		return OfferTemplate{}, err
	}
	if err = tx.QueryRow(ctx, `SELECT COALESCE(NULLIF(rp.full_name,''),'Company administrator') FROM offer_templates t LEFT JOIN recruiter_profiles rp ON rp.user_id=t.created_by AND rp.company_id=t.company_id WHERE t.id=$1 AND t.company_id=$2`, id, m.CompanyID).Scan(&result.OwnerName); err != nil {
		return OfferTemplate{}, err
	}
	cached, err := json.Marshal(map[string]any{"template": result})
	if err != nil {
		return OfferTemplate{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO offer_command_results(company_id,actor_id,command_key,request_hash,result) VALUES($1,$2,$3,$4,$5)`, m.CompanyID, actor, in.CommandKey, requestHash, cached); err != nil {
		return OfferTemplate{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return OfferTemplate{}, err
	}
	return result, nil
}

// Archiving retires a template identity from new preparation. Its immutable
// versions and every offer referring to them remain available in history.
type OfferTemplateArchiveInput struct {
	ExpectedVersion int    `json:"expected_version"`
	CommandKey      string `json:"command_key"`
	Reason          string `json:"reason"`
}

func (s *sqlOfferStore) ArchiveTemplate(ctx context.Context, actor, id string, in OfferTemplateArchiveInput) error {
	if !validUUID(id) || !validOfferCommandKey(in.CommandKey) || len(in.Reason) < 10 || len(in.Reason) > 1000 {
		return ErrInvalid
	}
	tx, m, err := s.recruiterTx(ctx, actor, true)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err = requireOfferPermission(ctx, tx, m, "offer.manage_templates"); err != nil {
		return err
	}
	if err = requireOfferPermission(ctx, tx, m, "offer.view_compensation"); err != nil {
		return err
	}
	request := struct {
		Action, ID string
		Input      OfferTemplateArchiveInput
	}{"template.archive", id, in}
	hash, err := offerHash(request)
	if err != nil {
		return err
	}
	var priorHash string
	err = tx.QueryRow(ctx, `SELECT request_hash FROM offer_command_results WHERE company_id=$1 AND actor_id=$2 AND command_key=$3`, m.CompanyID, actor, in.CommandKey).Scan(&priorHash)
	if err == nil {
		if priorHash != hash {
			return ErrOfferStale
		}
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	var current int
	var archived bool
	err = tx.QueryRow(ctx, `SELECT t.archived,COALESCE(max(v.version),0) FROM offer_templates t LEFT JOIN offer_template_versions v ON v.template_id=t.id WHERE t.id=$1 AND t.company_id=$2 GROUP BY t.id`, id, m.CompanyID).Scan(&archived, &current)
	if err != nil {
		return offerError(err)
	}
	if archived || current != in.ExpectedVersion {
		return ErrOfferStale
	}
	if _, err = tx.Exec(ctx, `UPDATE offer_templates SET archived=true WHERE id=$1 AND company_id=$2`, id, m.CompanyID); err != nil {
		return err
	}
	detail, err := json.Marshal(map[string]any{"template_id": id, "version": current, "reason": in.Reason})
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO company_offer_policy_audit(company_id,actor_id,action,detail) VALUES($1,$2,'template.archived',$3)`, m.CompanyID, actor, detail); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO offer_command_results(company_id,actor_id,command_key,request_hash,result) VALUES($1,$2,$3,$4,jsonb_build_object('archived_template_id',$5::text))`, m.CompanyID, actor, in.CommandKey, hash, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
