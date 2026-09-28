package engine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const Version = "engine-v1"

var errCapabilityPaused = errors.New("intelligence capability paused")

type Processor struct {
	db     *pgxpool.Pool
	logger *slog.Logger
}

func NewProcessor(db *pgxpool.Pool, logger *slog.Logger) *Processor {
	return &Processor{db: db, logger: logger}
}

type eventRecord struct {
	ID            string
	EventType     string
	AggregateType string
	AggregateID   *string
	Payload       map[string]any
	Attempts      int
}

func (p *Processor) Run(ctx context.Context, poll time.Duration) error {
	if poll < 250*time.Millisecond {
		poll = 2 * time.Second
	}
	if err := p.heartbeat(ctx, "starting"); err != nil {
		return err
	}
	ticker := time.NewTicker(poll)
	defer ticker.Stop()
	for {
		if err := p.ProcessBatch(ctx, 25); err != nil {
			p.logger.Error("intelligence batch failed", "error", err)
			_ = p.heartbeat(context.Background(), "degraded")
		} else {
			_ = p.heartbeat(ctx, "healthy")
		}
		select {
		case <-ctx.Done():
			_ = p.heartbeat(context.Background(), "stopped")
			return nil
		case <-ticker.C:
		}
	}
}

func (p *Processor) ProcessBatch(ctx context.Context, limit int) error {
	if limit < 1 || limit > 100 {
		limit = 25
	}
	for i := 0; i < limit; i++ {
		event, ok, err := p.claimEvent(ctx)
		if err != nil {
			return err
		}
		if !ok {
			return nil
		}
		if err := p.processEvent(ctx, event); err != nil {
			if errors.Is(err, errCapabilityPaused) {
				if deferErr := p.deferEvent(ctx, event.ID); deferErr != nil {
					return deferErr
				}
				continue
			}
			p.logger.Warn("intelligence event failed", "event_id", event.ID, "event_type", event.EventType, "error", err)
			if markErr := p.failEvent(ctx, event.ID, event.Attempts, err); markErr != nil {
				return markErr
			}
			continue
		}
		if _, err := p.db.Exec(ctx, `UPDATE intelligence.events SET status='processed',processed_at=now(),locked_at=NULL,last_error=NULL WHERE id=$1`, event.ID); err != nil {
			return err
		}
	}
	return nil
}

func (p *Processor) claimEvent(ctx context.Context) (eventRecord, bool, error) {
	tx, err := p.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return eventRecord{}, false, err
	}
	defer tx.Rollback(ctx)
	var out eventRecord
	var raw []byte
	err = tx.QueryRow(ctx, `
		SELECT id,event_type,aggregate_type,aggregate_id,payload,attempts
		FROM intelligence.events
		WHERE status IN ('pending','failed') AND available_at<=now()
		  AND attempts < 8
		ORDER BY created_at
		FOR UPDATE SKIP LOCKED
		LIMIT 1`).Scan(&out.ID, &out.EventType, &out.AggregateType, &out.AggregateID, &raw, &out.Attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return eventRecord{}, false, nil
	}
	if err != nil {
		return eventRecord{}, false, err
	}
	if err := json.Unmarshal(raw, &out.Payload); err != nil {
		return eventRecord{}, false, err
	}
	out.Attempts++
	if _, err = tx.Exec(ctx, `UPDATE intelligence.events SET status='processing',attempts=$2,locked_at=now() WHERE id=$1`, out.ID, out.Attempts); err != nil {
		return eventRecord{}, false, err
	}
	if err = tx.Commit(ctx); err != nil {
		return eventRecord{}, false, err
	}
	return out, true, nil
}

func (p *Processor) failEvent(ctx context.Context, id string, attempts int, cause error) error {
	delaySeconds := int(math.Min(300, math.Pow(2, float64(attempts))*5))
	_, err := p.db.Exec(ctx, `UPDATE intelligence.events SET status='failed',locked_at=NULL,last_error=$2,available_at=now()+make_interval(secs=>$3) WHERE id=$1`, id, truncate(cause.Error(), 2000), delaySeconds)
	return err
}

func (p *Processor) deferEvent(ctx context.Context, id string) error {
	_, err := p.db.Exec(ctx, `UPDATE intelligence.events
		SET status='pending',
		    attempts=GREATEST(attempts-1,0),
		    locked_at=NULL,
		    last_error=NULL,
		    available_at=now()+interval '30 seconds'
		WHERE id=$1`, id)
	return err
}

