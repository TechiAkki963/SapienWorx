package admin

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var knowledgeSlugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
var releaseSHAPattern = regexp.MustCompile(`^[0-9a-fA-F]{7,64}$`)

type KnowledgeInput struct {
	ID string `json:"id"`
	Slug string `json:"slug"`
	Title string `json:"title"`
	Summary string `json:"summary"`
	Content string `json:"content"`
	Status string `json:"status"`
}

type OperationalSettingInput struct {
	Key string `json:"key"`
	Value map[string]any `json:"value"`
	Description string `json:"description"`
	HighRisk bool `json:"high_risk"`
	ApprovalID string `json:"approval_id"`
}

type OperationEvidenceInput struct {
	EvidenceType string `json:"evidence_type"`
	Environment string `json:"environment"`
	Component string `json:"component"`
	Status string `json:"status"`
	Owner string `json:"owner"`
	Reference string `json:"reference"`
	Details map[string]any `json:"details"`
	ObservedAt time.Time `json:"observed_at"`
}

type CostSnapshotInput struct {
	Currency string `json:"currency"`
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd time.Time `json:"period_end"`
	ActualCost float64 `json:"actual_cost"`
	ForecastCost *float64 `json:"forecast_cost"`
	BudgetAmount *float64 `json:"budget_amount"`
	SourceReference string `json:"source_reference"`
	ObservedAt time.Time `json:"observed_at"`
}

type ReleaseAcceptanceInput struct {
	ReleaseReference string `json:"release_reference"`
	Environment string `json:"environment"`
	CommitSHA string `json:"commit_sha"`
	MigrationReference string `json:"migration_reference"`
	ApprovalReference string `json:"approval_reference"`
	Notes string `json:"notes"`
}

func (s *Service) SaveKnowledgeArticle(ctx context.Context, actor string, input KnowledgeInput, ip, requestID string) (KnowledgeArticleRecord,error) {
	input.ID=strings.TrimSpace(input.ID);input.Slug=strings.ToLower(strings.TrimSpace(input.Slug));input.Title=strings.TrimSpace(input.Title);input.Summary=strings.TrimSpace(input.Summary);input.Content=strings.TrimSpace(input.Content);input.Status=strings.ToLower(strings.TrimSpace(input.Status))
	if input.Status==""{input.Status="draft"}
	if !validResourceID(actor)||!knowledgeSlugPattern.MatchString(input.Slug)||len(input.Title)<3||len(input.Title)>240||len(input.Summary)>1000||len(input.Content)<1||len(input.Content)>100000||!map[string]bool{"draft":true,"in_review":true,"published":true,"archived":true}[input.Status]{return KnowledgeArticleRecord{},ErrInvalid}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return KnowledgeArticleRecord{},err};defer tx.Rollback(ctx)
	var id string;var revision int
	if input.ID==""{
		err=tx.QueryRow(ctx,`INSERT INTO knowledge_articles(slug,title,status,created_by,updated_by,published_at) VALUES($1,$2,$3,$4,$4,CASE WHEN $3='published' THEN now() END) RETURNING id,current_revision`,input.Slug,input.Title,input.Status,actor).Scan(&id,&revision)
	}else{
		if !validResourceID(input.ID){return KnowledgeArticleRecord{},ErrInvalid};id=input.ID
		err=tx.QueryRow(ctx,`SELECT current_revision FROM knowledge_articles WHERE id=$1 FOR UPDATE`,id).Scan(&revision)
		if errors.Is(err,pgx.ErrNoRows){return KnowledgeArticleRecord{},ErrNotFound}
		if err==nil{_,err=tx.Exec(ctx,`UPDATE knowledge_articles SET slug=$2,title=$3,status=$4,updated_by=$5,updated_at=now(),published_at=CASE WHEN $4='published' THEN COALESCE(published_at,now()) ELSE published_at END WHERE id=$1`,id,input.Slug,input.Title,input.Status,actor)}
	}
	if err!=nil{return KnowledgeArticleRecord{},err}
	revision++
	if _,err=tx.Exec(ctx,`INSERT INTO knowledge_article_revisions(article_id,revision,title,summary,content,created_by) VALUES($1,$2,$3,$4,$5,$6)`,id,revision,input.Title,input.Summary,input.Content,actor);err!=nil{return KnowledgeArticleRecord{},err}
	if _,err=tx.Exec(ctx,`UPDATE knowledge_articles SET current_revision=$2,updated_at=now() WHERE id=$1`,id,revision);err!=nil{return KnowledgeArticleRecord{},err}
	t:=id;if err=insertAuditTx(ctx,tx,AuditInput{AdminID:&actor,ActionType:"knowledge_article."+input.Status,TargetEntityType:"knowledge_article",TargetEntityID:&t,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"slug":input.Slug,"revision":revision}});err!=nil{return KnowledgeArticleRecord{},err}
	if err=tx.Commit(ctx);err!=nil{return KnowledgeArticleRecord{},err}
	items,err:=s.controlKnowledge(ctx,100);if err!=nil{return KnowledgeArticleRecord{},err};for _,v:=range items{if v.ID==id{return v,nil}};return KnowledgeArticleRecord{},ErrNotFound
}

