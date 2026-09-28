package admin

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type ControlPlaneSummary struct {
	PendingApprovals int64 `json:"pending_approvals"`
	OpenCases int64 `json:"open_cases"`
	PendingOrganizationReviews int64 `json:"pending_organization_reviews"`
	FailedTelemetry24h int64 `json:"failed_telemetry_24h"`
	OpenAlerts int64 `json:"open_alerts"`
	DraftArticles int64 `json:"draft_articles"`
	PendingReleases int64 `json:"pending_releases"`
	Approvals []ApprovalRecord `json:"approvals"`
	Cases []CaseRecord `json:"cases"`
	OrganizationReviews []OrganizationGovernanceRecord `json:"organization_reviews"`
	Telemetry []TelemetryRecord `json:"telemetry"`
	Operations []OperationEvidenceRecord `json:"operations"`
	Costs []CostSnapshotRecord `json:"costs"`
	Knowledge []KnowledgeArticleRecord `json:"knowledge"`
	Settings []OperationalSettingRecord `json:"settings"`
	Releases []ReleaseAcceptanceRecord `json:"releases"`
	ComputedAt time.Time `json:"computed_at"`
}

type ApprovalRecord struct {
	ID string `json:"id"`
	ActionType string `json:"action_type"`
	TargetType string `json:"target_type"`
	TargetID *string `json:"target_id,omitempty"`
	RequestedBy string `json:"requested_by"`
	Reason string `json:"reason"`
	ApprovalReference string `json:"approval_reference"`
	RequiredApprovals int `json:"required_approvals"`
	Approvals int `json:"approvals"`
	Rejections int `json:"rejections"`
	Status string `json:"status"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type CaseRecord struct {
	ID string `json:"id"`
	CaseType string `json:"case_type"`
	SubjectType string `json:"subject_type"`
	SubjectID *string `json:"subject_id,omitempty"`
	Title string `json:"title"`
	Status string `json:"status"`
	Priority string `json:"priority"`
	AssignedTo *string `json:"assigned_to,omitempty"`
	OpenedBy string `json:"opened_by"`
	Summary string `json:"summary"`
	OpenedAt time.Time `json:"opened_at"`
	UpdatedAt time.Time `json:"updated_at"`
	ClosedAt *time.Time `json:"closed_at,omitempty"`
}

type OrganizationGovernanceRecord struct {
	ID string `json:"id"`
	CompanyID string `json:"company_id"`
	ReviewType string `json:"review_type"`
	Status string `json:"status"`
	RequestedBy string `json:"requested_by"`
	AssignedTo *string `json:"assigned_to,omitempty"`
	ApprovalID *string `json:"approval_id,omitempty"`
	SourceUserID *string `json:"source_user_id,omitempty"`
	TargetUserID *string `json:"target_user_id,omitempty"`
	DuplicateCompanyID *string `json:"duplicate_company_id,omitempty"`
	Reason string `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TelemetryRecord struct {
	ID int64 `json:"id"`
	Category string `json:"category"`
	Source string `json:"source"`
	Operation string `json:"operation"`
	Status string `json:"status"`
	LatencyMS *int `json:"latency_ms,omitempty"`
	RetryCount int `json:"retry_count"`
	BacklogCount *int `json:"backlog_count,omitempty"`
	ReferenceID *string `json:"reference_id,omitempty"`
	Metadata json.RawMessage `json:"metadata"`
	OccurredAt time.Time `json:"occurred_at"`
}

type OperationEvidenceRecord struct {
	ID string `json:"id"`
	EvidenceType string `json:"evidence_type"`
	Environment string `json:"environment"`
	Component string `json:"component"`
	Status string `json:"status"`
	Owner string `json:"owner"`
	Reference string `json:"reference"`
	Details json.RawMessage `json:"details"`
	ObservedAt time.Time `json:"observed_at"`
	CreatedAt time.Time `json:"created_at"`
}

type CostSnapshotRecord struct {
	ID string `json:"id"`
	Provider string `json:"provider"`
	Currency string `json:"currency"`
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd time.Time `json:"period_end"`
	ActualCost float64 `json:"actual_cost"`
	ForecastCost *float64 `json:"forecast_cost,omitempty"`
	BudgetAmount *float64 `json:"budget_amount,omitempty"`
	SourceReference string `json:"source_reference"`
	ObservedAt time.Time `json:"observed_at"`
}

type KnowledgeArticleRecord struct {
	ID string `json:"id"`
	Slug string `json:"slug"`
	Title string `json:"title"`
	Status string `json:"status"`
	CurrentRevision int `json:"current_revision"`
	UpdatedBy string `json:"updated_by"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
	UpdatedAt time.Time `json:"updated_at"`
}

type OperationalSettingRecord struct {
	Key string `json:"key"`
	Value json.RawMessage `json:"value"`
	Description string `json:"description"`
	HighRisk bool `json:"high_risk"`
	ApprovalID *string `json:"approval_id,omitempty"`
	UpdatedBy string `json:"updated_by"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ReleaseAcceptanceRecord struct {
	ID string `json:"id"`
	ReleaseReference string `json:"release_reference"`
	Environment string `json:"environment"`
	CommitSHA string `json:"commit_sha"`
	MigrationReference string `json:"migration_reference"`
	Status string `json:"status"`
	ApprovalID *string `json:"approval_id,omitempty"`
	BackupEvidenceID *string `json:"backup_evidence_id,omitempty"`
	RestoreTestEvidenceID *string `json:"restore_test_evidence_id,omitempty"`
	RequestedBy string `json:"requested_by"`
	AcceptedBy *string `json:"accepted_by,omitempty"`
	Notes string `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	AcceptedAt *time.Time `json:"accepted_at,omitempty"`
}

type CreateApprovalInput struct {
	ActionType string `json:"action_type"`
	TargetType string `json:"target_type"`
	TargetID string `json:"target_id"`
	Reason string `json:"reason"`
	ApprovalReference string `json:"approval_reference"`
	RequiredApprovals int `json:"required_approvals"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
}

type CreateCaseInput struct {
	CaseType string `json:"case_type"`
	SubjectType string `json:"subject_type"`
	SubjectID string `json:"subject_id"`
	Title string `json:"title"`
	Priority string `json:"priority"`
	Summary string `json:"summary"`
}

type CreateOrganizationGovernanceInput struct {
	CompanyID string `json:"company_id"`
	ReviewType string `json:"review_type"`
	AssignedTo string `json:"assigned_to"`
	SourceUserID string `json:"source_user_id"`
	TargetUserID string `json:"target_user_id"`
	DuplicateCompanyID string `json:"duplicate_company_id"`
	Reason string `json:"reason"`
	ApprovalReference string `json:"approval_reference"`
}

func (s *Service) ControlPlane(ctx context.Context) (ControlPlaneSummary, error) {
	ctx, cancel := context.WithTimeout(ctx, 7*time.Second)
	defer cancel()
	out := ControlPlaneSummary{ComputedAt: s.now().UTC()}
	if err := s.db.QueryRow(ctx, `SELECT
		(SELECT count(*) FROM admin_approval_requests WHERE status='pending' AND (expires_at IS NULL OR expires_at>now())),
		(SELECT count(*) FROM admin_cases WHERE status IN ('open','investigating','awaiting_review')),
		(SELECT count(*) FROM organization_governance_reviews WHERE status='pending'),
		(SELECT count(*) FROM admin_telemetry_events WHERE occurred_at>=now()-interval '24 hours' AND status IN ('failed','retrying','backlogged','degraded')),
		(SELECT count(*) FROM admin_operation_evidence WHERE evidence_type='alert' AND status IN ('warning','critical','failed','pending')),
		(SELECT count(*) FROM knowledge_articles WHERE status IN ('draft','in_review')),
		(SELECT count(*) FROM admin_release_acceptance WHERE status IN ('reviewing','approved_for_rollout','deployed'))`).Scan(
		&out.PendingApprovals, &out.OpenCases, &out.PendingOrganizationReviews, &out.FailedTelemetry24h, &out.OpenAlerts, &out.DraftArticles, &out.PendingReleases,
	); err != nil { return ControlPlaneSummary{}, err }

	var err error
	if out.Approvals, err = s.controlApprovals(ctx, 20); err != nil { return ControlPlaneSummary{}, err }
	if out.Cases, err = s.controlCases(ctx, 20); err != nil { return ControlPlaneSummary{}, err }
	if out.OrganizationReviews, err = s.controlOrganizations(ctx, 20); err != nil { return ControlPlaneSummary{}, err }
	if out.Telemetry, err = s.controlTelemetry(ctx, 30); err != nil { return ControlPlaneSummary{}, err }
	if out.Operations, err = s.controlOperations(ctx, 30); err != nil { return ControlPlaneSummary{}, err }
	if out.Costs, err = s.controlCosts(ctx, 12); err != nil { return ControlPlaneSummary{}, err }
	if out.Knowledge, err = s.controlKnowledge(ctx, 20); err != nil { return ControlPlaneSummary{}, err }
	if out.Settings, err = s.controlSettings(ctx); err != nil { return ControlPlaneSummary{}, err }
	if out.Releases, err = s.controlReleases(ctx, 20); err != nil { return ControlPlaneSummary{}, err }
	return out, nil
}

func (s *Service) controlApprovals(ctx context.Context, limit int) ([]ApprovalRecord,error) {
	rows,err:=s.db.Query(ctx,`SELECT a.id,a.action_type,a.target_type,a.target_id,a.requested_by,a.reason,a.approval_reference,a.required_approvals,
		count(d.id) FILTER (WHERE d.decision='approve'),count(d.id) FILTER (WHERE d.decision='reject'),a.status,a.expires_at,a.resolved_at,a.created_at
		FROM admin_approval_requests a LEFT JOIN admin_approval_decisions d ON d.approval_id=a.id
		GROUP BY a.id ORDER BY a.created_at DESC LIMIT $1`,limit); if err!=nil{return nil,err}; defer rows.Close()
	items:=make([]ApprovalRecord,0); for rows.Next(){var v ApprovalRecord;if err:=rows.Scan(&v.ID,&v.ActionType,&v.TargetType,&v.TargetID,&v.RequestedBy,&v.Reason,&v.ApprovalReference,&v.RequiredApprovals,&v.Approvals,&v.Rejections,&v.Status,&v.ExpiresAt,&v.ResolvedAt,&v.CreatedAt);err!=nil{return nil,err};items=append(items,v)};return items,rows.Err()
}
func (s *Service) controlCases(ctx context.Context, limit int)([]CaseRecord,error){rows,err:=s.db.Query(ctx,`SELECT id,case_type,subject_type,subject_id,title,status,priority,assigned_to,opened_by,summary,opened_at,updated_at,closed_at FROM admin_cases ORDER BY updated_at DESC,id LIMIT $1`,limit);if err!=nil{return nil,err};defer rows.Close();items:=make([]CaseRecord,0);for rows.Next(){var v CaseRecord;if err:=rows.Scan(&v.ID,&v.CaseType,&v.SubjectType,&v.SubjectID,&v.Title,&v.Status,&v.Priority,&v.AssignedTo,&v.OpenedBy,&v.Summary,&v.OpenedAt,&v.UpdatedAt,&v.ClosedAt);err!=nil{return nil,err};items=append(items,v)};return items,rows.Err()}
func (s *Service) controlOrganizations(ctx context.Context,limit int)([]OrganizationGovernanceRecord,error){rows,err:=s.db.Query(ctx,`SELECT id,company_id,review_type,status,requested_by,assigned_to,approval_id,source_user_id,target_user_id,duplicate_company_id,reason,created_at,updated_at FROM organization_governance_reviews ORDER BY created_at DESC,id LIMIT $1`,limit);if err!=nil{return nil,err};defer rows.Close();items:=make([]OrganizationGovernanceRecord,0);for rows.Next(){var v OrganizationGovernanceRecord;if err:=rows.Scan(&v.ID,&v.CompanyID,&v.ReviewType,&v.Status,&v.RequestedBy,&v.AssignedTo,&v.ApprovalID,&v.SourceUserID,&v.TargetUserID,&v.DuplicateCompanyID,&v.Reason,&v.CreatedAt,&v.UpdatedAt);err!=nil{return nil,err};items=append(items,v)};return items,rows.Err()}
func (s *Service) controlTelemetry(ctx context.Context,limit int)([]TelemetryRecord,error){rows,err:=s.db.Query(ctx,`SELECT id,category,source,operation,status,latency_ms,retry_count,backlog_count,reference_id,metadata,occurred_at FROM admin_telemetry_events ORDER BY occurred_at DESC,id DESC LIMIT $1`,limit);if err!=nil{return nil,err};defer rows.Close();items:=make([]TelemetryRecord,0);for rows.Next(){var v TelemetryRecord;if err:=rows.Scan(&v.ID,&v.Category,&v.Source,&v.Operation,&v.Status,&v.LatencyMS,&v.RetryCount,&v.BacklogCount,&v.ReferenceID,&v.Metadata,&v.OccurredAt);err!=nil{return nil,err};items=append(items,v)};return items,rows.Err()}
func (s *Service) controlOperations(ctx context.Context,limit int)([]OperationEvidenceRecord,error){rows,err:=s.db.Query(ctx,`SELECT id,evidence_type,environment,component,status,owner,reference,details,observed_at,created_at FROM admin_operation_evidence ORDER BY observed_at DESC,id LIMIT $1`,limit);if err!=nil{return nil,err};defer rows.Close();items:=make([]OperationEvidenceRecord,0);for rows.Next(){var v OperationEvidenceRecord;if err:=rows.Scan(&v.ID,&v.EvidenceType,&v.Environment,&v.Component,&v.Status,&v.Owner,&v.Reference,&v.Details,&v.ObservedAt,&v.CreatedAt);err!=nil{return nil,err};items=append(items,v)};return items,rows.Err()}
func (s *Service) controlCosts(ctx context.Context,limit int)([]CostSnapshotRecord,error){rows,err:=s.db.Query(ctx,`SELECT id,provider,currency,period_start,period_end,actual_cost::float8,forecast_cost::float8,budget_amount::float8,source_reference,observed_at FROM admin_cost_snapshots ORDER BY period_end DESC,observed_at DESC LIMIT $1`,limit);if err!=nil{return nil,err};defer rows.Close();items:=make([]CostSnapshotRecord,0);for rows.Next(){var v CostSnapshotRecord;if err:=rows.Scan(&v.ID,&v.Provider,&v.Currency,&v.PeriodStart,&v.PeriodEnd,&v.ActualCost,&v.ForecastCost,&v.BudgetAmount,&v.SourceReference,&v.ObservedAt);err!=nil{return nil,err};items=append(items,v)};return items,rows.Err()}
func (s *Service) controlKnowledge(ctx context.Context,limit int)([]KnowledgeArticleRecord,error){rows,err:=s.db.Query(ctx,`SELECT id,slug,title,status,current_revision,updated_by,published_at,updated_at FROM knowledge_articles ORDER BY updated_at DESC,id LIMIT $1`,limit);if err!=nil{return nil,err};defer rows.Close();items:=make([]KnowledgeArticleRecord,0);for rows.Next(){var v KnowledgeArticleRecord;if err:=rows.Scan(&v.ID,&v.Slug,&v.Title,&v.Status,&v.CurrentRevision,&v.UpdatedBy,&v.PublishedAt,&v.UpdatedAt);err!=nil{return nil,err};items=append(items,v)};return items,rows.Err()}
func (s *Service) controlSettings(ctx context.Context)([]OperationalSettingRecord,error){rows,err:=s.db.Query(ctx,`SELECT setting_key,value,description,high_risk,approval_id,updated_by,updated_at FROM admin_operational_settings ORDER BY setting_key`);if err!=nil{return nil,err};defer rows.Close();items:=make([]OperationalSettingRecord,0);for rows.Next(){var v OperationalSettingRecord;if err:=rows.Scan(&v.Key,&v.Value,&v.Description,&v.HighRisk,&v.ApprovalID,&v.UpdatedBy,&v.UpdatedAt);err!=nil{return nil,err};items=append(items,v)};return items,rows.Err()}
func (s *Service) controlReleases(ctx context.Context,limit int)([]ReleaseAcceptanceRecord,error){rows,err:=s.db.Query(ctx,`SELECT id,release_reference,environment,commit_sha,migration_reference,status,approval_id,backup_evidence_id,restore_test_evidence_id,requested_by,accepted_by,notes,created_at,updated_at,accepted_at FROM admin_release_acceptance ORDER BY created_at DESC,id LIMIT $1`,limit);if err!=nil{return nil,err};defer rows.Close();items:=make([]ReleaseAcceptanceRecord,0);for rows.Next(){var v ReleaseAcceptanceRecord;if err:=rows.Scan(&v.ID,&v.ReleaseReference,&v.Environment,&v.CommitSHA,&v.MigrationReference,&v.Status,&v.ApprovalID,&v.BackupEvidenceID,&v.RestoreTestEvidenceID,&v.RequestedBy,&v.AcceptedBy,&v.Notes,&v.CreatedAt,&v.UpdatedAt,&v.AcceptedAt);err!=nil{return nil,err};items=append(items,v)};return items,rows.Err()}

func (s *Service) CreateApproval(ctx context.Context, actor string, input CreateApprovalInput, ip, requestID string)(ApprovalRecord,error){
	input.ActionType=strings.TrimSpace(input.ActionType);input.TargetType=strings.TrimSpace(input.TargetType);input.TargetID=strings.TrimSpace(input.TargetID);input.Reason=strings.TrimSpace(input.Reason);input.ApprovalReference=strings.TrimSpace(input.ApprovalReference)
	if input.RequiredApprovals==0{input.RequiredApprovals=2}
	if !validResourceID(actor)||len(input.ActionType)<3||len(input.ActionType)>120||len(input.TargetType)<2||len(input.TargetType)>80||len(input.Reason)<10||len(input.Reason)>2000||len(input.ApprovalReference)<5||len(input.ApprovalReference)>200||input.RequiredApprovals<2||input.RequiredApprovals>5{return ApprovalRecord{},ErrInvalid}
	var target any;if input.TargetID!=""{if !validResourceID(input.TargetID){return ApprovalRecord{},ErrInvalid};target=input.TargetID}
	if input.ExpiresAt!=nil&&!input.ExpiresAt.After(s.now().UTC()){return ApprovalRecord{},ErrInvalid}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return ApprovalRecord{},err};defer tx.Rollback(ctx)
	var out ApprovalRecord
	err=tx.QueryRow(ctx,`INSERT INTO admin_approval_requests(action_type,target_type,target_id,requested_by,reason,approval_reference,required_approvals,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,action_type,target_type,target_id,requested_by,reason,approval_reference,required_approvals,status,expires_at,resolved_at,created_at`,input.ActionType,input.TargetType,target,actor,input.Reason,input.ApprovalReference,input.RequiredApprovals,input.ExpiresAt).Scan(&out.ID,&out.ActionType,&out.TargetType,&out.TargetID,&out.RequestedBy,&out.Reason,&out.ApprovalReference,&out.RequiredApprovals,&out.Status,&out.ExpiresAt,&out.ResolvedAt,&out.CreatedAt);if err!=nil{return ApprovalRecord{},err}
	t:=out.ID;if err=insertAuditTx(ctx,tx,AuditInput{AdminID:&actor,ActionType:"approval.requested",TargetEntityType:"approval",TargetEntityID:&t,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"action_type":out.ActionType,"target_type":out.TargetType,"required_approvals":out.RequiredApprovals,"approval_reference":out.ApprovalReference}});err!=nil{return ApprovalRecord{},err}
	if err=tx.Commit(ctx);err!=nil{return ApprovalRecord{},err};return out,nil
}