func (p *Processor) processEvent(ctx context.Context, event eventRecord) error {
	enabled, err := p.switchEnabled(ctx, "global_intelligence")
	if err != nil {
		return err
	}
	if !enabled {
		return errCapabilityPaused
	}
	switch event.EventType {
	case "candidate.profile_created", "candidate.profile_updated", "candidate.cv_uploaded":
		ok, err := p.switchEnabled(ctx, "candidate_intelligence")
		if err != nil {
			return err
		}
		if !ok {
			return errCapabilityPaused
		}
		if event.EventType == "candidate.cv_uploaded" {
			cvEnabled, err := p.switchEnabled(ctx, "cv_intelligence")
			if err != nil {
				return err
			}
			if !cvEnabled {
				return errCapabilityPaused
			}
		}
		if event.AggregateID == nil {
			return nil
		}
		if err := p.refreshCandidateFeatures(ctx, *event.AggregateID, event.ID); err != nil {
			return err
		}
		return p.refreshCandidateMatches(ctx, *event.AggregateID)
	case "job.created", "job.updated":
		if event.AggregateID == nil {
			return nil
		}
		if err := p.refreshJobFeatures(ctx, *event.AggregateID, event.ID); err != nil {
			return err
		}
		return p.refreshJobMatches(ctx, *event.AggregateID)
	case "application.created", "application.stage_changed", "candidate.job_saved", "candidate.job_unsaved":
		return p.captureFeedback(ctx, event)
	case "platform.analysis.requested":
		return p.runPlatformAnalysis(ctx, event)
	case "matching.candidate_recompute":
		if event.AggregateID == nil {
			return nil
		}
		ok, err := p.switchEnabled(ctx, "matching")
		if err != nil {
			return err
		}
		if !ok {
			return errCapabilityPaused
		}
		return p.refreshCandidateMatches(ctx, *event.AggregateID)
	default:
		return nil
	}
}

func (p *Processor) switchEnabled(ctx context.Context, key string) (bool, error) {
	var enabled bool
	err := p.db.QueryRow(ctx, `SELECT enabled FROM intelligence.engine_switches WHERE switch_key=$1`, key).Scan(&enabled)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	return enabled, err
}

func (p *Processor) refreshCandidateFeatures(ctx context.Context, candidateID, sourceEventID string) error {
	var headline, city, state, country, interestedDomains string
	var totalMonths int
	var notice *int
	var skillsRaw, employmentRaw, educationRaw []byte
	err := p.db.QueryRow(ctx, `SELECT
		COALESCE(headline,''),
		COALESCE(current_city,''),
		COALESCE(current_state,''),
		country_code,
		total_experience_months,
		notice_period_days,
		COALESCE(profile_details->'it_skills','[]'::jsonb),
		COALESCE(profile_details->'employment','[]'::jsonb),
		COALESCE(profile_details->'education','[]'::jsonb),
		COALESCE(profile_details->>'interested_domains','')
		FROM candidate_profiles WHERE user_id=$1`, candidateID).
		Scan(&headline, &city, &state, &country, &totalMonths, &notice, &skillsRaw, &employmentRaw, &educationRaw, &interestedDomains)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}

	var skillItems, employmentItems, educationItems []any
	_ = json.Unmarshal(skillsRaw, &skillItems)
	_ = json.Unmarshal(employmentRaw, &employmentItems)
	_ = json.Unmarshal(educationRaw, &educationItems)

	skills, err := p.normalizeSkills(ctx, extractSkillNames(skillItems))
	if err != nil {
		return err
	}
	experience := minimizeEmployment(employmentItems)
	education := minimizeEducation(educationItems)
	certifications := []any{}
	projects := []any{}
	domains := splitProfessionalDomains(interestedDomains)
	seniority := seniorityFromMonths(totalMonths)

	confidence := 0.55
	if len(skills) > 0 {
		confidence += 0.15
	}
	if len(experience) > 0 {
		confidence += 0.1
	}
	if len(education) > 0 {
		confidence += 0.05
	}
	if headline != "" {
		confidence += 0.05
	}
	if confidence > 0.9 {
		confidence = 0.9
	}

	expRaw, _ := json.Marshal(experience)
	eduRaw, _ := json.Marshal(education)
	certRaw, _ := json.Marshal(certifications)
	projectRaw, _ := json.Marshal(projects)
	_, err = p.db.Exec(ctx, `
		INSERT INTO intelligence.candidate_features(candidate_id,skills,experience,education,certifications,projects,domains,seniority,headline,total_experience_months,city,state,country_code,notice_period_days,confidence,source_event_id)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULLIF($11,''),NULLIF($12,''),$13,$14,$15,$16)
		ON CONFLICT(candidate_id) DO UPDATE SET
		  feature_version=intelligence.candidate_features.feature_version+1,
		  skills=EXCLUDED.skills,experience=EXCLUDED.experience,education=EXCLUDED.education,certifications=EXCLUDED.certifications,projects=EXCLUDED.projects,domains=EXCLUDED.domains,
		  seniority=EXCLUDED.seniority,headline=EXCLUDED.headline,total_experience_months=EXCLUDED.total_experience_months,city=EXCLUDED.city,state=EXCLUDED.state,country_code=EXCLUDED.country_code,
		  notice_period_days=EXCLUDED.notice_period_days,confidence=EXCLUDED.confidence,source_event_id=EXCLUDED.source_event_id,generated_at=now()`,
		candidateID, skills, expRaw, eduRaw, certRaw, projectRaw, domains, seniority, headline, totalMonths, city, state, country, notice, confidence, sourceEventID)
	return err
}