func approvedRequest(ctx context.Context,tx pgx.Tx,id string) error{
	if !validResourceID(id){return ErrInvalid};var status string;if err:=tx.QueryRow(ctx,`SELECT status FROM admin_approval_requests WHERE id=$1`,id).Scan(&status);errors.Is(err,pgx.ErrNoRows){return ErrNotFound}else if err!=nil{return err};if status!="approved"{return ErrConflict};return nil
}

func (s *Service) SetOperationalSetting(ctx context.Context, actor string, input OperationalSettingInput, ip, requestID string)(OperationalSettingRecord,error){
	input.Key=strings.ToLower(strings.TrimSpace(input.Key));input.Description=strings.TrimSpace(input.Description);input.ApprovalID=strings.TrimSpace(input.ApprovalID)
	if !validResourceID(actor)||len(input.Key)<3||len(input.Key)>100||len(input.Description)>1000{return OperationalSettingRecord{},ErrInvalid}
	clean:=sanitizeTelemetryMetadata(input.Value);raw,err:=json.Marshal(clean);if err!=nil{return OperationalSettingRecord{},err}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return OperationalSettingRecord{},err};defer tx.Rollback(ctx)
	var approval any
	if input.HighRisk{if err=approvedRequest(ctx,tx,input.ApprovalID);err!=nil{return OperationalSettingRecord{},err};approval=input.ApprovalID}
	var out OperationalSettingRecord
	err=tx.QueryRow(ctx,`INSERT INTO admin_operational_settings(setting_key,value,description,high_risk,approval_id,updated_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(setting_key) DO UPDATE SET value=EXCLUDED.value,description=EXCLUDED.description,high_risk=EXCLUDED.high_risk,approval_id=EXCLUDED.approval_id,updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING setting_key,value,description,high_risk,approval_id,updated_by,updated_at`,input.Key,raw,input.Description,input.HighRisk,approval,actor).Scan(&out.Key,&out.Value,&out.Description,&out.HighRisk,&out.ApprovalID,&out.UpdatedBy,&out.UpdatedAt);if err!=nil{return OperationalSettingRecord{},err}
	if err=insertAuditTx(ctx,tx,AuditInput{AdminID:&actor,ActionType:"operational_setting.updated",TargetEntityType:"operational_setting",IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"setting_key":input.Key,"high_risk":input.HighRisk,"approval_id":input.ApprovalID}});err!=nil{return OperationalSettingRecord{},err};if err=tx.Commit(ctx);err!=nil{return OperationalSettingRecord{},err};return out,nil
}

func (s *Service) RecordOperationEvidence(ctx context.Context, actor string,input OperationEvidenceInput,ip,requestID string)(OperationEvidenceRecord,error){
	input.EvidenceType=strings.ToLower(strings.TrimSpace(input.EvidenceType));input.Environment=strings.TrimSpace(input.Environment);input.Component=strings.TrimSpace(input.Component);input.Status=strings.ToLower(strings.TrimSpace(input.Status));input.Owner=strings.TrimSpace(input.Owner);input.Reference=strings.TrimSpace(input.Reference)
	if !validResourceID(actor)||!map[string]bool{"service_health":true,"database_health":true,"alert":true,"release":true,"migration":true,"backup":true,"restore_test":true}[input.EvidenceType]||len(input.Environment)<2||len(input.Environment)>40||len(input.Component)<2||len(input.Component)>120||!map[string]bool{"healthy":true,"warning":true,"critical":true,"failed":true,"passed":true,"pending":true,"unconnected":true,"unknown":true}[input.Status]||len(input.Owner)>200||len(input.Reference)>500{return OperationEvidenceRecord{},ErrInvalid}
	if input.ObservedAt.IsZero(){input.ObservedAt=s.now().UTC()};raw,err:=json.Marshal(sanitizeTelemetryMetadata(input.Details));if err!=nil{return OperationEvidenceRecord{},err}
	var out OperationEvidenceRecord
	err=s.db.QueryRow(ctx,`INSERT INTO admin_operation_evidence(evidence_type,environment,component,status,owner,reference,details,observed_at,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,evidence_type,environment,component,status,owner,reference,details,observed_at,created_at`,input.EvidenceType,input.Environment,input.Component,input.Status,input.Owner,input.Reference,raw,input.ObservedAt,actor).Scan(&out.ID,&out.EvidenceType,&out.Environment,&out.Component,&out.Status,&out.Owner,&out.Reference,&out.Details,&out.ObservedAt,&out.CreatedAt);if err!=nil{return OperationEvidenceRecord{},err};_ = s.Audit(ctx,AuditInput{AdminID:&actor,ActionType:"operation_evidence.recorded",TargetEntityType:"operation_evidence",TargetEntityID:&out.ID,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"evidence_type":out.EvidenceType,"component":out.Component,"status":out.Status}});return out,nil
}

