package httpserver

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
)

func adminClaimsID(r *http.Request) (string, bool) {
	claims, ok := ClaimsFromContext(r.Context())
	return claims.Subject, ok && strings.TrimSpace(claims.Subject) != ""
}

func parseAdminPage(r *http.Request) (int, int) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	return page, limit
}

func (s *Server) adminMetrics(w http.ResponseWriter, r *http.Request) {
	result, err := s.admin.Metrics(r.Context())
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminCompanyVerifications(w http.ResponseWriter, r *http.Request) {
	page, limit := parseAdminPage(r)
	result, err := s.admin.CompanyVerifications(r.Context(), r.URL.Query().Get("status"), page, limit)
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminReviewCompany(w http.ResponseWriter, r *http.Request, decision string) {
	adminUserID, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	verificationID := strings.TrimSpace(r.PathValue("verificationID"))
	if verificationID == "" {
		writeError(w, r, http.StatusBadRequest, "invalid_request", "verification id is required")
		return
	}
	var input struct {
		Notes string `json:"notes"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.admin.ReviewCompany(r.Context(), verificationID, adminUserID, decision, input.Notes, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context())); err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"reviewed": true, "status": decision})
}

func (s *Server) adminApproveCompany(w http.ResponseWriter, r *http.Request) {
	s.adminReviewCompany(w, r, "approved")
}

func (s *Server) adminRejectCompany(w http.ResponseWriter, r *http.Request) {
	s.adminReviewCompany(w, r, "rejected")
}

func (s *Server) adminRegistrationDocument(w http.ResponseWriter, r *http.Request) {
	adminUserID, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	url, err := s.admin.RegistrationDocument(r.Context(), strings.TrimSpace(r.PathValue("verificationID")), adminUserID, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

func (s *Server) adminUsers(w http.ResponseWriter, r *http.Request) {
	page, limit := parseAdminPage(r)
	result, err := s.admin.Users(r.Context(), r.URL.Query().Get("q"), r.URL.Query().Get("role"), r.URL.Query().Get("status"), page, limit)
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminJobs(w http.ResponseWriter, r *http.Request) {
	page, limit := parseAdminPage(r)
	result, err := s.admin.Jobs(r.Context(), r.URL.Query().Get("q"), r.URL.Query().Get("status"), page, limit)
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminAuditLogs(w http.ResponseWriter, r *http.Request) {
	page, limit := parseAdminPage(r)
	result, err := s.admin.AuditLogs(r.Context(), r.URL.Query().Get("q"), r.URL.Query().Get("action"), r.URL.Query().Get("target_type"), page, limit)
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) adminBudgetSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		result, err := s.admin.BudgetSettings(r.Context())
		if err != nil {
			s.writeAdminError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, result)
		return
	}

	adminUserID, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	var input struct {
		WarningCount  int `json:"sns_sms_warning_count"`
		CriticalCount int `json:"sns_sms_critical_count"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.admin.UpdateBudgetSettings(r.Context(), adminUserID, input.WarningCount, input.CriticalCount, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func decodeAdminReason(w http.ResponseWriter, r *http.Request) (string, bool) {
	var input struct {
		Reason string `json:"reason"`
	}
	if !decodeJSON(w, r, &input) {
		return "", false
	}
	reason := strings.TrimSpace(input.Reason)
	if len(reason) < 5 {
		writeError(w, r, http.StatusBadRequest, "invalid_request", "a moderation reason of at least 5 characters is required")
		return "", false
	}
	return reason, true
}

func (s *Server) adminSuspendUser(w http.ResponseWriter, r *http.Request) {
	adminUserID, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	reason, ok := decodeAdminReason(w, r)
	if !ok {
		return
	}
	if err := s.admin.SuspendUser(r.Context(), strings.TrimSpace(r.PathValue("userID")), adminUserID, reason, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context())); err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"suspended": true})
}

func (s *Server) adminForcePasswordReset(w http.ResponseWriter, r *http.Request) {
	adminUserID, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	reason, ok := decodeAdminReason(w, r)
	if !ok {
		return
	}
	if err := s.admin.ForcePasswordReset(r.Context(), strings.TrimSpace(r.PathValue("userID")), adminUserID, reason, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context())); err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"force_password_reset": true})
}

func (s *Server) adminTakedownJob(w http.ResponseWriter, r *http.Request) {
	adminUserID, ok := adminClaimsID(r)
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin access denied")
		return
	}
	reason, ok := decodeAdminReason(w, r)
	if !ok {
		return
	}
	if err := s.admin.TakedownJob(r.Context(), strings.TrimSpace(r.PathValue("jobID")), adminUserID, reason, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context())); err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"taken_down": true})
}

func (s *Server) writeAdminError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, admin.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "not_found", "admin resource was not found")
	case errors.Is(err, admin.ErrForbidden):
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "master admin operation is not permitted")
	case errors.Is(err, admin.ErrInvalid):
		writeError(w, r, http.StatusBadRequest, "invalid_request", "admin request is invalid")
	default:
		s.logger.Error("master admin operation failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "admin operation could not be completed")
	}
}