func (p *Processor) refreshJobFeatures(ctx context.Context, jobID, sourceEventID string) error {
	var title, roleCategory, employmentType, workMode, city, state, country, status string
	var required []string
	var minMonths int
	var maxMonths *int
	err := p.db.QueryRow(ctx, `SELECT title,COALESCE(role_category,''),required_skills,min_experience_months,max_experience_months,employment_type::text,work_mode::text,COALESCE(city,''),COALESCE(state,''),country_code,status::text FROM jobs WHERE id=$1`, jobID).
		Scan(&title, &roleCategory, &required, &minMonths, &maxMonths, &employmentType, &workMode, &city, &state, &country, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	required, err = p.normalizeSkills(ctx, required)
	if err != nil {
		return err
	}
	roleFamily := normalizeRoleFamily(title, roleCategory)
	_, err = p.db.Exec(ctx, `
		INSERT INTO intelligence.job_features(job_id,title,role_family,role_category,required_skills,min_experience_months,max_experience_months,employment_type,work_mode,city,state,country_code,status,source_event_id)
		VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,''),NULLIF($11,''),$12,$13,$14)
		ON CONFLICT(job_id) DO UPDATE SET
		  feature_version=intelligence.job_features.feature_version+1,title=EXCLUDED.title,role_family=EXCLUDED.role_family,role_category=EXCLUDED.role_category,required_skills=EXCLUDED.required_skills,
		  min_experience_months=EXCLUDED.min_experience_months,max_experience_months=EXCLUDED.max_experience_months,employment_type=EXCLUDED.employment_type,work_mode=EXCLUDED.work_mode,
		  city=EXCLUDED.city,state=EXCLUDED.state,country_code=EXCLUDED.country_code,status=EXCLUDED.status,source_event_id=EXCLUDED.source_event_id,generated_at=now()`,
		jobID, title, roleFamily, roleCategory, required, minMonths, maxMonths, employmentType, workMode, city, state, country, status, sourceEventID)
	return err
}

type candidateFeature struct {
	ID       string
	Skills   []string
	Months   int
	City     *string
	State    *string
	Country  *string
	Notice   *int
	Headline string
}
type jobFeature struct {
	ID        string
	Title     string
	Skills    []string
	MinMonths int
	MaxMonths *int
	WorkMode  string
	City      *string
	State     *string
	Country   *string
	Status    string
}

func (p *Processor) refreshCandidateMatches(ctx context.Context, candidateID string) error {
	ok, err := p.switchEnabled(ctx, "matching")
	if err != nil || !ok {
		return err
	}
	candidate, err := p.loadCandidateFeature(ctx, candidateID)
	if err != nil {
		return err
	}
	rows, err := p.db.Query(ctx, `SELECT job_id,title,required_skills,min_experience_months,max_experience_months,work_mode,city,state,country_code,status FROM intelligence.job_features WHERE status='active'`)
	if err != nil {
		return err
	}
	defer rows.Close()
	jobs := make([]jobFeature, 0)
	for rows.Next() {
		var j jobFeature
		if err := rows.Scan(&j.ID, &j.Title, &j.Skills, &j.MinMonths, &j.MaxMonths, &j.WorkMode, &j.City, &j.State, &j.Country, &j.Status); err != nil {
			return err
		}
		jobs = append(jobs, j)
	}
	for _, j := range jobs {
		if err := p.storeMatch(ctx, candidate, j); err != nil {
			return err
		}
	}
	return p.refreshRecommendations(ctx, candidateID)
}

func (p *Processor) refreshJobMatches(ctx context.Context, jobID string) error {
	ok, err := p.switchEnabled(ctx, "matching")
	if err != nil || !ok {
		return err
	}
	job, err := p.loadJobFeature(ctx, jobID)
	if err != nil {
		return err
	}
	rows, err := p.db.Query(ctx, `SELECT candidate_id,skills,total_experience_months,city,state,country_code,notice_period_days,headline FROM intelligence.candidate_features`)
	if err != nil {
		return err
	}
	defer rows.Close()
	candidates := make([]candidateFeature, 0)
	for rows.Next() {
		var c candidateFeature
		if err := rows.Scan(&c.ID, &c.Skills, &c.Months, &c.City, &c.State, &c.Country, &c.Notice, &c.Headline); err != nil {
			return err
		}
		candidates = append(candidates, c)
	}
	for _, c := range candidates {
		if err := p.storeMatch(ctx, c, job); err != nil {
			return err
		}
		if err := p.refreshRecommendations(ctx, c.ID); err != nil {
			return err
		}
	}
	return nil
}

func (p *Processor) loadCandidateFeature(ctx context.Context, id string) (candidateFeature, error) {
	var c candidateFeature
	err := p.db.QueryRow(ctx, `SELECT candidate_id,skills,total_experience_months,city,state,country_code,notice_period_days,headline FROM intelligence.candidate_features WHERE candidate_id=$1`, id).
		Scan(&c.ID, &c.Skills, &c.Months, &c.City, &c.State, &c.Country, &c.Notice, &c.Headline)
	return c, err
}

func (p *Processor) loadJobFeature(ctx context.Context, id string) (jobFeature, error) {
	var j jobFeature
	err := p.db.QueryRow(ctx, `SELECT job_id,title,required_skills,min_experience_months,max_experience_months,work_mode,city,state,country_code,status FROM intelligence.job_features WHERE job_id=$1`, id).
		Scan(&j.ID, &j.Title, &j.Skills, &j.MinMonths, &j.MaxMonths, &j.WorkMode, &j.City, &j.State, &j.Country, &j.Status)
	return j, err
}

func (p *Processor) storeMatch(ctx context.Context, c candidateFeature, j jobFeature) error {
	modelID, config, err := p.productionMatchingModel(ctx)
	if err != nil {
		return err
	}
	return p.storeMatchForModel(ctx, c, j, modelID, config)
}

func (p *Processor) storeMatchForModel(ctx context.Context, c candidateFeature, j jobFeature, modelID string, config map[string]any) error {
	weights := map[string]float64{"skills": 0.45, "experience": 0.20, "location": 0.10, "availability": 0.10, "semantic": 0.15}
	if raw, ok := config["weights"].(map[string]any); ok {
		total := 0.0
		for k := range weights {
			if value, ok := raw[k].(float64); ok && value >= 0 && value <= 1 {
				weights[k] = value
			}
			total += weights[k]
		}
		if total > 0 {
			for k := range weights {
				weights[k] /= total
			}
		}
	}
	eligible := c.Months >= j.MinMonths
	if j.MaxMonths != nil && c.Months > *j.MaxMonths+36 {
		eligible = false
	}
	skillScore, matchedSkills := skillOverlap(c.Skills, j.Skills)
	experienceScore := experienceFit(c.Months, j.MinMonths, j.MaxMonths)
	locationScore := locationFit(c, j)
	availabilityScore := availabilityFit(c.Notice)
	semanticScore := lexicalRelevance(c.Headline, j.Title)
	score := 100 * (weights["skills"]*skillScore + weights["experience"]*experienceScore + weights["location"]*locationScore + weights["availability"]*availabilityScore + weights["semantic"]*semanticScore)
	if !eligible {
		score = math.Min(score, 45)
	}
	score = math.Max(0, math.Min(100, score))
	components := map[string]any{
		"skills": skillScore * 100, "experience": experienceScore * 100, "location": locationScore * 100,
		"availability": availabilityScore * 100, "semantic": semanticScore * 100, "matched_skills": matchedSkills,
	}
	explanation := map[string]any{
		"eligible": eligible, "matched_skills": matchedSkills, "experience_months": c.Months,
		"job_min_experience_months": j.MinMonths, "location_alignment": locationScore >= 0.8,
		"availability_signal": availabilityScore, "method": "deterministic-weighted-v1",
	}
	compRaw, _ := json.Marshal(components)
	expRaw, _ := json.Marshal(explanation)
	_, err := p.db.Exec(ctx, `
		INSERT INTO intelligence.match_results(candidate_id,job_id,model_version_id,eligible,score,components,explanation)
		VALUES($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT(candidate_id,job_id,model_version_id) DO UPDATE SET eligible=EXCLUDED.eligible,score=EXCLUDED.score,components=EXCLUDED.components,explanation=EXCLUDED.explanation,generated_at=now()`,
		c.ID, j.ID, modelID, eligible, score, compRaw, expRaw)
	return err
}

func (p *Processor) productionMatchingModel(ctx context.Context) (string, map[string]any, error) {
	var id string
	var raw []byte
	err := p.db.QueryRow(ctx, `SELECT id,config FROM intelligence.model_versions WHERE engine_type='matching' AND status='production' ORDER BY activated_at DESC NULLS LAST LIMIT 1`).Scan(&id, &raw)
	if err != nil {
		return "", nil, err
	}
	var cfg map[string]any
	_ = json.Unmarshal(raw, &cfg)
	return id, cfg, nil
}

func (p *Processor) refreshRecommendations(ctx context.Context, candidateID string) error {
	modelID, _, err := p.productionMatchingModel(ctx)
	if err != nil {
		return err
	}
	rows, err := p.db.Query(ctx, `SELECT job_id,score,explanation FROM intelligence.match_results WHERE candidate_id=$1 AND model_version_id=$2 AND eligible=true ORDER BY score DESC,generated_at DESC LIMIT 25`, candidateID, modelID)
	if err != nil {
		return err
	}
	defer rows.Close()
	type rec struct {
		job         string
		score       float64
		explanation []byte
	}
	items := make([]rec, 0)
	for rows.Next() {
		var r rec
		if err := rows.Scan(&r.job, &r.score, &r.explanation); err != nil {
			return err
		}
		items = append(items, r)
	}
	if _, err := p.db.Exec(ctx, `DELETE FROM intelligence.recommendations WHERE candidate_id=$1`, candidateID); err != nil {
		return err
	}
	for i, item := range items {
		if item.score < 55 {
			continue
		}
		if _, err := p.db.Exec(ctx, `INSERT INTO intelligence.recommendations(candidate_id,job_id,model_version_id,score,rank,explanation,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '7 days')`, candidateID, item.job, modelID, item.score, i+1, item.explanation); err != nil {
			return err
		}
	}
	return nil
}

func (p *Processor) captureFeedback(ctx context.Context, event eventRecord) error {
	ok, err := p.switchEnabled(ctx, "learning_collection")
	if err != nil || !ok {
		return err
	}
	var candidateID, jobID, applicationID *string
	if v, ok := event.Payload["candidate_id"].(string); ok {
		candidateID = &v
	}
	if v, ok := event.Payload["job_id"].(string); ok {
		jobID = &v
	}
	if event.AggregateType == "application" && event.AggregateID != nil {
		applicationID = event.AggregateID
	}
	label := feedbackLabel(event.EventType, event.Payload)
	meta := map[string]any{}
	if stage, ok := event.Payload["stage"].(string); ok {
		meta["stage"] = stage
	}
	raw, _ := json.Marshal(meta)
	_, err = p.db.Exec(ctx, `INSERT INTO intelligence.feedback_events(event_type,candidate_id,job_id,application_id,label,metadata,source_event_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(source_event_id) DO NOTHING`,
		event.EventType, candidateID, jobID, applicationID, label, raw, event.ID)
	return err
}

func feedbackLabel(eventType string, payload map[string]any) *float64 {
	var value float64
	switch eventType {
	case "candidate.job_saved":
		value = 0.35
	case "candidate.job_unsaved":
		value = -0.15
	case "application.created":
		value = 0.50
	case "application.stage_changed":
		stage, _ := payload["stage"].(string)
		switch stage {
		case "shortlisted":
			value = 0.70
		case "technical_interview", "hr_round", "final_interview":
			value = 0.80
		case "offer":
			value = 0.90
		case "hired":
			value = 1.0
		case "rejected", "withdrawn":
			value = -0.30
		default:
			value = 0.10
		}
	default:
		return nil
	}
	return &value
}

func (p *Processor) heartbeat(ctx context.Context, status string) error {
	meta, _ := json.Marshal(map[string]any{"advisory_only": true})
	_, err := p.db.Exec(ctx, `INSERT INTO intelligence.engine_heartbeats(engine_key,status,version,metadata,last_seen_at) VALUES('sapienworx-intelligence',$1,$2,$3,now()) ON CONFLICT(engine_key) DO UPDATE SET status=EXCLUDED.status,version=EXCLUDED.version,metadata=EXCLUDED.metadata,last_seen_at=now()`, status, Version, meta)
	return err
}

func (p *Processor) normalizeSkills(ctx context.Context, values []string) ([]string, error) {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		key := strings.ToLower(strings.TrimSpace(value))
		if key == "" {
			continue
		}
		var canonical string
		err := p.db.QueryRow(ctx, `
			SELECT s.normalized_name
			FROM intelligence.skills s
			LEFT JOIN intelligence.skill_aliases a ON a.skill_id=s.id
			WHERE s.normalized_name=$1 OR a.alias=$1
			ORDER BY CASE WHEN s.normalized_name=$1 THEN 0 ELSE 1 END
			LIMIT 1`, key).Scan(&canonical)
		if errors.Is(err, pgx.ErrNoRows) {
			canonical = key
		} else if err != nil {
			return nil, err
		}
		if !seen[canonical] {
			seen[canonical] = true
			out = append(out, canonical)
		}
	}
	sort.Strings(out)
	return out, nil
}