func (s *Service) RecordCostSnapshot(ctx context.Context,actor string,input CostSnapshotInput,ip,requestID string)(CostSnapshotRecord,error){
	input.Currency=strings.ToUpper(strings.TrimSpace(input.Currency));input.SourceReference=strings.TrimSpace(input.SourceReference);if input.ObservedAt.IsZero(){input.ObservedAt=s.now().UTC()}
	if !validResourceID(actor)||len(input.Currency)!=3||input.PeriodStart.IsZero()||input.PeriodEnd.IsZero()||input.PeriodEnd.Before(input.PeriodStart)||input.ActualCost<0||(input.ForecastCost!=nil&&*input.ForecastCost<0)||(input.BudgetAmount!=nil&&*input.BudgetAmount<0)||len(input.SourceReference)>500{return CostSnapshotRecord{},ErrInvalid}
	var out CostSnapshotRecord;err:=s.db.QueryRow(ctx,`INSERT INTO admin_cost_snapshots(currency,period_start,period_end,actual_cost,forecast_cost,budget_amount,source_reference,observed_at,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,provider,currency,period_start,period_end,actual_cost::float8,forecast_cost::float8,budget_amount::float8,source_reference,observed_at`,input.Currency,input.PeriodStart,input.PeriodEnd,input.ActualCost,input.ForecastCost,input.BudgetAmount,input.SourceReference,input.ObservedAt,actor).Scan(&out.ID,&out.Provider,&out.Currency,&out.PeriodStart,&out.PeriodEnd,&out.ActualCost,&out.ForecastCost,&out.BudgetAmount,&out.SourceReference,&out.ObservedAt);if err!=nil{return CostSnapshotRecord{},err};_ = s.Audit(ctx,AuditInput{AdminID:&actor,ActionType:"cost_snapshot.recorded",TargetEntityType:"cost_snapshot",TargetEntityID:&out.ID,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"provider":out.Provider,"period_end":out.PeriodEnd}});return out,nil
}

