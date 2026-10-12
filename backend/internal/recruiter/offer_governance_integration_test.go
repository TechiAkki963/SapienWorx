package recruiter

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/TechiAkki963/SapienWorx/backend/internal/resume"
	"github.com/TechiAkki963/SapienWorx/backend/internal/storage"
	"github.com/jackc/pgx/v5/pgxpool"
)

type offerMemoryObjects struct {
	mu   sync.Mutex
	data map[string][]byte
	fail bool
}

func (s *offerMemoryObjects) PutObject(_ context.Context, key, kind string, body []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.fail {
		return storage.ErrUnavailable
	}
	if kind != "application/pdf" {
		return ErrInvalid
	}
	s.data[key] = append([]byte{}, body...)
	return nil
}
func (s *offerMemoryObjects) PresignGet(_ context.Context, key, name string) (storage.PresignedRequest, error) {
	return storage.PresignedRequest{URL: "https://private.example.test/" + key, Method: "GET", ExpiresAt: time.Now().Add(time.Minute)}, nil
}
func (s *offerMemoryObjects) PresignGetInline(ctx context.Context, key, name string) (storage.PresignedRequest, error) {
	return s.PresignGet(ctx, key, name)
}
func (s *offerMemoryObjects) PresignPut(context.Context, string, string) (storage.PresignedRequest, error) {
	return storage.PresignedRequest{}, storage.ErrUnavailable
}
func (s *offerMemoryObjects) DeleteObject(context.Context, string) error { return nil }

func TestOfferGovernanceIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("OFFER_GOVERNANCE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated local PostgreSQL required")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || cfg.ConnConfig.Database != "sapienworx_ci" {
		t.Fatal("refusing non-local offer QA database")
	}
	ctx := context.Background()
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := db.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	id := func(sql string, args ...any) string {
		t.Helper()
		var value string
		if err := db.QueryRow(ctx, sql, args...).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	count := func(sql string, args ...any) int {
		t.Helper()
		var value int
		if err := db.QueryRow(ctx, sql, args...).Scan(&value); err != nil {
			t.Fatal(err)
		}
		return value
	}
	hash, err := auth.HashPassword("Synthetic-local-offer-QA-123!")
	if err != nil {
		t.Fatal(err)
	}
	user := func(role string) string {
		return id(`INSERT INTO users(email,password_hash,role,status,is_active,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test',$1,$2,'active',true,now()) RETURNING id::text`, hash, role)
	}
	tenant := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES(gen_random_uuid()::text,'Offer QA','IN','verified') RETURNING id::text`)
	foreign := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES(gen_random_uuid()::text,'Foreign QA','IN','verified') RETURNING id::text`)
	owner, r1, r2, blind, other, cand := user("recruiter"), user("recruiter"), user("recruiter"), user("recruiter"), user("recruiter"), user("candidate")
	for _, pair := range []struct{ u, c, role string }{{owner, tenant, "primary_admin"}, {r1, tenant, "recruiter"}, {r2, tenant, "recruiter"}, {blind, tenant, "collaborator"}, {other, foreign, "primary_admin"}} {
		exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,$3,'verified')`, pair.u, pair.c, pair.role)
		exec(`INSERT INTO company_memberships(company_id,user_id,role,scope) VALUES($1,$2,$3,'{"all":true}')`, pair.c, pair.u, pair.role)
	}
	exec(`INSERT INTO candidate_profiles(user_id,full_name) VALUES($1,'Synthetic offer candidate')`, cand)
	job := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,assigned_recruiter_id,slug,title,description,status,employment_type,work_mode) VALUES($1,$2,$2,gen_random_uuid()::text,'Synthetic engineer','Local offer QA','active','full_time','remote') RETURNING id::text`, tenant, owner)
	app := id(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'screening') RETURNING id::text`, cand, job)
	objects := &offerMemoryObjects{data: map[string][]byte{}}
	store := NewService(db).OfferStudio(objects)
	policy := OfferApprovalPolicy{Mode: "sequential", Steps: []OfferApprovalStep{{UserIDs: []string{r1}}, {UserIDs: []string{r2}}}, Rules: []OfferApprovalRule{}}
	settings, err := store.SaveSettings(ctx, owner, OfferSettingsInput{ExpectedRevision: 0, Policy: policy, Branding: &OfferBranding{Accent: "#5348a7", Address: "Synthetic QA address", Signatory: "Authorized QA signatory"}, Grants: []OfferPermissionGrant{{r1, "offer.approve", true}, {r2, "offer.approve", true}, {blind, "offer.view", true}, {blind, "offer.view_compensation", false}, {blind, "offer.download_documents", false}}, Reason: "Configure synthetic two-reviewer policy"})
	if err != nil || settings.Revision != 1 {
		t.Fatal("policy setup failed", err)
	}
	definition := defaultOfferDefinition("INR")
	definition.LetterText = "Dear {{candidate_name}}, {{company_name}} offers you {{job_title}} at {{annual_compensation}} {{currency}}."
	definition.Fields = append(definition.Fields, OfferCalculationField{Key: "monthly_compensation", Label: "Monthly compensation", Kind: "money", Currency: "INR", Formula: "annual_compensation / 12", Locked: true})
	template, err := store.SaveTemplate(ctx, owner, "", OfferTemplateInput{Name: "Engineering offer", Definition: definition, Publish: true, CommandKey: "template-create-1"})
	if err != nil {
		t.Fatal(err)
	}
	retryTemplate, err := store.SaveTemplate(ctx, owner, "", OfferTemplateInput{Name: "Engineering offer", Definition: definition, Publish: true, CommandKey: "template-create-1"})
	if err != nil || retryTemplate.VersionID != template.VersionID {
		t.Fatal("template retry created a duplicate", err)
	}
	draftTemplate, err := store.SaveTemplate(ctx, owner, template.ID, OfferTemplateInput{Name: "Engineering offer", Definition: definition, ExpectedVersion: 1, CommandKey: "template-draft-v2"})
	if err != nil || draftTemplate.Version != 2 {
		t.Fatal("template draft version failed", err)
	}
	if _, err = store.SaveTemplate(ctx, owner, template.ID, OfferTemplateInput{Name: "Stale editor", Definition: definition, ExpectedVersion: 1, CommandKey: "template-stale-v2"}); !errors.Is(err, ErrOfferStale) {
		t.Fatal("stale template overwrote latest", err)
	}
	templates, err := store.Templates(ctx, owner)
	if err != nil || len(templates) != 2 || templates[0].Version != 2 || templates[1].VersionID != template.VersionID {
		t.Fatal("draft hid published template", err)
	}
	now := time.Now().UTC()
	input := OfferWriteInput{ApplicationID: app, TemplateVersionID: template.VersionID, Title: "Engineering employment offer", Currency: "INR", JoiningDate: now.AddDate(0, 1, 0).Format("2006-01-02"), ExpiresAt: now.AddDate(0, 0, 14).Format("2006-01-02"), Values: map[string]string{"annual_compensation": "1200000.30", "monthly_compensation": "1"}, CommandKey: "offer-create-local-1"}
	if _, err = store.Save(ctx, owner, "", input); !errors.Is(err, ErrInvalid) {
		t.Fatal("offer accepted an application outside Offer stage", err)
	}
	exec(`UPDATE applications SET stage='offer' WHERE id=$1`, app)
	scannable := OfferSnapshot{Title: "Private annexure", CompanyName: "Synthetic QA", CandidateName: "Synthetic candidate", JobTitle: "Engineer", Currency: "INR", AnnualCompensation: "1200000.30", JoiningDate: input.JoiningDate, ExpiresAt: input.ExpiresAt, LetterText: "Company terms for the synthetic isolated offer test."}
	pdfBody, err := RenderOfferPDF(scannable, 1, strings.Repeat("a", 64), now)
	if err != nil {
		t.Fatal(err)
	}
	concrete := store.(*sqlOfferStore)
	concrete.scanner = func(context.Context, []byte) error { return resume.ErrScannerUnavailable }
	if _, err = store.UploadAttachment(ctx, owner, app, "terms.pdf", pdfBody); !errors.Is(err, resume.ErrScannerUnavailable) || count(`SELECT count(*) FROM offer_attachment_uploads`) != 0 {
		t.Fatal("unavailable scanner did not block annexure", err)
	}
	concrete.scanner = func(context.Context, []byte) error { return resume.ErrMalwareDetected }
	if _, err = store.UploadAttachment(ctx, owner, app, "terms.pdf", pdfBody); !errors.Is(err, resume.ErrMalwareDetected) || count(`SELECT count(*) FROM offer_attachment_uploads`) != 0 {
		t.Fatal("unsafe annexure was persisted", err)
	}
	concrete.scanner = func(context.Context, []byte) error {
		exec(`INSERT INTO company_offer_permissions(company_id,user_id,permission,allowed,updated_by) VALUES($1,$2,'offer.create',false,$2),($1,$2,'offer.edit',false,$2) ON CONFLICT(company_id,user_id,permission) DO UPDATE SET allowed=false`, tenant, owner)
		return nil
	}
	if _, err = store.UploadAttachment(ctx, owner, app, "terms.pdf", pdfBody); !errors.Is(err, ErrOfferForbidden) {
		t.Fatal("revoked permission during scan was ignored", err)
	}
	exec(`DELETE FROM company_offer_permissions WHERE company_id=$1 AND user_id=$2 AND permission IN ('offer.create','offer.edit')`, tenant, owner)
	scans := 0
	concrete.scanner = func(context.Context, []byte) error { scans++; return nil }
	attachment, err := store.UploadAttachment(ctx, owner, app, "terms.pdf", pdfBody)
	if err != nil {
		t.Fatal("scanned PDF could not be attached", err)
	}
	duplicateAttachment, err := store.UploadAttachment(ctx, owner, app, "terms.pdf", pdfBody)
	if err != nil || duplicateAttachment.ID != attachment.ID || scans != 1 {
		t.Fatal("annexure retry duplicated upload", err)
	}
	if _, err = store.UploadAttachment(ctx, other, app, "terms.pdf", pdfBody); !errors.Is(err, ErrNotFound) {
		t.Fatal("foreign tenant attached a document", err)
	}
	input.AttachmentIDs = []string{attachment.ID}
	x, err := store.Save(ctx, owner, "", input)
	if err != nil {
		t.Fatal(err)
	}
	if x.Snapshot == nil || x.Snapshot.Values["monthly_compensation"] != "100000.03" {
		t.Fatal("server calculation or locked field override failed")
	}
	duplicate, err := store.Save(ctx, owner, "", input)
	if err != nil || duplicate.ID != x.ID || count(`SELECT count(*) FROM recruiter_offers WHERE application_id=$1`, app) != 1 {
		t.Fatal("offer creation was not idempotent", err)
	}
	command := func(actor, action string, current GovernedOffer, key string) (GovernedOffer, error) {
		return store.Command(ctx, actor, current.ID, actor == cand, OfferCommand{Action: action, ExpectedVersion: current.ActiveVersion, ExpectedRevision: current.Revision, TermsHash: current.TermsHash, CommandKey: key, Reason: "Synthetic local approval or candidate action"})
	}
	if _, err = store.Offer(ctx, other, x.ID, false); !errors.Is(err, ErrNotFound) {
		t.Fatal("foreign company read offer", err)
	}
	if _, err = store.Offer(ctx, cand, x.ID, true); !errors.Is(err, ErrNotFound) {
		t.Fatal("candidate read unshared draft", err)
	}
	masked, err := store.Offer(ctx, blind, x.ID, false)
	if err != nil || masked.Snapshot != nil {
		t.Fatal("compensation permission was ignored", err)
	}
	serialized, _ := json.Marshal(masked)
	if strings.Contains(string(serialized), "1200000") {
		t.Fatal("masked response leaked compensation")
	}
	if _, err = store.Document(ctx, blind, x.ID, 1, false, "view"); !errors.Is(err, ErrOfferForbidden) {
		t.Fatal("masked user obtained document", err)
	}
	if _, err = command(owner, "send", x, "premature-send-local"); !errors.Is(err, ErrOfferApproval) {
		t.Fatal("draft bypassed approval", err)
	}
	x, err = command(owner, "submit", x, "submit-local-offer")
	if err != nil || x.Status != "awaiting_approval" {
		t.Fatal("submission failed", err)
	}
	if _, err = command(owner, "approve", x, "self-approval-local"); !errors.Is(err, ErrOfferApproval) {
		t.Fatal("requester approved own offer", err)
	}
	if _, err = command(r2, "approve", x, "out-of-order-local"); !errors.Is(err, ErrOfferApproval) {
		t.Fatal("sequential approver skipped previous reviewer", err)
	}
	x, err = command(r1, "approve", x, "review-one-local")
	if err != nil {
		t.Fatal(err)
	}
	x, err = command(r2, "approve", x, "review-two-local")
	if err != nil || x.Status != "approved" {
		t.Fatal("two-reviewer approval failed", err)
	}
	objects.fail = true
	if _, err = command(owner, "send", x, "send-storage-retry"); !errors.Is(err, storage.ErrUnavailable) {
		t.Fatal("storage failure did not block send", err)
	}
	objects.fail = false
	after, err := store.Offer(ctx, owner, x.ID, false)
	if err != nil || after.Status != "approved" || count(`SELECT count(*) FROM candidate_notifications WHERE candidate_id=$1 AND kind='offer'`, cand) != 0 {
		t.Fatal("failed send altered state or notified candidate", err)
	}
	results := make(chan error, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := command(owner, "send", x, "send-idempotent-local"); results <- err }()
	}
	wg.Wait()
	close(results)
	for err := range results {
		if err != nil {
			t.Fatal("concurrent idempotent send failed", err)
		}
	}
	x, err = store.Offer(ctx, owner, x.ID, false)
	if err != nil || x.Status != "sent" || count(`SELECT count(*) FROM governed_offer_events WHERE offer_id=$1 AND kind='sent'`, x.ID) != 1 || count(`SELECT count(*) FROM candidate_notifications WHERE candidate_id=$1 AND kind='offer'`, cand) != 1 {
		t.Fatal("send duplicated evidence or notification", err)
	}
	if _, err = store.Document(ctx, other, x.ID, 1, false, "download"); !errors.Is(err, ErrNotFound) {
		t.Fatal("foreign tenant downloaded PDF", err)
	}
	if _, err = store.Document(ctx, cand, x.ID, 1, true, "view"); err != nil {
		t.Fatal("candidate could not access released letter", err)
	}
	var annexureDocument string
	for _, doc := range x.Versions[0].Documents {
		if doc.Kind == "annexure" {
			annexureDocument = doc.ID
		}
	}
	if annexureDocument == "" {
		t.Fatal("annexure missing from immutable version")
	}
	if _, err = store.AttachmentDocument(ctx, cand, x.ID, 1, annexureDocument, true, "download"); err != nil {
		t.Fatal("candidate could not download released annexure", err)
	}
	if _, err = store.AttachmentDocument(ctx, other, x.ID, 1, annexureDocument, false, "view"); !errors.Is(err, ErrNotFound) {
		t.Fatal("foreign tenant read annexure", err)
	}
	if x.Snapshot == nil || strings.Contains(x.Snapshot.LetterText, "{{") || !strings.Contains(x.Snapshot.LetterText, "Synthetic offer candidate") || x.Snapshot.Branding == nil || x.Snapshot.Branding.Signatory != "Authorized QA signatory" {
		t.Fatal("letter variables/branding were not frozen")
	}
	if _, err = db.Exec(ctx, `UPDATE governed_offer_versions SET snapshot=jsonb_set(snapshot,'{title}','"tampered"') WHERE offer_id=$1`, x.ID); err == nil {
		t.Fatal("approved snapshot was mutable")
	}
	if _, err = db.Exec(ctx, `INSERT INTO governed_offer_events(company_id,offer_id,version,kind) VALUES($1,$2,1,'foreign')`, foreign, x.ID); err == nil {
		t.Fatal("database accepted cross-company offer evidence")
	}
	originalHash := x.TermsHash
	input.ExpectedVersion = x.ActiveVersion
	input.ExpectedRevision = x.Revision
	input.CommandKey = "create-revision-local"
	input.ChangeReason = "Extend validity after candidate clarification"
	input.ExpiresAt = now.AddDate(0, 0, 21).Format("2006-01-02")
	input.Values["annual_compensation"] = "1300000.30"
	revised, err := store.Save(ctx, owner, x.ID, input)
	if err != nil || revised.ActiveVersion != 2 || revised.Status != "draft" || revised.Versions[1].TermsHash != originalHash || revised.Versions[1].Status != "superseded" {
		t.Fatal("sent revision changed historical terms", err)
	}
	candidateView, err := store.Offer(ctx, cand, x.ID, true)
	if err != nil || candidateView.Snapshot != nil || len(candidateView.Versions) != 1 {
		t.Fatal("candidate could not retain released history or read unshared revision", err)
	}
	if _, err = command(cand, "accept", x, "accept-old-version"); !errors.Is(err, ErrOfferStale) {
		t.Fatal("candidate accepted superseded version", err)
	}
	revised, err = command(owner, "submit", revised, "submit-revision-local")
	if err != nil {
		t.Fatal(err)
	}
	revised, err = command(r1, "approve", revised, "revision-review-one")
	if err != nil {
		t.Fatal(err)
	}
	revised, err = command(r2, "approve", revised, "revision-review-two")
	if err != nil {
		t.Fatal(err)
	}
	revised, err = command(owner, "send", revised, "revision-send-local")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = command(owner, "accept", revised, "recruiter-accept-local"); !errors.Is(err, ErrInvalid) {
		t.Fatal("recruiter impersonated candidate decision", err)
	}
	accepted, err := command(cand, "accept", revised, "candidate-accept-local")
	if err != nil || accepted.Status != "accepted" || count(`SELECT count(*) FROM governed_offer_versions WHERE offer_id=$1 AND version=2 AND response_evidence->>'terms_hash'=$2`, x.ID, revised.TermsHash) != 1 {
		t.Fatal("candidate version-specific response evidence failed", err)
	}
	if _, err = command(owner, "withdraw", accepted, "withdraw-accepted-local"); !errors.Is(err, ErrInvalid) {
		t.Fatal("accepted decision was mutable", err)
	}
	if _, err = store.SaveSettings(ctx, owner, OfferSettingsInput{ExpectedRevision: 0, Policy: policy, Reason: "Stale settings change must be rejected"}); !errors.Is(err, ErrOfferStale) {
		t.Fatal("stale policy overwrote current settings", err)
	}
	list, err := store.Offers(ctx, owner, "", false, OfferListQuery{Page: 1, Limit: 1, Status: "accepted"})
	if err != nil || list.Total != 1 || len(list.Items) != 1 || list.Items[0].Candidate == nil || list.Items[0].Snapshot == nil || len(list.Items[0].Snapshot.Fields) != 0 || list.Insights == nil || list.Insights.AcceptedVersions != 1 {
		t.Fatal("bounded metadata and insights failed", err)
	}
	if audit, err := store.Audit(ctx, owner, x.ID); err != nil || len(audit) == 0 {
		t.Fatal("authorized audit failed", err)
	}
	if _, err = store.Audit(ctx, other, x.ID); !errors.Is(err, ErrNotFound) {
		t.Fatal("foreign audit exposed evidence", err)
	}
	settings, err = store.Settings(ctx, owner)
	if err != nil || settings.Usage["offer_templates"] != 1 || settings.Usage["offer_monthly_sends"] != 2 || settings.Usage["offer_document_bytes"] == 0 {
		t.Fatal("actual offer usage failed", err)
	}

	t.Run("all configured approval modes enforce immutable version decisions", func(t *testing.T) {
		policies := []OfferApprovalPolicy{
			{Mode: "none", Steps: []OfferApprovalStep{}, Rules: []OfferApprovalRule{}},
			{Mode: "single", Steps: []OfferApprovalStep{{UserIDs: []string{r1}}}, Rules: []OfferApprovalRule{}},
			{Mode: "parallel", Steps: []OfferApprovalStep{{UserIDs: []string{r1}}, {UserIDs: []string{r2}}}, Rules: []OfferApprovalRule{}},
			{Mode: "conditional", Steps: []OfferApprovalStep{}, Rules: []OfferApprovalRule{{Field: "annual_compensation", Operator: "gt", Value: "1000", Steps: []OfferApprovalStep{{UserIDs: []string{r1}}}}}},
		}
		for _, p := range policies {
			t.Run(p.Mode, func(t *testing.T) {
				current, e := store.Settings(ctx, owner)
				if e != nil {
					t.Fatal(e)
				}
				if _, e = store.SaveSettings(ctx, owner, OfferSettingsInput{ExpectedRevision: current.Revision, Policy: p, Reason: "Exercise configured synthetic approval mode"}); e != nil {
					t.Fatal(e)
				}
				role := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode) VALUES($1,$2,gen_random_uuid()::text,'Approval QA','Synthetic local approval','active','full_time','remote') RETURNING id::text`, tenant, owner)
				application := id(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'offer') RETURNING id::text`, cand, role)
				draft, e := store.Save(ctx, owner, "", OfferWriteInput{ApplicationID: application, Title: "Approval mode QA", Currency: "INR", JoiningDate: now.AddDate(0, 0, 45).Format("2006-01-02"), ExpiresAt: now.AddDate(0, 0, 20).Format("2006-01-02"), Values: map[string]string{"annual_compensation": "1000"}, CommandKey: "mode-" + p.Mode + "-create"})
				if e != nil {
					t.Fatal(e)
				}
				submitted, e := command(owner, "submit", draft, "mode-"+p.Mode+"-submit")
				if e != nil {
					t.Fatal(e)
				}
				switch p.Mode {
				case "none", "conditional":
					if submitted.Status != "approved" {
						t.Fatal("no-review/equal threshold required fabricated approval", submitted.Status)
					}
				case "single":
					if submitted.Status != "awaiting_approval" {
						t.Fatal(submitted.Status)
					}
					if _, e = command(r2, "approve", submitted, "mode-single-foreign-reviewer"); !errors.Is(e, ErrOfferApproval) {
						t.Fatal("unselected reviewer accepted", e)
					}
					submitted, e = command(r1, "approve", submitted, "mode-single-approve")
					if e != nil || submitted.Status != "approved" {
						t.Fatal(submitted.Status, e)
					}
				case "parallel":
					submitted, e = command(r2, "approve", submitted, "mode-parallel-second-first")
					if e != nil || submitted.Status != "awaiting_approval" {
						t.Fatal("parallel reviewer could not act independently", e)
					}
					submitted, e = command(r1, "approve", submitted, "mode-parallel-first-last")
					if e != nil || submitted.Status != "approved" {
						t.Fatal("parallel quorum ignored", e)
					}
				}
				sent, e := command(owner, "send", submitted, "mode-"+p.Mode+"-send")
				if e != nil {
					t.Fatal(e)
				}
				if p.Mode == "single" {
					withdrawn, e := command(owner, "withdraw", sent, "mode-single-withdraw")
					if e != nil || withdrawn.Status != "withdrawn" {
						t.Fatal(e)
					}
					if _, e = command(cand, "accept", withdrawn, "mode-single-withdrawn-accept"); !errors.Is(e, ErrInvalid) {
						t.Fatal("withdrawn candidate response accepted", e)
					}
					if _, e = store.Document(ctx, cand, sent.ID, 1, true, "download"); e != nil {
						t.Fatal("withdrawal deleted released document", e)
					}
				} else {
					if _, e = command(cand, "decline", sent, "mode-"+p.Mode+"-decline"); e != nil {
						t.Fatal(e)
					}
				}
			})
		}
	})

	t.Run("expiry worker is idempotent and preserves released evidence", func(t *testing.T) {
		role := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode) VALUES($1,$2,gen_random_uuid()::text,'Expiry QA','Synthetic local expiry','active','full_time','remote') RETURNING id::text`, tenant, owner)
		application := id(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'offer') RETURNING id::text`, cand, role)
		expired := id(`INSERT INTO recruiter_offers(application_id,company_id,recruiter_id,status,expires_at,joining_date,sent_at) VALUES($1,$2,$3,'sent',current_date-2,current_date+20,now()-interval '4 days') RETURNING id::text`, application, tenant, owner)
		snap := OfferSnapshot{Provenance: "legacy_import", Title: "Expired legacy offer", Currency: "INR", CandidateName: "Synthetic offer candidate", JobID: role, JobTitle: "Expiry QA", CompanyName: "Offer QA", ExpiresAt: now.AddDate(0, 0, -2).Format("2006-01-02"), AnnualCompensation: "1000"}
		raw, _ := json.Marshal(snap)
		hash, _ := offerHash(snap)
		exec(`INSERT INTO governed_offer_versions(offer_id,company_id,version,status,snapshot,terms_hash,approval_policy,created_by,expires_at,sent_at) VALUES($1,$2,1,'sent',$3,$4,'{"mode":"none","steps":[],"rules":[]}',$5,current_date-2,now()-interval '4 days')`, expired, tenant, raw, hash, owner)
		for n := 0; n < 2; n++ {
			if _, e := NewService(db).ExpireGovernedOffers(ctx, 10); e != nil {
				t.Fatal(e)
			}
		}
		read, e := store.Offer(ctx, cand, expired, true)
		if e != nil || read.Status != "expired" || read.Snapshot == nil || read.Snapshot.Title != snap.Title || count(`SELECT count(*) FROM governed_offer_events WHERE offer_id=$1 AND kind='expired'`, expired) != 1 {
			t.Fatal("expiry destroyed evidence or duplicated event", read.Status, e)
		}
		if _, e = command(cand, "accept", read, "expired-offer-candidate-accept"); !errors.Is(e, ErrInvalid) {
			t.Fatal("expired offer accepted", e)
		}
	})
	t.Run("company send quota serializes competing offers and expiry retains documents", func(t *testing.T) {
		current, e := store.Settings(ctx, owner)
		if e != nil {
			t.Fatal(e)
		}
		if _, e = store.SaveSettings(ctx, owner, OfferSettingsInput{ExpectedRevision: current.Revision, Policy: OfferApprovalPolicy{Mode: "none", Steps: []OfferApprovalStep{}, Rules: []OfferApprovalRule{}}, Reason: "Configure quota and expiry synthetic QA"}); e != nil {
			t.Fatal(e)
		}
		features := map[string]bool{}
		for _, key := range company.PremiumFeatures {
			features[key] = true
		}
		raw, _ := json.Marshal(features)
		used := count(`SELECT count(*) FROM governed_offer_events WHERE company_id=$1 AND kind='sent' AND occurred_at>=date_trunc('month',now())`, tenant)
		capacity, _ := json.Marshal(map[string]int{"offer_monthly_sends": used + 1})
		exec(`INSERT INTO company_subscription_settings(company_id,managed,plan_name,state,period_start,period_end,features,capacity,limits_approved) VALUES($1,true,'Local quota QA','active',now()-interval '1 day',now()+interval '30 days',$2,$3,true) ON CONFLICT(company_id) DO UPDATE SET managed=true,plan_name=EXCLUDED.plan_name,state='active',period_start=EXCLUDED.period_start,period_end=EXCLUDED.period_end,features=EXCLUDED.features,capacity=EXCLUDED.capacity,limits_approved=true`, tenant, raw, capacity)
		prepared := []GovernedOffer{}
		for n := 0; n < 2; n++ {
			role := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode) VALUES($1,$2,gen_random_uuid()::text,'Quota QA','Synthetic local quota','active','full_time','remote') RETURNING id::text`, tenant, owner)
			application := id(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'offer') RETURNING id::text`, cand, role)
			draft, e := store.Save(ctx, owner, "", OfferWriteInput{ApplicationID: application, Title: "Quota QA", Currency: "INR", JoiningDate: now.AddDate(0, 0, 45).Format("2006-01-02"), ExpiresAt: now.AddDate(0, 0, 20).Format("2006-01-02"), Values: map[string]string{"annual_compensation": "1000"}, CommandKey: "quota-create-" + application})
			if e != nil {
				t.Fatal(e)
			}
			draft, e = command(owner, "submit", draft, "quota-submit-"+application)
			if e != nil {
				t.Fatal(e)
			}
			prepared = append(prepared, draft)
		}
		results := make(chan error, 2)
		for _, draft := range prepared {
			go func(draft GovernedOffer) { _, e := command(owner, "send", draft, "quota-send-"+draft.ID); results <- e }(draft)
		}
		successes, limited := 0, 0
		for n := 0; n < 2; n++ {
			e := <-results
			if e == nil {
				successes++
			} else if errors.Is(e, company.ErrLimit) {
				limited++
			} else {
				t.Fatal(e)
			}
		}
		if successes != 1 || limited != 1 || count(`SELECT count(*) FROM governed_offer_events WHERE company_id=$1 AND kind='sent' AND occurred_at>=date_trunc('month',now())`, tenant) != used+1 {
			t.Fatal("concurrent sends overspent quota", successes, limited)
		}
		var sent GovernedOffer
		for _, draft := range prepared {
			read, e := store.Offer(ctx, owner, draft.ID, false)
			if e != nil {
				t.Fatal(e)
			}
			if read.Status == "sent" {
				sent = read
			}
		}
		exec(`UPDATE company_subscription_settings SET state='expired',period_start=now()-interval '35 days',period_end=now()-interval '5 days' WHERE company_id=$1`, tenant)
		blocked := OfferWriteInput{ApplicationID: sent.ApplicationID, ExpectedVersion: sent.ActiveVersion, ExpectedRevision: sent.Revision, CommandKey: "expired-plan-revision", ChangeReason: "Extend immutable sent terms after expiry", Title: "Expired plan must block", Currency: "INR", JoiningDate: now.AddDate(0, 0, 45).Format("2006-01-02"), ExpiresAt: now.AddDate(0, 0, 22).Format("2006-01-02"), Values: map[string]string{"annual_compensation": "2000"}}
		if _, e = store.Save(ctx, owner, sent.ID, blocked); !errors.Is(e, company.ErrInactive) {
			t.Fatal("expired subscription allowed new terms", e)
		}
		if _, e = store.Document(ctx, cand, sent.ID, 1, true, "view"); e != nil {
			t.Fatal("subscription expiry blocked candidate document", e)
		}
		if _, e = command(cand, "accept", sent, "expired-plan-candidate-accept"); e != nil {
			t.Fatal("subscription expiry blocked released candidate response", e)
		}
		exec(`DELETE FROM company_subscription_settings WHERE company_id=$1`, tenant)
	})
	t.Run("template retirement preserves existing offer history", func(t *testing.T) {
		archive := OfferTemplateArchiveInput{ExpectedVersion: 2, CommandKey: "archive-engineering-1", Reason: "Retire synthetic template from new offers"}
		if err := store.ArchiveTemplate(ctx, other, template.ID, archive); !errors.Is(err, ErrNotFound) {
			t.Fatal("foreign template archive", err)
		}
		stale := archive
		stale.ExpectedVersion = 1
		stale.CommandKey = "archive-stale-1"
		if err := store.ArchiveTemplate(ctx, owner, template.ID, stale); !errors.Is(err, ErrOfferStale) {
			t.Fatal("stale template archive", err)
		}
		for i := 0; i < 2; i++ {
			if err := store.ArchiveTemplate(ctx, owner, template.ID, archive); err != nil {
				t.Fatal("archive/retry", err)
			}
		}
		items, err := store.Templates(ctx, owner)
		if err != nil {
			t.Fatal(err)
		}
		for _, item := range items {
			if item.ID == template.ID {
				t.Fatal("archived template is still selectable")
			}
		}
		if count(`SELECT count(*) FROM offer_template_versions WHERE template_id=$1`, template.ID) != 2 {
			t.Fatal("archive deleted immutable versions")
		}
		if _, err := store.Offer(ctx, owner, x.ID, false); err != nil {
			t.Fatal("archive removed offer history", err)
		}
	})

	t.Run("incomplete private drafts cannot be released and revisions re-render preserved variables", func(t *testing.T) {
		role := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode) VALUES($1,$2,gen_random_uuid()::text,'Draft QA','Synthetic private draft','active','full_time','remote') RETURNING id::text`, tenant, owner)
		application := id(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'offer') RETURNING id::text`, cand, role)
		input := OfferWriteInput{ApplicationID: application, Title: "Private draft", Currency: "INR", SaveIncomplete: true, Values: map[string]string{}, LetterText: "Annual compensation: {{annual_compensation}} {{currency}}.", CommandKey: "incomplete-draft-create"}
		draft, e := store.Save(ctx, owner, "", input)
		if e != nil || draft.Snapshot == nil || !draft.Snapshot.Incomplete || draft.Snapshot.AnnualCompensation != "" || !strings.Contains(draft.Snapshot.LetterSource, "{{annual_compensation}}") {
			t.Fatal("private draft did not preserve missing terms/source", draft, e)
		}
		for _, action := range []string{"submit", "send", "preview"} {
			if _, e = command(owner, action, draft, "incomplete-draft-"+action); e == nil {
				t.Fatal("incomplete draft was released", action)
			}
		}
		if _, e = store.Offer(ctx, cand, draft.ID, true); !errors.Is(e, ErrNotFound) {
			t.Fatal("candidate saw an unshared draft", e)
		}
		input.SaveIncomplete = false
		input.ExpectedVersion = draft.ActiveVersion
		input.ExpectedRevision = draft.Revision
		input.ChangeReason = "Complete compensation and validity for review"
		input.CommandKey = "complete-private-draft"
		input.JoiningDate = now.AddDate(0, 0, 45).Format("2006-01-02")
		input.ExpiresAt = now.AddDate(0, 0, 20).Format("2006-01-02")
		input.Values = map[string]string{"annual_compensation": "1000"}
		input.LetterText = draft.Snapshot.LetterSource
		complete, e := store.Save(ctx, owner, draft.ID, input)
		if e != nil || complete.Snapshot.Incomplete || complete.Snapshot.LetterText != "Annual compensation: 1000.00 INR." {
			t.Fatal("completed draft did not render current terms", complete, e)
		}
		firstHash := complete.TermsHash
		input.ExpectedVersion = complete.ActiveVersion
		input.ExpectedRevision = complete.Revision
		input.ChangeReason = "Revise compensation while retaining letter variables"
		input.CommandKey = "revise-private-draft"
		input.Values["annual_compensation"] = "2000"
		input.LetterText = complete.Snapshot.LetterSource
		revised, e := store.Save(ctx, owner, draft.ID, input)
		if e != nil || revised.Snapshot.LetterText != "Annual compensation: 2000.00 INR." || revised.Versions[1].TermsHash != firstHash || revised.Versions[1].Snapshot.LetterText != "Annual compensation: 1000.00 INR." {
			t.Fatal("revision lost variables or altered history", revised, e)
		}
	})

	t.Run("template review versions remain unavailable to offers until published", func(t *testing.T) {
		definition := defaultOfferDefinition("INR")
		review, e := store.SaveTemplate(ctx, owner, "", OfferTemplateInput{Name: "Review-only company terms", Definition: definition, Review: true, CommandKey: "review-template-create"})
		if e != nil || review.Status != "in_review" {
			t.Fatal(review, e)
		}
		role := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode) VALUES($1,$2,gen_random_uuid()::text,'Template review QA','Synthetic local review','active','full_time','remote') RETURNING id::text`, tenant, owner)
		application := id(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'offer') RETURNING id::text`, cand, role)
		if _, e = store.Save(ctx, owner, "", OfferWriteInput{ApplicationID: application, TemplateVersionID: review.VersionID, Title: "Unpublished terms must remain unavailable", Currency: "INR", JoiningDate: now.AddDate(0, 0, 45).Format("2006-01-02"), ExpiresAt: now.AddDate(0, 0, 20).Format("2006-01-02"), Values: map[string]string{"annual_compensation": "1000"}, CommandKey: "review-template-not-selectable"}); !errors.Is(e, ErrNotFound) {
			t.Fatal("review-only terms entered a new offer", e)
		}

		if _, e = store.SaveTemplate(ctx, other, review.ID, OfferTemplateInput{Name: review.Name, Definition: definition, Publish: true, ExpectedVersion: 1, CommandKey: "foreign-review-publish"}); !errors.Is(e, ErrNotFound) {
			t.Fatal("foreign tenant published review", e)
		}
		publish, e := store.SaveTemplate(ctx, owner, review.ID, OfferTemplateInput{Name: review.Name, Definition: definition, Publish: true, ExpectedVersion: 1, CommandKey: "review-template-publish"})
		if e != nil || publish.Status != "published" || publish.Version != 2 {
			t.Fatal(publish, e)
		}
		templates, e := store.Templates(ctx, owner)
		if e != nil {
			t.Fatal(e)
		}
		found := map[string]bool{}
		for _, item := range templates {
			if item.ID == review.ID {
				found[item.Status] = true
			}
		}
		if !found["in_review"] || !found["published"] {
			t.Fatal("publication lost review history", found)
		}
	})

	t.Run("conditional approvals use immutable employment facts rather than changed jobs", func(t *testing.T) {
		current, e := store.Settings(ctx, owner)
		if e != nil {
			t.Fatal(e)
		}
		policy := OfferApprovalPolicy{Mode: "conditional", Rules: []OfferApprovalRule{{Field: "employment_type", Operator: "eq", Value: "full_time", Steps: []OfferApprovalStep{{UserIDs: []string{r1}}}}}}
		if _, e = store.SaveSettings(ctx, owner, OfferSettingsInput{ExpectedRevision: current.Revision, Policy: policy, Reason: "Require review of full-time immutable employment terms"}); e != nil {
			t.Fatal(e)
		}
		role := id(`INSERT INTO jobs(company_id,created_by_recruiter_id,slug,title,description,status,employment_type,work_mode,city,department) VALUES($1,$2,gen_random_uuid()::text,'Employment QA','Synthetic local employment','active','full_time','remote','Mumbai','Engineering') RETURNING id::text`, tenant, owner)
		application := id(`INSERT INTO applications(candidate_id,job_id,stage) VALUES($1,$2,'offer') RETURNING id::text`, cand, role)
		draft, e := store.Save(ctx, owner, "", OfferWriteInput{ApplicationID: application, Title: "Employment QA", Currency: "INR", JoiningDate: now.AddDate(0, 0, 45).Format("2006-01-02"), ExpiresAt: now.AddDate(0, 0, 20).Format("2006-01-02"), Values: map[string]string{"annual_compensation": "2000"}, CommandKey: "frozen-employment-create"})
		if e != nil || draft.Snapshot.EmploymentType != "full_time" || draft.Snapshot.WorkMode != "remote" || draft.Snapshot.WorkLocation != "Mumbai" || draft.Snapshot.Department != "Engineering" {
			t.Fatal("employment facts were not frozen", draft, e)
		}
		exec(`UPDATE jobs SET employment_type='contract',department='Sales' WHERE id=$1`, role)
		submitted, e := command(owner, "submit", draft, "frozen-employment-submit")
		if e != nil || submitted.Status != "awaiting_approval" || len(submitted.Versions[0].Approvals) != 1 {
			t.Fatal("job mutation bypassed immutable employment approval", submitted, e)
		}
		if _, e = command(owner, "send", submitted, "frozen-employment-premature-send"); e == nil {
			t.Fatal("employment review was bypassed")
		}
	})

}