func extractSkillNames(items []any) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		switch typed := item.(type) {
		case string:
			out = append(out, typed)
		case map[string]any:
			if name, ok := typed["name"].(string); ok {
				out = append(out, name)
			}
		}
	}
	return out
}

func minimizeEmployment(items []any) []any {
	out := make([]any, 0, len(items))
	for _, item := range items {
		record, ok := item.(map[string]any)
		if !ok {
			continue
		}
		clean := map[string]any{}
		for _, key := range []string{"job_title", "employment_type", "joining_year", "joining_month", "end_year", "end_month", "current_company", "skills_used"} {
			if value, ok := record[key]; ok {
				if text, ok := value.(string); ok && strings.TrimSpace(text) != "" {
					clean[key] = truncate(strings.TrimSpace(text), 240)
				}
			}
		}
		if len(clean) > 0 {
			out = append(out, clean)
		}
		if len(out) >= 20 {
			break
		}
	}
	return out
}

func minimizeEducation(items []any) []any {
	out := make([]any, 0, len(items))
	for _, item := range items {
		record, ok := item.(map[string]any)
		if !ok {
			continue
		}
		clean := map[string]any{}
		for _, key := range []string{"level", "specialization", "course_type", "start_year", "end_year"} {
			if value, ok := record[key]; ok {
				if text, ok := value.(string); ok && strings.TrimSpace(text) != "" {
					clean[key] = truncate(strings.TrimSpace(text), 160)
				}
			}
		}
		if len(clean) > 0 {
			out = append(out, clean)
		}
		if len(out) >= 12 {
			break
		}
	}
	return out
}