func (s *Service) DecideApproval(ctx context.Context, approvalID, reviewer, decision, note, ip, requestID string)(ApprovalRecord,error){
	decision=strings.ToLower(strings.TrimSpace(decision));note=strings.TrimSpace(note)
	if !validResourceID(approvalID)||!validResourceID(reviewer)||(decision!="approve"&&decision!="reject")||len(note)>2000{return ApprovalRecord{},ErrInvalid}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return ApprovalRecord{},err};defer tx.Rollback(ctx)
	var requestedBy,status string;var required int;var expires *time.Time
	if err=tx.QueryRow(ctx,`SELECT requested_by,status,required_approvals,expires_at FROM admin_approval_requests WHERE id=$1 FOR UPDATE`,approvalID).Scan(&requestedBy,&status,&required,&expires);errors.Is(err,pgx.ErrNoRows){return ApprovalRecord{},ErrNotFound}else if err!=nil{return ApprovalRecord{},err}
	if reviewer==requestedBy{return ApprovalRecord{},ErrForbidden};if status!="pending"{return ApprovalRecord{},ErrConflict}
	if expires!=nil&&!expires.After(s.now().UTC()){if _,err=tx.Exec(ctx,`UPDATE admin_approval_requests SET status='expired',resolved_at=now(),updated_at=now() WHERE id=$1`,approvalID);err!=nil{return ApprovalRecord{},err};if err=tx.Commit(ctx);err!=nil{return ApprovalRecord{},err};return ApprovalRecord{},ErrConflict}
	var already bool;if err=tx.QueryRow(ctx,`SELECT EXISTS(SELECT 1 FROM admin_approval_decisions WHERE approval_id=$1 AND reviewer_id=$2)`,approvalID,reviewer).Scan(&already);err!=nil{return ApprovalRecord{},err};if already{return ApprovalRecord{},ErrConflict}
	if _,err=tx.Exec(ctx,`INSERT INTO admin_approval_decisions(approval_id,reviewer_id,decision,note) VALUES($1,$2,$3,$4)`,approvalID,reviewer,decision,note);err!=nil{return ApprovalRecord{},err}
	var approvals,rejections int;if err=tx.QueryRow(ctx,`SELECT count(*) FILTER(WHERE decision='approve'),count(*) FILTER(WHERE decision='reject') FROM admin_approval_decisions WHERE approval_id=$1`,approvalID).Scan(&approvals,&rejections);err!=nil{return ApprovalRecord{},err}
	next:="pending";if rejections>0{next="rejected"}else if approvals>=required{next="approved"}
	if next!="pending"{if _,err=tx.Exec(ctx,`UPDATE admin_approval_requests SET status=$2,resolved_at=now(),updated_at=now() WHERE id=$1`,approvalID,next);err!=nil{return ApprovalRecord{},err}}
	t:=approvalID;if err=insertAuditTx(ctx,tx,AuditInput{AdminID:&reviewer,ActionType:"approval."+decision,TargetEntityType:"approval",TargetEntityID:&t,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"resulting_status":next}});err!=nil{return ApprovalRecord{},err}
	if err=tx.Commit(ctx);err!=nil{return ApprovalRecord{},err};items,err:=s.controlApprovals(ctx,100);if err!=nil{return ApprovalRecord{},err};for _,v:=range items{if v.ID==approvalID{return v,nil}};return ApprovalRecord{},ErrNotFound
}

