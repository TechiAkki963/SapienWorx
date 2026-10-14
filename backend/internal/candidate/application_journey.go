package candidate

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"strings"
	"unicode/utf8"
)

var ErrApplicationChanged = errors.New("application questions or draft changed; reload before continuing")

type ApplicationJourney struct {
	PreviousQuestions []string `json:"previous_questions,omitempty"`
	PreviousAnswers   []string `json:"previous_answers,omitempty"`
	JobID             string   `json:"job_id"`
	State             string   `json:"state"`
	Questions         []string `json:"questions"`
	QuestionVersion   string   `json:"question_version"`
	Answers           []string `json:"answers"`
	Revision          int64    `json:"revision"`
}
type ApplicationSubmission struct {
	JobID           string   `json:"job_id"`
	QuestionVersion string   `json:"question_version,omitempty"`
	Answers         []string `json:"answers,omitempty"`
	Revision        int64    `json:"revision,omitempty"`
}

func questionVersion(questions []string) string {
	raw, _ := json.Marshal(questions)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
func validateAnswers(questions, answers []string, complete bool) error {
	if len(answers) > len(questions) || (complete && len(answers) != len(questions)) {
		return ErrWorkspaceInput
	}
	for _, answer := range answers {
		if !utf8.ValidString(answer) || strings.ContainsRune(answer, 0) || utf8.RuneCountInString(answer) > 4000 || (complete && strings.TrimSpace(answer) == "") {
			return ErrWorkspaceInput
		}
	}
	return nil
}

// State is scoped to the caller. Missing/private jobs have no identifying data.
// One bounded query serves a page of cards, avoiding one request/query per card.
func (s *Service) ApplicationStates(ctx context.Context, userID string, ids []string, detailed ...bool) ([]ApplicationJourney, error) {
	if len(ids) < 1 || len(ids) > 50 {
		return nil, ErrWorkspaceInput
	}
	details := len(detailed) == 0 || detailed[0]
	seen := map[string]bool{}
	for _, id := range ids {
		if !workspaceUUID.MatchString(id) || seen[strings.ToLower(id)] {
			return nil, ErrWorkspaceInput
		}
		seen[strings.ToLower(id)] = true
	}
	rows, err := s.db.Query(ctx, `SELECT j.id::text,CASE WHEN a.id IS NOT NULL THEN 'applied' WHEN j.status<>'active' THEN 'closed' WHEN j.application_deadline<current_date THEN 'expired' WHEN d.job_id IS NOT NULL THEN 'draft' ELSE 'apply' END,CASE WHEN $3::boolean THEN j.screening_questions ELSE '{}'::text[] END,CASE WHEN $3::boolean THEN COALESCE(d.question_version,'') ELSE '' END,CASE WHEN $3::boolean THEN COALESCE(d.answers,'{}'::text[]) ELSE '{}'::text[] END,CASE WHEN $3::boolean THEN COALESCE(d.revision,0) ELSE 0 END,CASE WHEN $3::boolean THEN COALESCE(d.questions,'{}'::text[]) ELSE '{}'::text[] END FROM jobs j LEFT JOIN applications a ON a.job_id=j.id AND a.candidate_id=$1 LEFT JOIN candidate_application_drafts d ON d.job_id=j.id AND d.candidate_id=$1 WHERE j.id=ANY($2::uuid[]) AND j.visibility='public'`, userID, ids, details)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	byID := map[string]ApplicationJourney{}
	for rows.Next() {
		var v ApplicationJourney
		var savedVersion string
		var savedQuestions []string
		if err = rows.Scan(&v.JobID, &v.State, &v.Questions, &savedVersion, &v.Answers, &v.Revision, &savedQuestions); err != nil {
			return nil, err
		}
		if v.Questions == nil {
			v.Questions = []string{}
		}
		if details {
			v.QuestionVersion = questionVersion(v.Questions)
		}
		if savedVersion != "" && savedVersion != v.QuestionVersion {
			v.PreviousQuestions = savedQuestions
			v.PreviousAnswers = v.Answers
			v.Answers = []string{}
		}
		byID[v.JobID] = v
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	out := make([]ApplicationJourney, 0, len(ids))
	for _, id := range ids {
		v, ok := byID[strings.ToLower(id)]
		if !ok {
			v = ApplicationJourney{JobID: id, State: "unavailable", Questions: []string{}, Answers: []string{}}
		}
		out = append(out, v)
	}
	return out, nil
}

// Serialize a caller's draft/submission with their profile row; the job share lock
// prevents a close/private transition racing the application commit.
func (s *Service) journeyTx(ctx context.Context, userID string, input ApplicationSubmission) (pgx.Tx, []string, error) {
	if !workspaceUUID.MatchString(input.JobID) {
		return nil, nil, ErrWorkspaceInput
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}
	fail := func(err error) (pgx.Tx, []string, error) { _ = tx.Rollback(ctx); return nil, nil, err }
	var id string
	if err = tx.QueryRow(ctx, `SELECT user_id::text FROM candidate_profiles WHERE user_id=$1 FOR UPDATE`, userID).Scan(&id); errors.Is(err, pgx.ErrNoRows) {
		return fail(ErrNotFound)
	} else if err != nil {
		return fail(err)
	}
	var questions []string
	var active bool
	err = tx.QueryRow(ctx, `SELECT screening_questions,status='active' AND visibility='public' AND (application_deadline IS NULL OR application_deadline>=current_date) FROM jobs WHERE id=$1 FOR SHARE`, input.JobID).Scan(&questions, &active)
	if errors.Is(err, pgx.ErrNoRows) || err == nil && !active {
		return fail(ErrInactiveJob)
	}
	if err != nil {
		return fail(err)
	}
	if questions == nil {
		questions = []string{}
	}
	if input.QuestionVersion != "" && input.QuestionVersion != questionVersion(questions) || len(questions) > 0 && input.QuestionVersion == "" {
		return fail(ErrApplicationChanged)
	}
	var applied bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM applications WHERE candidate_id=$1 AND job_id=$2)`, userID, input.JobID).Scan(&applied); err != nil {
		return fail(err)
	}
	if applied {
		return fail(ErrAlreadyApplied)
	}
	var revision int64
	err = tx.QueryRow(ctx, `SELECT revision FROM candidate_application_drafts WHERE candidate_id=$1 AND job_id=$2`, userID, input.JobID).Scan(&revision)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return fail(err)
	}
	if revision != input.Revision {
		return fail(ErrApplicationChanged)
	}
	return tx, questions, nil
}
func (s *Service) SaveApplicationDraft(ctx context.Context, userID string, input ApplicationSubmission) (ApplicationJourney, error) {
	tx, questions, err := s.journeyTx(ctx, userID, input)
	if err != nil {
		return ApplicationJourney{}, err
	}
	defer tx.Rollback(ctx)
	if err = validateAnswers(questions, input.Answers, false); err != nil {
		return ApplicationJourney{}, err
	}
	answers := input.Answers
	if answers == nil {
		answers = []string{}
	}
	var revision int64
	version := questionVersion(questions)
	err = tx.QueryRow(ctx, `INSERT INTO candidate_application_drafts(candidate_id,job_id,question_version,answers,questions) VALUES($1,$2,$3,$4,$5) ON CONFLICT(candidate_id,job_id) DO UPDATE SET question_version=EXCLUDED.question_version,questions=EXCLUDED.questions,answers=EXCLUDED.answers,revision=candidate_application_drafts.revision+1,updated_at=now() RETURNING revision`, userID, input.JobID, version, answers, questions).Scan(&revision)
	if err != nil {
		return ApplicationJourney{}, err
	}
	if err = recordJobEvent(ctx, tx, userID, input.JobID, "application_started"); err != nil {
		return ApplicationJourney{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return ApplicationJourney{}, err
	}
	return ApplicationJourney{JobID: input.JobID, State: "draft", Questions: questions, QuestionVersion: version, Answers: answers, Revision: revision}, nil
}
func (s *Service) SubmitApplication(ctx context.Context, userID string, input ApplicationSubmission) (Application, error) {
	tx, questions, err := s.journeyTx(ctx, userID, input)
	if err != nil {
		return Application{}, err
	}
	defer tx.Rollback(ctx)
	if err = validateAnswers(questions, input.Answers, true); err != nil {
		return Application{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO applications(candidate_id,job_id) VALUES($1,$2) RETURNING id::text`, userID, input.JobID).Scan(&id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return Application{}, ErrAlreadyApplied
		}
		return Application{}, err
	}
	if len(questions) > 0 {
		if _, err = tx.Exec(ctx, `INSERT INTO application_screening_answers(application_id,questions,answers) VALUES($1,$2,$3)`, id, questions, input.Answers); err != nil {
			return Application{}, err
		}
	}
	if _, err = tx.Exec(ctx, `DELETE FROM candidate_application_drafts WHERE candidate_id=$1 AND job_id=$2`, userID, input.JobID); err != nil {
		return Application{}, err
	}
	for _, event := range []string{"application_started", "application_submitted"} {
		if err = recordJobEvent(ctx, tx, userID, input.JobID, event); err != nil {
			return Application{}, err
		}
	}
	var result Application
	err = tx.QueryRow(ctx, `SELECT a.id,a.stage::text,a.applied_at,a.updated_at,j.id,j.title,c.display_name,j.work_mode::text,j.city FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id WHERE a.id=$1 AND a.candidate_id=$2`, id, userID).Scan(&result.ID, &result.Stage, &result.AppliedAt, &result.UpdatedAt, &result.JobID, &result.JobTitle, &result.CompanyName, &result.WorkMode, &result.City)
	if err != nil {
		return Application{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Application{}, err
	}
	return result, nil
}

