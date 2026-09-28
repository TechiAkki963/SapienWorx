package admin

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type IntelligenceRunRecord struct {
	ID            string         `json:"id"`
	EngineVersion string         `json:"engine_version"`
	Status        string         `json:"status"`
	Metrics       map[string]any `json:"metrics"`
	RequestedBy   string         `json:"requested_by"`
	StartedAt     time.Time      `json:"started_at"`
	CompletedAt   time.Time      `json:"completed_at"`
}

type IntelligenceInsightRecord struct {
	ID             string         `json:"id"`
	RunID          string         `json:"run_id"`
	Domain         string         `json:"domain"`
	InsightKey     string         `json:"insight_key"`
	Severity       string         `json:"severity"`
	Title          string         `json:"title"`
	Rationale      string         `json:"rationale"`
	Evidence       map[string]any `json:"evidence"`
	Recommendation string         `json:"recommendation"`
	Confidence     float64        `json:"confidence"`
	Status         string         `json:"status"`
	ReviewedBy     *string        `json:"reviewed_by,omitempty"`
	ReviewedAt     *time.Time     `json:"reviewed_at,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
}

type IntelligenceModelRecord struct {
	ID          string         `json:"id"`
	EngineType  string         `json:"engine_type"`
	Version     string         `json:"version"`
	Provider    string         `json:"provider"`
	ModelRef    string         `json:"model_ref"`
	Config      map[string]any `json:"config"`
	Status      string         `json:"status"`
	ApprovalID  *string        `json:"approval_id,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	ActivatedAt *time.Time     `json:"activated_at,omitempty"`
}

type IntelligenceEvaluationRecord struct {
	ID                string         `json:"id"`
	ModelVersionID    string         `json:"model_version_id"`
	DatasetRef         string         `json:"dataset_ref"`
	Metrics            map[string]any `json:"metrics"`
	QualityGateStatus  string         `json:"quality_gate_status"`
	StartedAt          time.Time      `json:"started_at"`
	CompletedAt        *time.Time     `json:"completed_at,omitempty"`
	Notes              string         `json:"notes"`
}

type IntelligenceSwitchRecord struct {
	Key                      string     `json:"key"`
	Enabled                  bool       `json:"enabled"`
	RequiresApprovalToEnable bool       `json:"requires_approval_to_enable"`
	Description              string     `json:"description"`
	ChangedBy                *string    `json:"changed_by,omitempty"`
	ApprovalID               *string    `json:"approval_id,omitempty"`
	ChangedAt                time.Time  `json:"changed_at"`
}