func (s *Service) CreateCase(ctx context.Context, actor string, input CreateCaseInput, ip, requestID string)(CaseRecord,error){
	input.CaseType=strings.ToLower(strings.TrimSpace(input.CaseType));input.SubjectType=strings.ToLower(strings.TrimSpace(input.SubjectType));input.SubjectID=strings.TrimSpace(input.SubjectID);input.Title=strings.TrimSpace(input.Title);input.Priority=strings.ToLower(strings.TrimSpace(input.Priority));input.Summary=strings.TrimSpace(input.Summary)
	if input.Priority==""{input.Priority="normal"};if !validResourceID(actor)||!map[string]bool{"moderation":true,"privacy":true,"security":true,"organization":true,"operations":true}[input.CaseType]||!map[string]bool{"user":true,"job":true,"message":true,"privacy_request":true,"organization":true,"incident":true,"system":true,"release":true}[input.SubjectType]||len(input.Title)<5||len(input.Title)>240||!map[string]bool{"low":true,"normal":true,"high":true,"critical":true}[input.Priority]||len(input.Summary)>4000{return CaseRecord{},ErrInvalid}
	var subject any;if input.SubjectID!=""{if !validResourceID(input.SubjectID){return CaseRecord{},ErrInvalid};subject=input.SubjectID}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return CaseRecord{},err};defer tx.Rollback(ctx);var out CaseRecord
	if err=tx.QueryRow(ctx,`INSERT INTO admin_cases(case_type,subject_type,subject_id,title,priority,opened_by,summary) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,case_type,subject_type,subject_id,title,status,priority,assigned_to,opened_by,summary,opened_at,updated_at,closed_at`,input.CaseType,input.SubjectType,subject,input.Title,input.Priority,actor,input.Summary).Scan(&out.ID,&out.CaseType,&out.SubjectType,&out.SubjectID,&out.Title,&out.Status,&out.Priority,&out.AssignedTo,&out.OpenedBy,&out.Summary,&out.OpenedAt,&out.UpdatedAt,&out.ClosedAt);err!=nil{return CaseRecord{},err}
	if _,err=tx.Exec(ctx,`INSERT INTO admin_case_events(case_id,actor_id,event_type,note,to_status) VALUES($1,$2,'opened',$3,'open')`,out.ID,actor,input.Summary);err!=nil{return CaseRecord{},err};t:=out.ID;if err=insertAuditTx(ctx,tx,AuditInput{AdminID:&actor,ActionType:"admin_case.opened",TargetEntityType:"admin_case",TargetEntityID:&t,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"case_type":out.CaseType,"subject_type":out.SubjectType,"priority":out.Priority}});err!=nil{return CaseRecord{},err};if err=tx.Commit(ctx);err!=nil{return CaseRecord{},err};return out,nil
}

