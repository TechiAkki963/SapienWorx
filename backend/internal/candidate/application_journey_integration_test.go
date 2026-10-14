package candidate_test

import (
	"context"
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/privacy"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestApplicationJourneyIsolatedDatabase(t *testing.T) {
	dsn := os.Getenv("JOURNEY_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("isolated journey database not configured")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Database != "sapienworx_journey_test" || (cfg.ConnConfig.Host != "127.0.0.1" && cfg.ConnConfig.Host != "localhost") {
		t.Fatal("refusing non-isolated database")
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
	var exists bool
	if err = db.QueryRow(ctx, `SELECT to_regclass('public.users') IS NOT NULL`).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if !exists {
		files, err := filepath.Glob("../../../database/migrations/*.up.sql")
		if err != nil || len(files) < 67 {
			t.Fatal("67 migrations required")
		}
		for _, file := range files {
			raw, err := os.ReadFile(file)
			if err != nil {
				t.Fatal(err)
			}
			exec(string(raw))
		}
	}
	hash, err := auth.HashPassword("Synthetic-Journey-QA-123!")
	if err != nil {
		t.Fatal(err)
	}
	user := func(role string) string {
		return id(`INSERT INTO users(email,password_hash,role,status,is_active,email_verified_at) VALUES(gen_random_uuid()::text||'@example.test',$1,$2,'active',true,now()) RETURNING id::text`, hash, role)
	}
	owner, foreign, recruiter := user("candidate"), user("candidate"), user("recruiter")
	company := id(`INSERT INTO companies(legal_name,display_name,country_code,verification_status) VALUES('Synthetic journey company','Synthetic journey company','IN','verified') RETURNING id::text`)
	exec(`INSERT INTO recruiter_profiles(user_id,company_id,full_name,verification_status) VALUES($1,$2,'Synthetic recruiter','verified')`, recruiter, company)
	exec(`INSERT INTO candidate_profiles(user_id,full_name,headline) VALUES($1,'Synthetic journey candidate','Engineer'),($2,'Foreign candidate','Engineer')`, owner, foreign)
	job := func(questions []string) string {
		return id(`INSERT INTO jobs(company_id,created_by_recruiter_id,assigned_recruiter_id,title,slug,description,employment_type,work_mode,status,visibility,published_at,screening_questions) VALUES($1,$2,$2,'Synthetic journey role',gen_random_uuid()::text,'Test role','full_time','remote','active','public',now(),$3) RETURNING id::text`, company, recruiter, questions)
	}
	service := candidate.NewService(db)
	state := func(who, jobID string) candidate.ApplicationJourney {
		t.Helper()
		items, err := service.ApplicationStates(ctx, who, []string{jobID})
		if err != nil {
			t.Fatal(err)
		}
		return items[0]
	}
	normal := job([]string{})
	screened := job([]string{"Describe a Go service you built.", "How do you test concurrency?"})
	if _, err = service.Apply(ctx, owner, normal); err != nil {
		t.Fatal("default policy must not require phone or CV", err)
	}
	if _, err = service.Apply(ctx, owner, screened); !errors.Is(err, candidate.ErrApplicationChanged) {
		t.Fatal("legacy submission bypassed screening", err)
	}
	prefs, err := service.Preferences(ctx, owner)
	if err != nil || prefs.ProductAnalytics {
		t.Fatal("analytics must be opt-in", err)
	}
	var count int
	db.QueryRow(ctx, `SELECT count(*) FROM candidate_job_events WHERE candidate_id=$1`, owner).Scan(&count)
	if count != 0 {
		t.Fatal("events without consent")
	}
	enabled := true
	if _, err = service.UpdatePreferences(ctx, owner, candidate.PreferencesUpdate{ProductAnalytics: &enabled, Notifications: map[string]bool{"messages": false}}); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO candidate_notifications(candidate_id,kind,title,body) VALUES($1,'message','Synthetic message','Message body'),($1,'interview','Synthetic interview','Interview body')`, owner)
	inbox, err := service.NotificationInbox(ctx, owner, 1, 20)
	if err != nil || inbox.Total != 1 || inbox.UnreadCount != 1 {
		t.Fatal("notification preference filtering failed", err, inbox)
	}
	if _, err = service.MarkAllNotificationsRead(ctx, owner); err != nil {
		t.Fatal(err)
	}
	var unread bool
	if err = db.QueryRow(ctx, `SELECT read_at IS NULL FROM candidate_notifications WHERE candidate_id=$1 AND kind='message'`, owner).Scan(&unread); err != nil || !unread {
		t.Fatal("muted notification was marked read", err)
	}
	details, err := service.UpdateDetails(ctx, owner, candidate.ProfileDetailsUpdate{Details: map[string]any{"notification_preferences": map[string]bool{"messages": true}}, CurrentSalaryCurrency: "INR", ExpectedSalaryCurrency: "INR"})
	if err != nil {
		t.Fatal("profile update failed", err)
	}
	_ = details
	preserved, err := service.Preferences(ctx, owner)
	if err != nil || preserved.Notifications["messages"] {
		t.Fatal("profile update overwrote notification preferences", err)
	}
	summary, err := service.Summary(ctx, owner)
	if err != nil || !summary.ProductAnalyticsEnabled {
		t.Fatal("summary consent differs", err)
	}
	if err = service.RecordClientJobEvent(ctx, owner, screened, "application_submitted"); !errors.Is(err, candidate.ErrWorkspaceInput) {
		t.Fatal("client forged completion", err)
	}
	if err = service.SaveWorkspaceJob(ctx, owner, screened); err != nil {
		t.Fatal(err)
	}
	if err = service.SaveWorkspaceJob(ctx, owner, screened); err != nil {
		t.Fatal(err)
	}
	current := state(owner, screened)
	input := candidate.ApplicationSubmission{JobID: screened, QuestionVersion: current.QuestionVersion, Answers: []string{"A queue service", ""}}
	draft, err := service.SaveApplicationDraft(ctx, owner, input)
	if err != nil || draft.Revision != 1 {
		t.Fatal("draft failed", err)
	}
	light, err := service.ApplicationStates(ctx, owner, []string{screened}, false)
	if err != nil || light[0].State != "draft" || len(light[0].Answers) > 0 || len(light[0].Questions) > 0 || light[0].Revision != 0 {
		t.Fatal("card state included private draft payload", err, light)
	}
	if state(foreign, screened).Revision != 0 || len(state(foreign, screened).Answers) != 0 {
		t.Fatal("foreign draft exposed")
	}
	input.Revision = 1
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := service.SaveApplicationDraft(ctx, owner, input); results <- err }()
	}
	wg.Wait()
	close(results)
	passes, conflicts := 0, 0
	for err := range results {
		if err == nil {
			passes++
		} else if errors.Is(err, candidate.ErrApplicationChanged) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if passes != 1 || conflicts != 1 {
		t.Fatal("concurrent draft overwrote another revision")
	}
	current = state(owner, screened)
	input.Revision = current.Revision
	if _, err = service.SubmitApplication(ctx, owner, input); !errors.Is(err, candidate.ErrWorkspaceInput) {
		t.Fatal("blank required answer accepted", err)
	}
	input.Answers = []string{"A queue service", "Race detector and contention tests"}
	app, err := service.SubmitApplication(ctx, owner, input)
	if err != nil {
		t.Fatal(err)
	}
	if state(owner, screened).State != "applied" || state(owner, screened).Revision != 0 {
		t.Fatal("submission failed to retire draft")
	}
	var answers []string
	if err = db.QueryRow(ctx, `SELECT answers FROM application_screening_answers WHERE application_id=$1`, app.ID).Scan(&answers); err != nil || len(answers) != 2 || answers[1] != input.Answers[1] {
		t.Fatal("screening answers lost", err)
	}
	if _, err = service.SubmitApplication(ctx, owner, input); !errors.Is(err, candidate.ErrAlreadyApplied) {
		t.Fatal("duplicate accepted", err)
	}
	changed := job([]string{"Original question"})
	v := state(owner, changed)
	draft, err = service.SaveApplicationDraft(ctx, owner, candidate.ApplicationSubmission{JobID: changed, QuestionVersion: v.QuestionVersion, Answers: []string{"Original saved answer"}})
	if err != nil {
		t.Fatal(err)
	}
	exec(`UPDATE jobs SET screening_questions=ARRAY['Revised question'] WHERE id=$1`, changed)
	if _, err = service.SubmitApplication(ctx, owner, candidate.ApplicationSubmission{JobID: changed, QuestionVersion: v.QuestionVersion, Revision: draft.Revision, Answers: draft.Answers}); !errors.Is(err, candidate.ErrApplicationChanged) {
		t.Fatal("stale question snapshot accepted", err)
	}
	if v := state(owner, changed); len(v.PreviousQuestions) != 1 || v.PreviousAnswers[0] != "Original saved answer" {
		t.Fatal("changed-question draft lost its previous snapshot")
	}
	exec(`UPDATE jobs SET visibility='private' WHERE id=$1`, changed)
	hidden := state(foreign, changed)
	if hidden.State != "unavailable" || len(hidden.Questions) > 0 || len(hidden.Answers) > 0 {
		t.Fatal("private job leaked")
	}
	if _, err = service.SaveApplicationDraft(ctx, owner, candidate.ApplicationSubmission{JobID: changed}); !errors.Is(err, candidate.ErrInactiveJob) {
		t.Fatal("private job still accepting", err)
	}
	expired := job([]string{})
	exec(`UPDATE jobs SET application_deadline=current_date-1 WHERE id=$1`, expired)
	if state(owner, expired).State != "expired" {
		t.Fatal("expiry not reflected")
	}
	if _, err = service.Apply(ctx, owner, expired); !errors.Is(err, candidate.ErrInactiveJob) {
		t.Fatal("expired application accepted", err)
	}
	publicRef := id(`SELECT job_reference FROM jobs WHERE id=$1`, screened)
	if got, err := service.Job(ctx, publicRef); err != nil || got.ID != screened || got.ScreeningQuestionVersion == "" {
		t.Fatal("public reference failed", err)
	}
	bundle, err := privacy.NewService(db).BuildSafeExport(ctx, owner)
	if err != nil {
		t.Fatal(err)
	}
	if len(bundle.Sections["screening_answers"]) < 10 || len(bundle.Sections["application_drafts"]) < 10 {
		t.Fatal("personal application data absent from export")
	}
	db.QueryRow(ctx, `SELECT count(*) FROM candidate_job_events WHERE candidate_id=$1 AND job_id=$2 AND event_type='job_saved'`, owner, screened).Scan(&count)
	if count != 1 {
		t.Fatal("save event not deduplicated", count)
	}
	disabled := false
	if _, err = service.UpdatePreferences(ctx, owner, candidate.PreferencesUpdate{ProductAnalytics: &disabled}); err != nil {
		t.Fatal(err)
	}
	db.QueryRow(ctx, `SELECT count(*) FROM candidate_job_events WHERE candidate_id=$1`, owner).Scan(&count)
	if count != 0 {
		t.Fatal("withdrawal retained raw events")
	}
	if err = service.RecordClientJobEvent(ctx, owner, screened, "apply_clicked"); err != nil {
		t.Fatal(err)
	}
	db.QueryRow(ctx, `SELECT count(*) FROM candidate_job_events WHERE candidate_id=$1`, owner).Scan(&count)
	if count != 0 {
		t.Fatal("event after withdrawal")
	}
	// Populated downgrade is deliberately refused, rather than silently discarding answers.
	raw, err := os.ReadFile("../../../database/migrations/000067_candidate_application_journey.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, string(raw)); err == nil {
		t.Fatal("lossy rollback accepted")
	}
	exec("ROLLBACK")
}