func (s *Service) CreateReleaseAcceptance(ctx context.Context,actor string,input ReleaseAcceptanceInput,ip,requestID string)(ReleaseAcceptanceRecord,error){
	input.ReleaseReference=strings.TrimSpace(input.ReleaseReference);input.Environment=strings.TrimSpace(input.Environment);input.CommitSHA=strings.TrimSpace(input.CommitSHA);input.MigrationReference=strings.TrimSpace(input.MigrationReference);input.ApprovalReference=strings.TrimSpace(input.ApprovalReference);input.Notes=strings.TrimSpace(input.Notes)
	if !validResourceID(actor)||len(input.ReleaseReference)<5||len(input.ReleaseReference)>240||len(input.Environment)<2||len(input.Environment)>40||!releaseSHAPattern.MatchString(input.CommitSHA)||len(input.MigrationReference)>1000||len(input.ApprovalReference)<5||len(input.ApprovalReference)>200||len(input.Notes)>4000{return ReleaseAcceptanceRecord{},ErrInvalid}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return ReleaseAcceptanceRecord{},err};defer tx.Rollback(ctx)
	var out ReleaseAcceptanceRecord;if err=tx.QueryRow(ctx,`INSERT INTO admin_release_acceptance(release_reference,environment,commit_sha,migration_reference,requested_by,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,release_reference,environment,commit_sha,migration_reference,status,approval_id,backup_evidence_id,restore_test_evidence_id,requested_by,accepted_by,notes,created_at,updated_at,accepted_at`,input.ReleaseReference,input.Environment,input.CommitSHA,input.MigrationReference,actor,input.Notes).Scan(&out.ID,&out.ReleaseReference,&out.Environment,&out.CommitSHA,&out.MigrationReference,&out.Status,&out.ApprovalID,&out.BackupEvidenceID,&out.RestoreTestEvidenceID,&out.RequestedBy,&out.AcceptedBy,&out.Notes,&out.CreatedAt,&out.UpdatedAt,&out.AcceptedAt);err!=nil{return ReleaseAcceptanceRecord{},err}
	var approval string;if err=tx.QueryRow(ctx,`INSERT INTO admin_approval_requests(action_type,target_type,target_id,requested_by,reason,approval_reference,required_approvals) VALUES('release.rollout','release',$1,$2,$3,$4,2) RETURNING id`,out.ID,actor,"Approve production rollout for "+input.ReleaseReference,input.ApprovalReference).Scan(&approval);err!=nil{return ReleaseAcceptanceRecord{},err};if _,err=tx.Exec(ctx,`UPDATE admin_release_acceptance SET approval_id=$2 WHERE id=$1`,out.ID,approval);err!=nil{return ReleaseAcceptanceRecord{},err};out.ApprovalID=&approval
	t:=out.ID;if err=insertAuditTx(ctx,tx,AuditInput{AdminID:&actor,ActionType:"release_acceptance.created",TargetEntityType:"release_acceptance",TargetEntityID:&t,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"commit_sha":out.CommitSHA,"environment":out.Environment,"approval_id":approval}});err!=nil{return ReleaseAcceptanceRecord{},err};if err=tx.Commit(ctx);err!=nil{return ReleaseAcceptanceRecord{},err};return out,nil
}

func (s *Service) UpdateReleaseAcceptance(ctx context.Context,actor,releaseID,status,backupID,restoreID,note,ip,requestID string) error {
	status=strings.ToLower(strings.TrimSpace(status));backupID=strings.TrimSpace(backupID);restoreID=strings.TrimSpace(restoreID);note=strings.TrimSpace(note)
	if !validResourceID(actor)||!validResourceID(releaseID)||!map[string]bool{"approved_for_rollout":true,"deployed":true,"accepted":true,"rejected":true,"rolled_back":true}[status]||len(note)>4000{return ErrInvalid}
	tx,err:=s.db.BeginTx(ctx,pgx.TxOptions{});if err!=nil{return err};defer tx.Rollback(ctx);var approvalID *string;var current string;if err=tx.QueryRow(ctx,`SELECT approval_id,status FROM admin_release_acceptance WHERE id=$1 FOR UPDATE`,releaseID).Scan(&approvalID,&current);errors.Is(err,pgx.ErrNoRows){return ErrNotFound}else if err!=nil{return err}
	if status=="approved_for_rollout"||status=="deployed"||status=="accepted"{if approvalID==nil{return ErrConflict};if err=approvedRequest(ctx,tx,*approvalID);err!=nil{return err}}
	if status=="accepted"{if !validResourceID(backupID)||!validResourceID(restoreID){return ErrInvalid};var ok int;if err=tx.QueryRow(ctx,`SELECT count(*) FROM admin_operation_evidence WHERE id IN ($1,$2) AND ((id=$1 AND evidence_type='backup' AND status='passed') OR (id=$2 AND evidence_type='restore_test' AND status='passed'))`,backupID,restoreID).Scan(&ok);err!=nil{return err};if ok!=2{return ErrConflict}}
	_,err=tx.Exec(ctx,`UPDATE admin_release_acceptance SET status=$2,backup_evidence_id=COALESCE(NULLIF($3,''),backup_evidence_id),restore_test_evidence_id=COALESCE(NULLIF($4,''),restore_test_evidence_id),accepted_by=CASE WHEN $2='accepted' THEN $5 ELSE accepted_by END,accepted_at=CASE WHEN $2='accepted' THEN now() ELSE accepted_at END,notes=CASE WHEN $6='' THEN notes ELSE $6 END,updated_at=now() WHERE id=$1`,releaseID,status,backupID,restoreID,actor,note);if err!=nil{return err}
	t:=releaseID;if err=insertAuditTx(ctx,tx,AuditInput{AdminID:&actor,ActionType:"release_acceptance."+status,TargetEntityType:"release_acceptance",TargetEntityID:&t,IPAddress:ip,RequestID:requestID,Metadata:map[string]any{"previous_status":current,"backup_evidence_id":backupID,"restore_test_evidence_id":restoreID}});err!=nil{return err};return tx.Commit(ctx)
}