func (s *Service) UpdateCase(ctx context.Context, caseID, actor, assignee, status, eventType, note, ip, requestID string) error {
	assignee=strings.TrimSpace(assignee);status=strings.ToLower(strings.TrimSpace(status));eventType=strings.ToLower(strings.TrimSpace(eventType));note=strings.TrimSpace(note)
	if !validResourceID(caseID)||!validResourceID(actor)||len(note)>4000{return ErrInvalid};if assignee!=""&&!validResourceID(assignee){return ErrInvalid};if status!=""&&!map[string]bool{"open":true,"investigating":true,"awaiting_review":true,"resolved":true,"closed":true}[status]{return ErrInvalid};if eventType==""{eventType="note"};if !map[string]bool{"assigned":true,"note":true,"status_changed":true,"reviewed":true,"escalated":true,"hold_added":true,"hold_released":true}[eventType]{return ErrInvalid}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return err};defer tx.Rollback(ctx);var before string;if err=tx.QueryRow(ctx,`SELECT status FROM admin_cases WHERE id=$1 FOR UPDATE`,caseID).Scan(&before);errors.Is(err,pgx.ErrNoRows){return ErrNotFound}else if err!=nil{return err}
	if assignee!=""{if _,err=tx.Exec(ctx,`UPDATE admin_cases SET assigned_to=$2,updated_at=now() WHERE id=$1`,caseID,assignee);err!=nil{return err}}
	if status!=""{if _,err=tx.Exec(ctx,`UPDATE admin_cases SET status=$2,updated_at=now(),closed_at=CASE WHEN $2 IN ('resolved','closed') THEN now() ELSE NULL END WHERE id=$1`,caseID,status);err!=nil{return err}}
	if _,err=tx.Exec(ctx,`INSERT INTO admin_case_events(case_id,actor_id,event_type,note,from_status,to_status) VALUES($1,$2,$3,$4,$5,NULLIF($6,''))`,caseID,actor,eventType,note,before,status);err!=nil{return err};t:=caseID;if err=insertAuditTx(ctx,tx,AuditInput{AdminID:&actor,ActionType:"admin_case."+eventType,TargetEntityType:"admin_case",TargetEntityID:&t,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"assigned_to":assignee,"status":status}});err!=nil{return err};return tx.Commit(ctx)
}