type IntelligencePromptRecord struct {
	ID             string     `json:"id"`
	PromptKey      string     `json:"prompt_key"`
	Version        int        `json:"version"`
	Template       string     `json:"template"`
	Variables      []string   `json:"variables"`
	Status         string     `json:"status"`
	ModelVersionID *string    `json:"model_version_id,omitempty"`
	CreatedBy      *string    `json:"created_by,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type IntelligenceHeartbeatRecord struct {
	EngineKey  string         `json:"engine_key"`
	Status     string         `json:"status"`
	Version    string         `json:"version"`
	Metadata   map[string]any `json:"metadata"`
	LastSeenAt time.Time      `json:"last_seen_at"`
}

type IntelligenceGatewayMetrics struct {
	Requests24h       int64   `json:"requests_24h"`
	Failures24h       int64   `json:"failures_24h"`
	Blocked24h        int64   `json:"blocked_24h"`
	EstimatedCost24h  float64 `json:"estimated_cost_24h"`
	AvgLatencyMS24h   float64 `json:"avg_latency_ms_24h"`
	Redactions24h     int64   `json:"redactions_24h"`
}

type IntelligenceStoreMetrics struct {
	PendingEvents     int64 `json:"pending_events"`
	FailedEvents      int64 `json:"failed_events"`
	CandidateFeatures int64 `json:"candidate_features"`
	JobFeatures       int64 `json:"job_features"`
	MatchResults      int64 `json:"match_results"`
	FeedbackEvents    int64 `json:"feedback_events"`
}

type IntelligenceDashboard struct {
	Runs           []IntelligenceRunRecord        `json:"runs"`
	Insights       []IntelligenceInsightRecord    `json:"insights"`
	Models         []IntelligenceModelRecord      `json:"models"`
	Evaluations    []IntelligenceEvaluationRecord `json:"evaluations"`
	Switches       []IntelligenceSwitchRecord     `json:"switches"`
	Heartbeats     []IntelligenceHeartbeatRecord  `json:"heartbeats"`
	Prompts        []IntelligencePromptRecord     `json:"prompts"`
	Gateway        IntelligenceGatewayMetrics     `json:"gateway"`
	Store          IntelligenceStoreMetrics       `json:"store"`
	ComputedAt     time.Time                      `json:"computed_at"`
	AdvisoryOnly   bool                           `json:"advisory_only"`
}

type IntelligenceQueueResult struct {
	EventID string `json:"event_id"`
	Status  string `json:"status"`
}

func (s *Service) RunIntelligence(ctx context.Context, actor, ip, requestID string) (IntelligenceQueueResult, error) {
	if !validResourceID(actor) {
		return IntelligenceQueueResult{}, ErrInvalid
	}
	payload, _ := json.Marshal(map[string]any{"requested_by": actor})
	var eventID string
	err := s.db.QueryRow(ctx, `SELECT intelligence.enqueue_event('platform.analysis.requested','platform',NULL,$1)`, payload).Scan(&eventID)
	if err != nil {
		return IntelligenceQueueResult{}, err
	}
	_ = s.Audit(ctx, AuditInput{AdminID: &actor, ActionType: "intelligence.analysis_requested", TargetEntityType: "intelligence_event", IPAddress: ip, RequestID: requestID, Metadata: map[string]any{"event_id": eventID, "processing_plane": "sapienworx-intelligence"}})
	return IntelligenceQueueResult{EventID: eventID, Status: "queued"}, nil
}

func (s *Service) Intelligence(ctx context.Context) (IntelligenceDashboard, error) {
	out := IntelligenceDashboard{
		ComputedAt: s.now().UTC(), AdvisoryOnly: true,
		Runs: []IntelligenceRunRecord{}, Insights: []IntelligenceInsightRecord{}, Models: []IntelligenceModelRecord{},
		Evaluations: []IntelligenceEvaluationRecord{}, Switches: []IntelligenceSwitchRecord{}, Heartbeats: []IntelligenceHeartbeatRecord{}, Prompts: []IntelligencePromptRecord{},
	}
	rows, err := s.db.Query(ctx, `SELECT id,engine_version,status,metrics,requested_by,started_at,completed_at FROM intelligence_runs ORDER BY completed_at DESC LIMIT 20`)
	if err != nil { return out, err }
	for rows.Next() {
		var v IntelligenceRunRecord
		var raw []byte
		if err = rows.Scan(&v.ID,&v.EngineVersion,&v.Status,&raw,&v.RequestedBy,&v.StartedAt,&v.CompletedAt); err != nil { rows.Close(); return out, err }
		_ = json.Unmarshal(raw,&v.Metrics); out.Runs=append(out.Runs,v)
	}
	if err=rows.Err();err!=nil{rows.Close();return out,err};rows.Close()

	rows,err=s.db.Query(ctx,`SELECT id,run_id,domain,insight_key,severity,title,rationale,evidence,recommendation,confidence::float8,status,reviewed_by,reviewed_at,created_at FROM intelligence_insights ORDER BY created_at DESC LIMIT 100`)
	if err!=nil{return out,err}
	for rows.Next(){var v IntelligenceInsightRecord;var raw []byte;if err=rows.Scan(&v.ID,&v.RunID,&v.Domain,&v.InsightKey,&v.Severity,&v.Title,&v.Rationale,&raw,&v.Recommendation,&v.Confidence,&v.Status,&v.ReviewedBy,&v.ReviewedAt,&v.CreatedAt);err!=nil{rows.Close();return out,err};_ = json.Unmarshal(raw,&v.Evidence);out.Insights=append(out.Insights,v)}
	if err=rows.Err();err!=nil{rows.Close();return out,err};rows.Close()

	rows,err=s.db.Query(ctx,`SELECT id,engine_type,version,provider,model_ref,config,status,approval_id,created_at,activated_at FROM intelligence.model_versions ORDER BY engine_type,created_at DESC LIMIT 100`)
	if err!=nil{return out,err}
	for rows.Next(){var v IntelligenceModelRecord;var raw []byte;if err=rows.Scan(&v.ID,&v.EngineType,&v.Version,&v.Provider,&v.ModelRef,&raw,&v.Status,&v.ApprovalID,&v.CreatedAt,&v.ActivatedAt);err!=nil{rows.Close();return out,err};_ = json.Unmarshal(raw,&v.Config);out.Models=append(out.Models,v)}
	if err=rows.Err();err!=nil{rows.Close();return out,err};rows.Close()

	rows,err=s.db.Query(ctx,`SELECT id,model_version_id,dataset_ref,metrics,quality_gate_status,started_at,completed_at,notes FROM intelligence.evaluations ORDER BY started_at DESC LIMIT 100`)
	if err!=nil{return out,err}
	for rows.Next(){var v IntelligenceEvaluationRecord;var raw []byte;if err=rows.Scan(&v.ID,&v.ModelVersionID,&v.DatasetRef,&raw,&v.QualityGateStatus,&v.StartedAt,&v.CompletedAt,&v.Notes);err!=nil{rows.Close();return out,err};_ = json.Unmarshal(raw,&v.Metrics);out.Evaluations=append(out.Evaluations,v)}
	if err=rows.Err();err!=nil{rows.Close();return out,err};rows.Close()

	rows,err=s.db.Query(ctx,`SELECT switch_key,enabled,requires_approval_to_enable,description,changed_by,approval_id,changed_at FROM intelligence.engine_switches ORDER BY switch_key`)
	if err!=nil{return out,err}
	for rows.Next(){var v IntelligenceSwitchRecord;if err=rows.Scan(&v.Key,&v.Enabled,&v.RequiresApprovalToEnable,&v.Description,&v.ChangedBy,&v.ApprovalID,&v.ChangedAt);err!=nil{rows.Close();return out,err};out.Switches=append(out.Switches,v)}
	if err=rows.Err();err!=nil{rows.Close();return out,err};rows.Close()

	rows,err=s.db.Query(ctx,`SELECT engine_key,status,version,metadata,last_seen_at FROM intelligence.engine_heartbeats ORDER BY engine_key`)
	if err!=nil{return out,err}
	for rows.Next(){var v IntelligenceHeartbeatRecord;var raw []byte;if err=rows.Scan(&v.EngineKey,&v.Status,&v.Version,&raw,&v.LastSeenAt);err!=nil{rows.Close();return out,err};_ = json.Unmarshal(raw,&v.Metadata);out.Heartbeats=append(out.Heartbeats,v)}
	if err=rows.Err();err!=nil{rows.Close();return out,err};rows.Close()

	rows,err=s.db.Query(ctx,`SELECT id,prompt_key,version,template,variables,status,model_version_id,created_by,created_at FROM intelligence.prompts ORDER BY prompt_key,version DESC LIMIT 100`)
	if err!=nil{return out,err}
	for rows.Next(){var v IntelligencePromptRecord;if err=rows.Scan(&v.ID,&v.PromptKey,&v.Version,&v.Template,&v.Variables,&v.Status,&v.ModelVersionID,&v.CreatedBy,&v.CreatedAt);err!=nil{rows.Close();return out,err};out.Prompts=append(out.Prompts,v)}
	if err=rows.Err();err!=nil{rows.Close();return out,err};rows.Close()

	err=s.db.QueryRow(ctx,`SELECT count(*),count(*) FILTER(WHERE status='failed'),count(*) FILTER(WHERE status='blocked'),COALESCE(sum(estimated_cost),0)::float8,COALESCE(avg(latency_ms),0)::float8,COALESCE(sum(redaction_count),0) FROM intelligence.gateway_requests WHERE occurred_at>=now()-interval '24 hours'`).Scan(&out.Gateway.Requests24h,&out.Gateway.Failures24h,&out.Gateway.Blocked24h,&out.Gateway.EstimatedCost24h,&out.Gateway.AvgLatencyMS24h,&out.Gateway.Redactions24h)
	if err!=nil{return out,err}
	err=s.db.QueryRow(ctx,`SELECT
		(SELECT count(*) FROM intelligence.events WHERE status='pending'),
		(SELECT count(*) FROM intelligence.events WHERE status='failed'),
		(SELECT count(*) FROM intelligence.candidate_features),
		(SELECT count(*) FROM intelligence.job_features),
		(SELECT count(*) FROM intelligence.match_results),
		(SELECT count(*) FROM intelligence.feedback_events)`).Scan(&out.Store.PendingEvents,&out.Store.FailedEvents,&out.Store.CandidateFeatures,&out.Store.JobFeatures,&out.Store.MatchResults,&out.Store.FeedbackEvents)
	return out,err
}

func (s *Service) ReviewIntelligenceInsight(ctx context.Context,id,actor,status,outcome,note,ip,requestID string) error {
	id=strings.TrimSpace(id);status=strings.ToLower(strings.TrimSpace(status));outcome=strings.ToLower(strings.TrimSpace(outcome));note=strings.TrimSpace(note)
	if !validResourceID(id)||!validResourceID(actor)||!map[string]bool{"reviewed":true,"dismissed":true,"actioned":true}[status]||!map[string]bool{"accepted":true,"rejected":true,"needs_more_data":true}[outcome]||len(note)>2000{return ErrInvalid}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return err};defer tx.Rollback(ctx)
	tag,err:=tx.Exec(ctx,`UPDATE intelligence_insights SET status=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$1`,id,status,actor);if err!=nil{return err};if tag.RowsAffected()==0{return ErrNotFound}
	if _,err=tx.Exec(ctx,`INSERT INTO intelligence_feedback(insight_id,admin_id,outcome,note) VALUES($1,$2,$3,$4)`,id,actor,outcome,note);err!=nil{return err}
	target:=id;if err=insertAuditTx(ctx,tx,AuditInput{AdminID:&actor,ActionType:"intelligence.insight_reviewed",TargetEntityType:"intelligence_insight",TargetEntityID:&target,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"status":status,"outcome":outcome,"advisory_only":true}});err!=nil{return err}
	return tx.Commit(ctx)
}

func (s *Service) UpdateIntelligenceSwitch(ctx context.Context,key,actor string,enabled bool,approvalID,ip,requestID string) error {
	key=strings.ToLower(strings.TrimSpace(key));approvalID=strings.TrimSpace(approvalID)
	if !validResourceID(actor)||len(key)<3||len(key)>100{return ErrInvalid}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return err};defer tx.Rollback(ctx)
	var current,requires bool
	if err=tx.QueryRow(ctx,`SELECT enabled,requires_approval_to_enable FROM intelligence.engine_switches WHERE switch_key=$1 FOR UPDATE`,key).Scan(&current,&requires);errors.Is(err,pgx.ErrNoRows){return ErrNotFound}else if err!=nil{return err}
	var approval any
	if enabled&&!current&&requires {
		if !validResourceID(approvalID){return ErrInvalid}
		var status,action,targetType,reference string
		if err=tx.QueryRow(ctx,`SELECT status,action_type,target_type,approval_reference FROM admin_approval_requests WHERE id=$1`,approvalID).Scan(&status,&action,&targetType,&reference);err!=nil{return err}
		if status!="approved"||action!="intelligence.switch.enable"||targetType!="intelligence_switch"||reference!="switch:"+key{return ErrConflict}
		approval=approvalID
	}
	if _,err=tx.Exec(ctx,`UPDATE intelligence.engine_switches SET enabled=$2,changed_by=$3,approval_id=$4,changed_at=now() WHERE switch_key=$1`,key,enabled,actor,approval);err!=nil{return err}
	meta,_:=json.Marshal(map[string]any{"switch_key":key,"enabled":enabled,"previous":current,"approval_id":approvalID})
	if _,err=tx.Exec(ctx,`INSERT INTO intelligence.audit_events(actor_id,event_type,target_type,metadata) VALUES($1,'intelligence.switch.changed','engine_switch',$2)`,actor,meta);err!=nil{return err}
	return tx.Commit(ctx)
}

func (s *Service) RegisterIntelligenceModel(ctx context.Context,actor,engineType,version,provider,modelRef string,config map[string]any,ip,requestID string)(IntelligenceModelRecord,error){
	engineType=strings.ToLower(strings.TrimSpace(engineType));version=strings.TrimSpace(version);provider=strings.TrimSpace(provider);modelRef=strings.TrimSpace(modelRef)
	if !validResourceID(actor)||!map[string]bool{"candidate_intelligence":true,"matching":true,"resume_parser":true,"recommendation":true,"evaluation":true,"platform_intelligence":true,"ai_gateway":true}[engineType]||len(version)<1||len(version)>80||len(provider)<1||len(provider)>80||len(modelRef)<1||len(modelRef)>200{return IntelligenceModelRecord{},ErrInvalid}
	raw,err:=json.Marshal(config);if err!=nil{return IntelligenceModelRecord{},ErrInvalid}
	var out IntelligenceModelRecord;var stored []byte
	err=s.db.QueryRow(ctx,`INSERT INTO intelligence.model_versions(engine_type,version,provider,model_ref,config,status,created_by) VALUES($1,$2,$3,$4,$5,'candidate',$6) RETURNING id,engine_type,version,provider,model_ref,config,status,approval_id,created_at,activated_at`,engineType,version,provider,modelRef,raw,actor).Scan(&out.ID,&out.EngineType,&out.Version,&out.Provider,&out.ModelRef,&stored,&out.Status,&out.ApprovalID,&out.CreatedAt,&out.ActivatedAt)
	if err!=nil{return IntelligenceModelRecord{},err};_ = json.Unmarshal(stored,&out.Config)
	_ = s.Audit(ctx,AuditInput{AdminID:&actor,ActionType:"intelligence.model.registered",TargetEntityType:"intelligence_model",TargetEntityID:&out.ID,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"engine_type":engineType,"version":version,"provider":provider}})
	return out,nil
}

func (s *Service) RequestModelEvaluation(ctx context.Context,modelID,actor,ip,requestID string) error {
	if !validResourceID(modelID)||!validResourceID(actor){return ErrInvalid}
	tag,err:=s.db.Exec(ctx,`UPDATE intelligence.model_versions SET status='evaluating' WHERE id=$1 AND status IN ('candidate','evaluating')`,modelID);if err!=nil{return err};if tag.RowsAffected()==0{return ErrConflict}
	return s.Audit(ctx,AuditInput{AdminID:&actor,ActionType:"intelligence.model.evaluation_requested",TargetEntityType:"intelligence_model",TargetEntityID:&modelID,IPAddress:ip,RequestID:requestID})
}

func (s *Service) PromoteIntelligenceModel(ctx context.Context,modelID,actor,approvalID,ip,requestID string) error {
	if !validResourceID(modelID)||!validResourceID(actor)||!validResourceID(approvalID){return ErrInvalid}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return err};defer tx.Rollback(ctx)
	var engineType,status string
	if err=tx.QueryRow(ctx,`SELECT engine_type,status FROM intelligence.model_versions WHERE id=$1 FOR UPDATE`,modelID).Scan(&engineType,&status);errors.Is(err,pgx.ErrNoRows){return ErrNotFound}else if err!=nil{return err}
	if status!="candidate"&&status!="evaluating"&&status!="approved"{return ErrConflict}
	var passed bool
	if err=tx.QueryRow(ctx,`SELECT EXISTS(SELECT 1 FROM intelligence.evaluations WHERE model_version_id=$1 AND quality_gate_status='passed')`,modelID).Scan(&passed);err!=nil{return err};if !passed{return ErrConflict}
	var approvalStatus,action,targetType string;var targetID *string
	if err=tx.QueryRow(ctx,`SELECT status,action_type,target_type,target_id FROM admin_approval_requests WHERE id=$1`,approvalID).Scan(&approvalStatus,&action,&targetType,&targetID);err!=nil{return err}
	if approvalStatus!="approved"||action!="intelligence.model.promote"||targetType!="intelligence_model"||targetID==nil||*targetID!=modelID{return ErrConflict}
	if _,err=tx.Exec(ctx,`UPDATE intelligence.model_versions SET status='retired' WHERE engine_type=$1 AND status='production' AND id<>$2`,engineType,modelID);err!=nil{return err}
	if _,err=tx.Exec(ctx,`UPDATE intelligence.model_versions SET status='production',approval_id=$2,activated_at=now() WHERE id=$1`,modelID,approvalID);err!=nil{return err}
	meta,_:=json.Marshal(map[string]any{"engine_type":engineType,"approval_id":approvalID})
	if _,err=tx.Exec(ctx,`INSERT INTO intelligence.audit_events(actor_id,event_type,target_type,target_id,metadata) VALUES($1,'intelligence.model.promoted','intelligence_model',$2,$3)`,actor,modelID,meta);err!=nil{return err}
	return tx.Commit(ctx)
}


func (s *Service) RegisterIntelligencePrompt(ctx context.Context,actor,promptKey,template,status string,variables []string,modelVersionID,ip,requestID string)(IntelligencePromptRecord,error){
	promptKey=strings.ToLower(strings.TrimSpace(promptKey));template=strings.TrimSpace(template);status=strings.ToLower(strings.TrimSpace(status));modelVersionID=strings.TrimSpace(modelVersionID)
	if !validResourceID(actor)||len(promptKey)<3||len(promptKey)>100||len(template)<1||len(template)>20000||!map[string]bool{"draft":true,"active":true,"retired":true}[status]{return IntelligencePromptRecord{},ErrInvalid}
	if modelVersionID!=""&&!validResourceID(modelVersionID){return IntelligencePromptRecord{},ErrInvalid}
	cleanVars:=make([]string,0,len(variables));seen:=map[string]bool{}
	for _,v:=range variables{v=strings.TrimSpace(v);if v!=""&&len(v)<=80&&!seen[v]{seen[v]=true;cleanVars=append(cleanVars,v)}}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return IntelligencePromptRecord{},err};defer tx.Rollback(ctx)
	var version int
	if err=tx.QueryRow(ctx,`SELECT COALESCE(max(version),0)+1 FROM intelligence.prompts WHERE prompt_key=$1`,promptKey).Scan(&version);err!=nil{return IntelligencePromptRecord{},err}
	if status=="active"{if _,err=tx.Exec(ctx,`UPDATE intelligence.prompts SET status='retired' WHERE prompt_key=$1 AND status='active'`,promptKey);err!=nil{return IntelligencePromptRecord{},err}}
	var model any;if modelVersionID!=""{model=modelVersionID}
	var out IntelligencePromptRecord
	err=tx.QueryRow(ctx,`INSERT INTO intelligence.prompts(prompt_key,version,template,variables,status,model_version_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,prompt_key,version,template,variables,status,model_version_id,created_by,created_at`,promptKey,version,template,cleanVars,status,model,actor).Scan(&out.ID,&out.PromptKey,&out.Version,&out.Template,&out.Variables,&out.Status,&out.ModelVersionID,&out.CreatedBy,&out.CreatedAt)
	if err!=nil{return IntelligencePromptRecord{},err}
	meta,_:=json.Marshal(map[string]any{"prompt_key":promptKey,"version":version,"status":status})
	if _,err=tx.Exec(ctx,`INSERT INTO intelligence.audit_events(actor_id,event_type,target_type,target_id,metadata) VALUES($1,'intelligence.prompt.registered','prompt',$2,$3)`,actor,out.ID,meta);err!=nil{return IntelligencePromptRecord{},err}
	if err=tx.Commit(ctx);err!=nil{return IntelligencePromptRecord{},err}
	_ = s.Audit(ctx,AuditInput{AdminID:&actor,ActionType:"intelligence.prompt.registered",TargetEntityType:"intelligence_prompt",TargetEntityID:&out.ID,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"prompt_key":promptKey,"version":version,"status":status}})
	return out,nil
}