func splitProfessionalDomains(value string) []string {
	seen := map[string]bool{}
	out := make([]string, 0)
	for _, item := range strings.FieldsFunc(value, func(r rune) bool { return r == ',' || r == ';' || r == '|' || r == '\n' }) {
		item = strings.ToLower(strings.TrimSpace(item))
		if item != "" && len(item) <= 100 && !seen[item] {
			seen[item] = true
			out = append(out, item)
		}
		if len(out) >= 20 {
			break
		}
	}
	sort.Strings(out)
	return out
}

func seniorityFromMonths(months int) string {
	switch {
	case months < 24:
		return "entry"
	case months < 48:
		return "junior"
	case months < 84:
		return "mid"
	case months < 132:
		return "senior"
	case months < 180:
		return "lead"
	default:
		return "executive"
	}
}

func normalizeRoleFamily(title, category string) string {
	value := strings.ToLower(strings.TrimSpace(category))
	if value == "" {
		value = strings.ToLower(strings.TrimSpace(title))
	}
	return value
}

func skillOverlap(candidate, required []string) (float64, []string) {
	if len(required) == 0 {
		return 1, nil
	}
	set := map[string]bool{}
	for _, s := range candidate {
		set[s] = true
	}
	matched := make([]string, 0)
	for _, s := range required {
		if set[s] {
			matched = append(matched, s)
		}
	}
	return float64(len(matched)) / float64(len(required)), matched
}