func (s *Service) CreateOrganizationGovernanceReview(ctx context.Context, actor string, input CreateOrganizationGovernanceInput, ip, requestID string)(OrganizationGovernanceRecord,error){
	input.CompanyID=strings.TrimSpace(input.CompanyID);input.ReviewType=strings.ToLower(strings.TrimSpace(input.ReviewType));input.AssignedTo=strings.TrimSpace(input.AssignedTo);input.SourceUserID=strings.TrimSpace(input.SourceUserID);input.TargetUserID=strings.TrimSpace(input.TargetUserID);input.DuplicateCompanyID=strings.TrimSpace(input.DuplicateCompanyID);input.Reason=strings.TrimSpace(input.Reason);input.ApprovalReference=strings.TrimSpace(input.ApprovalReference)
	if !validResourceID(actor)||!validResourceID(input.CompanyID)||!map[string]bool{"restriction":true,"invitation":true,"reassignment":true,"merge_review":true}[input.ReviewType]||len(input.Reason)<10||len(input.Reason)>2000||len(input.ApprovalReference)<5{return OrganizationGovernanceRecord{},ErrInvalid}
	for _,id:=range []string{input.AssignedTo,input.SourceUserID,input.TargetUserID,input.DuplicateCompanyID}{if id!=""&&!validResourceID(id){return OrganizationGovernanceRecord{},ErrInvalid}}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return OrganizationGovernanceRecord{},err};defer tx.Rollback(ctx);var companyExists bool;if err=tx.QueryRow(ctx,`SELECT EXISTS(SELECT 1 FROM companies WHERE id=$1)`,input.CompanyID).Scan(&companyExists);err!=nil{return OrganizationGovernanceRecord{},err};if !companyExists{return OrganizationGovernanceRecord{},ErrNotFound}
	var approvalID string;if err=tx.QueryRow(ctx,`INSERT INTO admin_approval_requests(action_type,target_type,target_id,requested_by,reason,approval_reference,required_approvals) VALUES($1,'organization',$2,$3,$4,$5,2) RETURNING id`,"organization."+input.ReviewType,input.CompanyID,actor,input.Reason,input.ApprovalReference).Scan(&approvalID);err!=nil{return OrganizationGovernanceRecord{},err}
	opt:=func(v string)any{if v==""{return nil};return v};var out OrganizationGovernanceRecord
	if err=tx.QueryRow(ctx,`INSERT INTO organization_governance_reviews(company_id,review_type,requested_by,assigned_to,approval_id,source_user_id,target_user_id,duplicate_company_id,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,company_id,review_type,status,requested_by,assigned_to,approval_id,source_user_id,target_user_id,duplicate_company_id,reason,created_at,updated_at`,input.CompanyID,input.ReviewType,actor,opt(input.AssignedTo),approvalID,opt(input.SourceUserID),opt(input.TargetUserID),opt(input.DuplicateCompanyID),input.Reason).Scan(&out.ID,&out.CompanyID,&out.ReviewType,&out.Status,&out.RequestedBy,&out.AssignedTo,&out.ApprovalID,&out.SourceUserID,&out.TargetUserID,&out.DuplicateCompanyID,&out.Reason,&out.CreatedAt,&out.UpdatedAt);err!=nil{return OrganizationGovernanceRecord{},err}
	t:=out.ID;if err=insertAuditTx(ctx,tx,AuditInput{AdminID:&actor,ActionType:"organization_governance.requested",TargetEntityType:"organization_governance_review",TargetEntityID:&t,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"company_id":out.CompanyID,"review_type":out.ReviewType,"approval_id":approvalID}});err!=nil{return OrganizationGovernanceRecord{},err};if err=tx.Commit(ctx);err!=nil{return OrganizationGovernanceRecord{},err};return out,nil
}