type eventExecutor interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

func recordJobEvent(ctx context.Context, db eventExecutor, userID, jobID, event string) error {
	// Daily deduplication and 90-day retention limit optional first-party records.
	if _, err := db.Exec(ctx, `DELETE FROM candidate_job_events WHERE candidate_id=$1 AND event_day<current_date-90`, userID); err != nil {
		return err
	}
	_, err := db.Exec(ctx, `INSERT INTO candidate_job_events(candidate_id,job_id,event_type) SELECT $1,$2,$3 WHERE EXISTS(SELECT 1 FROM privacy_consents WHERE user_id=$1 AND purpose='product_analytics' AND granted AND withdrawn_at IS NULL) ON CONFLICT DO NOTHING`, userID, jobID, event)
	return err
}
func (s *Service) RecordClientJobEvent(ctx context.Context, userID, jobID, event string) error {
	if !workspaceUUID.MatchString(jobID) {
		return ErrWorkspaceInput
	}
	switch event {
	case "job_card_viewed", "job_detail_viewed", "apply_clicked":
	default:
		return ErrWorkspaceInput
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var id string
	if err = tx.QueryRow(ctx, `SELECT user_id::text FROM candidate_profiles WHERE user_id=$1 FOR UPDATE`, userID).Scan(&id); err != nil {
		return err
	}
	var public bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM jobs WHERE id=$1 AND visibility='public')`, jobID).Scan(&public); err != nil {
		return err
	}
	if !public {
		return ErrNotFound
	}

	if err = recordJobEvent(ctx, tx, userID, jobID, event); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Shared by consented referral submissions; this does not alter their attribution policy.
func ValidateScreeningSubmission(questions, answers []string, version string) error {
	if len(questions) > 0 && version != questionVersion(questions) {
		return ErrApplicationChanged
	}
	return validateAnswers(questions, answers, true)
}

func RecordApplicationJobEvent(ctx context.Context, tx pgx.Tx, userID, jobID, event string) error {
	switch event {
	case "application_started", "application_submitted":
		return recordJobEvent(ctx, tx, userID, jobID, event)
	default:
		return ErrWorkspaceInput
	}
}