func experienceFit(months, min int, max *int) float64 {
	if months < min {
		if min == 0 {
			return 1
		}
		return math.Max(0, float64(months)/float64(min))
	}
	if max == nil || months <= *max {
		return 1
	}
	over := months - *max
	return math.Max(0.4, 1-float64(over)/120)
}

func locationFit(c candidateFeature, j jobFeature) float64 {
	if j.WorkMode == "remote" {
		return 1
	}
	if c.Country != nil && j.Country != nil && *c.Country != *j.Country {
		return 0
	}
	if c.City != nil && j.City != nil && strings.EqualFold(*c.City, *j.City) {
		return 1
	}
	if c.State != nil && j.State != nil && strings.EqualFold(*c.State, *j.State) {
		return 0.8
	}
	return 0.55
}

func availabilityFit(notice *int) float64 {
	if notice == nil {
		return 0.5
	}
	switch {
	case *notice <= 15:
		return 1
	case *notice <= 30:
		return 0.9
	case *notice <= 60:
		return 0.7
	case *notice <= 90:
		return 0.5
	default:
		return 0.35
	}
}

func lexicalRelevance(headline, title string) float64 {
	a := tokenSet(headline)
	b := tokenSet(title)
	if len(a) == 0 || len(b) == 0 {
		return 0.5
	}
	shared := 0
	for token := range b {
		if a[token] {
			shared++
		}
	}
	return math.Min(1, 0.4+float64(shared)/float64(len(b))*0.6)
}