func sanitizeTelemetryMetadata(input map[string]any) map[string]any {out:=map[string]any{};for k,v:=range input{key:=strings.ToLower(strings.TrimSpace(k));switch key{case "content","body","message","message_text","cv","cv_text","resume","resume_text","email_body","attachment","password","secret","token","private_key":continue};if len(key)<=64{out[key]=v}};return out}
func (s *Service) RecordTelemetry(ctx context.Context, category, source, operation, status string, latencyMS *int, retryCount int, backlogCount *int, referenceID string, metadata map[string]any) error {
	category=strings.ToLower(strings.TrimSpace(category));source=strings.TrimSpace(source);operation=strings.TrimSpace(operation);status=strings.ToLower(strings.TrimSpace(status));referenceID=strings.TrimSpace(referenceID)
	if !map[string]bool{"inmail":true,"ses":true,"notification":true,"websocket":true,"cv_parser":true}[category]||len(source)<2||len(source)>100||len(operation)<2||len(operation)>100||!map[string]bool{"ok":true,"retrying":true,"failed":true,"backlogged":true,"degraded":true,"unconnected":true}[status]||retryCount<0||len(referenceID)>200{return ErrInvalid};if latencyMS!=nil&&*latencyMS<0{return ErrInvalid};if backlogCount!=nil&&*backlogCount<0{return ErrInvalid};raw,err:=json.Marshal(sanitizeTelemetryMetadata(metadata));if err!=nil{return err};_,err=s.db.Exec(ctx,`INSERT INTO admin_telemetry_events(category,source,operation,status,latency_ms,retry_count,backlog_count,reference_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,NULLIF($8,''),$9)`,category,source,operation,status,latencyMS,retryCount,backlogCount,referenceID,raw);return err
}
