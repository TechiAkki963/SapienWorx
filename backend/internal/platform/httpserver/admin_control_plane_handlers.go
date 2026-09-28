package httpserver

import (
	"net/http"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
)

func (s *Server) adminControlPlane(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	result, err := s.admin.ControlPlane(r.Context())
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminCreateApproval(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input admin.CreateApprovalInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.CreateApproval(r.Context(), actor, input, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) adminDecideApproval(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		Decision string `json:"decision"`
		Note     string `json:"note"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.DecideApproval(r.Context(), strings.TrimSpace(r.PathValue("approvalID")), actor, input.Decision, input.Note, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminCreateCase(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input admin.CreateCaseInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.CreateCase(r.Context(), actor, input, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) adminUpdateCase(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		AssignedTo string `json:"assigned_to"`
		Status     string `json:"status"`
		EventType  string `json:"event_type"`
		Note       string `json:"note"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	err := s.admin.UpdateCase(r.Context(), strings.TrimSpace(r.PathValue("caseID")), actor, input.AssignedTo, input.Status, input.EventType, input.Note, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *Server) adminCreateOrganizationGovernanceReview(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input admin.CreateOrganizationGovernanceInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.CreateOrganizationGovernanceReview(r.Context(), actor, input, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) adminKnowledgeArticle(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input admin.KnowledgeInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.SaveKnowledgeArticle(r.Context(), actor, input, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminOperationalSetting(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input admin.OperationalSettingInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.SetOperationalSetting(r.Context(), actor, input, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminOperationEvidence(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input admin.OperationEvidenceInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.RecordOperationEvidence(r.Context(), actor, input, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) adminCostSnapshot(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input admin.CostSnapshotInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.RecordCostSnapshot(r.Context(), actor, input, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) adminCreateReleaseAcceptance(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input admin.ReleaseAcceptanceInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.CreateReleaseAcceptance(r.Context(), actor, input, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) adminUpdateReleaseAcceptance(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		Status                string `json:"status"`
		BackupEvidenceID      string `json:"backup_evidence_id"`
		RestoreTestEvidenceID string `json:"restore_test_evidence_id"`
		Note                  string `json:"note"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	err := s.admin.UpdateReleaseAcceptance(r.Context(), actor, strings.TrimSpace(r.PathValue("releaseID")), input.Status, input.BackupEvidenceID, input.RestoreTestEvidenceID, input.Note, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *Server) adminRuntimeSnapshot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	result, err := s.admin.RuntimeSnapshot(r.Context())
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminCaseHistory(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	items, err := s.admin.CaseHistory(r.Context(), strings.TrimSpace(r.PathValue("caseID")))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) adminAlerts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	items, err := s.admin.Alerts(r.Context())
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	rules, err := s.admin.AlertRules(r.Context())
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "rules": rules})
}

func (s *Server) adminEvaluateAlerts(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	count, err := s.admin.EvaluateAlerts(r.Context(), actor, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"triggered": count})
}

func (s *Server) adminAlertTransition(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		Status string `json:"status"`
		Owner  string `json:"owner"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.admin.UpdateAlert(r.Context(), strings.TrimSpace(r.PathValue("alertID")), actor, input.Status, input.Owner, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context())); err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *Server) adminIntelligence(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	result, err := s.admin.Intelligence(r.Context())
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminRunIntelligence(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	result, err := s.admin.RunIntelligence(r.Context(), actor, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) adminReviewIntelligenceInsight(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		Status  string `json:"status"`
		Outcome string `json:"outcome"`
		Note    string `json:"note"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.admin.ReviewIntelligenceInsight(r.Context(), strings.TrimSpace(r.PathValue("insightID")), actor, input.Status, input.Outcome, input.Note, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context())); err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *Server) adminUpdateIntelligenceSwitch(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		Enabled    bool   `json:"enabled"`
		ApprovalID string `json:"approval_id"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.admin.UpdateIntelligenceSwitch(r.Context(), strings.TrimSpace(r.PathValue("switchKey")), actor, input.Enabled, input.ApprovalID, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context())); err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"updated": true})
}

func (s *Server) adminRegisterIntelligenceModel(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		EngineType string         `json:"engine_type"`
		Version    string         `json:"version"`
		Provider   string         `json:"provider"`
		ModelRef   string         `json:"model_ref"`
		Config     map[string]any `json:"config"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.RegisterIntelligenceModel(r.Context(), actor, input.EngineType, input.Version, input.Provider, input.ModelRef, input.Config, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) adminRequestIntelligenceModelEvaluation(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	if err := s.admin.RequestModelEvaluation(r.Context(), strings.TrimSpace(r.PathValue("modelID")), actor, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context())); err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]bool{"queued": true})
}

func (s *Server) adminPromoteIntelligenceModel(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		ApprovalID string `json:"approval_id"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.admin.PromoteIntelligenceModel(r.Context(), strings.TrimSpace(r.PathValue("modelID")), actor, input.ApprovalID, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context())); err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"promoted": true})
}

func (s *Server) adminRegisterIntelligencePrompt(w http.ResponseWriter, r *http.Request) {
	actor, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		PromptKey      string   `json:"prompt_key"`
		Template       string   `json:"template"`
		Status         string   `json:"status"`
		Variables      []string `json:"variables"`
		ModelVersionID string   `json:"model_version_id"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.RegisterIntelligencePrompt(r.Context(), actor, input.PromptKey, input.Template, input.Status, input.Variables, input.ModelVersionID, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}