func tokenSet(value string) map[string]bool {
	out := map[string]bool{}
	for _, token := range strings.FieldsFunc(strings.ToLower(value), func(r rune) bool {
		return !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9')
	}) {
		if len(token) >= 2 {
			out[token] = true
		}
	}
	return out
}

func truncate(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return value[:max]
}

func (p *Processor) EvaluateCandidateModels(ctx context.Context) error {
	rows, err := p.db.Query(ctx, `SELECT id FROM intelligence.model_versions WHERE engine_type='matching' AND status IN ('candidate','evaluating')`)
	if err != nil {
		return err
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return err
		}
		ids = append(ids, id)
	}
	for _, id := range ids {
		if err := p.evaluateMatchingModel(ctx, id); err != nil {
			return err
		}
	}
	return nil
}

func (p *Processor) evaluateMatchingModel(ctx context.Context, modelID string) error {
	var raw []byte
	if err := p.db.QueryRow(ctx, `SELECT config FROM intelligence.model_versions WHERE id=$1 AND engine_type='matching'`, modelID).Scan(&raw); err != nil {
		return err
	}
	var config map[string]any
	_ = json.Unmarshal(raw, &config)
	rows, err := p.db.Query(ctx, `SELECT DISTINCT candidate_id,job_id FROM intelligence.feedback_events WHERE candidate_id IS NOT NULL AND job_id IS NOT NULL AND label IS NOT NULL ORDER BY candidate_id,job_id LIMIT 2000`)
	if err != nil {
		return err
	}
	type pair struct{ candidateID, jobID string }
	pairs := make([]pair, 0)
	for rows.Next() {
		var item pair
		if err := rows.Scan(&item.candidateID, &item.jobID); err != nil {
			rows.Close()
			return err
		}
		pairs = append(pairs, item)
	}
	rows.Close()
	for _, item := range pairs {
		candidate, err := p.loadCandidateFeature(ctx, item.candidateID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue
			}
			return err
		}
		job, err := p.loadJobFeature(ctx, item.jobID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue
			}
			return err
		}
		if err := p.storeMatchForModel(ctx, candidate, job, modelID, config); err != nil {
			return err
		}
	}
	var positives, total int
	var avgPositive, avgNegative float64
	err = p.db.QueryRow(ctx, `
		SELECT count(*) FILTER(WHERE f.label>0.5),count(*),
		  COALESCE(avg(m.score) FILTER(WHERE f.label>0.5),0),
		  COALESCE(avg(m.score) FILTER(WHERE f.label<=0),0)
		FROM intelligence.feedback_events f
		JOIN intelligence.match_results m ON m.candidate_id=f.candidate_id AND m.job_id=f.job_id AND m.model_version_id=$1
		WHERE f.candidate_id IS NOT NULL AND f.job_id IS NOT NULL AND f.label IS NOT NULL`, modelID).Scan(&positives, &total, &avgPositive, &avgNegative)
	if err != nil {
		return err
	}
	gate := "insufficient_data"
	if total >= 25 {
		gate = "failed"
		if positives >= 5 && avgPositive >= avgNegative+10 {
			gate = "passed"
		}
	}
	metrics := map[string]any{
		"labeled_events": total, "positive_events": positives,
		"avg_score_positive": avgPositive, "avg_score_non_positive": avgNegative,
		"quality_metric": "observed_feedback_separation",
		"minimum_labels": 25, "minimum_positive_labels": 5,
		"fairness_evaluation":  "requires separately approved non-sensitive cohort dataset",
		"privacy_review":       "candidate/job identifiers and outcome labels only",
		"autonomous_promotion": false,
	}
	metricsRaw, _ := json.Marshal(metrics)
	if _, err = p.db.Exec(ctx, `INSERT INTO intelligence.evaluations(model_version_id,metrics,quality_gate_status,completed_at,notes) VALUES($1,$2,$3,now(),$4)`, modelID, metricsRaw, gate, "Observed outcome evaluation. Promotion additionally requires independent admin approval."); err != nil {
		return err
	}
	_, err = p.db.Exec(ctx, `UPDATE intelligence.model_versions SET status=CASE WHEN $2='passed' THEN 'approved' ELSE 'evaluating' END WHERE id=$1 AND status IN ('candidate','evaluating','approved')`, modelID, gate)
	return err
}

func (p *Processor) Summary(ctx context.Context) (map[string]any, error) {
	var pending, failed, candidates, jobs, matches, feedback int64
	if err := p.db.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM intelligence.events WHERE status='pending'),
		(SELECT count(*) FROM intelligence.events WHERE status='failed'),
		(SELECT count(*) FROM intelligence.candidate_features),
		(SELECT count(*) FROM intelligence.job_features),
		(SELECT count(*) FROM intelligence.match_results),
		(SELECT count(*) FROM intelligence.feedback_events)`).Scan(&pending, &failed, &candidates, &jobs, &matches, &feedback); err != nil {
		return nil, err
	}
	return map[string]any{"pending_events": pending, "failed_events": failed, "candidate_features": candidates, "job_features": jobs, "match_results": matches, "feedback_events": feedback}, nil
}

func (p *Processor) String() string {
	return fmt.Sprintf("SapienWorx Intelligence %s", Version)
}

func (p *Processor) runPlatformAnalysis(ctx context.Context, event eventRecord) error {
	var requestedBy string
	if value, ok := event.Payload["requested_by"].(string); ok {
		requestedBy = value
	}
	if requestedBy == "" {
		return errors.New("platform analysis request missing requested_by")
	}
	var snap intelligence.Snapshot
	if err := p.db.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM jobs WHERE status='active'),
		(SELECT count(*) FROM applications WHERE applied_at>=now()-interval '30 days'),
		(SELECT count(*) FROM interviews WHERE scheduled_at>=now()-interval '30 days'),
		(SELECT count(*) FROM applications WHERE stage='hired' AND updated_at>=now()-interval '90 days'),
		(SELECT count(*) FROM admin_telemetry_events WHERE category='cv_parser' AND occurred_at>=now()-interval '24 hours'),
		(SELECT count(*) FROM admin_telemetry_events WHERE category='cv_parser' AND occurred_at>=now()-interval '24 hours' AND status IN ('failed','degraded')),
		(SELECT count(*) FROM admin_alerts WHERE severity='critical' AND status IN ('open','acknowledged')),
		(SELECT count(*) FROM privacy_requests WHERE status IN ('received','in_progress','awaiting_review')),
		(SELECT count(*) FROM admin_approval_requests WHERE status='pending' AND (expires_at IS NULL OR expires_at>now()))`).Scan(
		&snap.ActiveJobs, &snap.Applications30d, &snap.Interviews30d, &snap.Hires90d, &snap.ParserEvents24h, &snap.ParserFailures24h, &snap.CriticalAlerts, &snap.PendingPrivacyRequests, &snap.PendingApprovals); err != nil {
		return err
	}
	raw, _ := json.Marshal(snap)
	var runID string
	if err := p.db.QueryRow(ctx, `INSERT INTO intelligence_runs(engine_version,metrics,requested_by) VALUES($1,$2,$3) RETURNING id`, intelligence.EngineVersion, raw, requestedBy).Scan(&runID); err != nil {
		return err
	}
	for _, insight := range intelligence.Analyze(snap) {
		evidence, _ := json.Marshal(insight.Evidence)
		if _, err := p.db.Exec(ctx, `INSERT INTO intelligence_insights(run_id,domain,insight_key,severity,title,rationale,evidence,recommendation,confidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			runID, insight.Domain, insight.Key, insight.Severity, insight.Title, insight.Rationale, evidence, insight.Recommendation, insight.Confidence); err != nil {
			return err
		}
	}
	meta, _ := json.Marshal(map[string]any{"source_event_id": event.ID, "engine_version": intelligence.EngineVersion})
	_, err := p.db.Exec(ctx, `INSERT INTO intelligence.audit_events(actor_id,event_type,target_type,target_id,metadata) VALUES($1,'platform.analysis.completed','intelligence_run',$2,$3)`, requestedBy, runID, meta)
	return err
}
