package httpserver

import (
	"errors"
	"net/http"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
)

func (s *Server) adminAccessStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if !s.cfg.Admin.AccessEnabled {
		writeJSON(w, http.StatusOK, admin.ScopedAccess{Permissions: []admin.Permission{}})
		return
	}
	access, ok := r.Context().Value(adminScopeKey{}).(admin.ScopedAccess)
	if !ok {
		writeError(w, r, http.StatusServiceUnavailable, "admin_access_unavailable", "administrator access is unavailable")
		return
	}
	writeJSON(w, http.StatusOK, access)
}

func (s *Server) adminMFA(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if !s.cfg.Admin.AccessEnabled {
		writeError(w, r, http.StatusServiceUnavailable, "admin_security_disabled", "administrator security enrollment is not enabled")
		return
	}
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "administrator access denied")
		return
	}
	var input struct {
		Password string `json:"password"`
		Code     string `json:"code,omitempty"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if len(input.Password) > 1024 || len(input.Code) > 6 {
		writeError(w, r, http.StatusBadRequest, "admin_verification_failed", "administrator verification failed")
		return
	}
	if r.URL.Path == "/api/v1/admin/security/mfa/enroll" {
		enrollment, err := s.admin.BeginMFA(r.Context(), claims.Subject, claims.TokenID, input.Password, s.cfg.Admin.MFAEncryptionKey, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
		if err != nil {
			s.adminSecurityError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, enrollment)
		return
	}
	err := s.admin.VerifyMFA(r.Context(), claims.Subject, claims.TokenID, input.Password, input.Code, s.cfg.Admin.MFAEncryptionKey, clientIP(r.RemoteAddr), RequestIDFromContext(r.Context()))
	if err != nil {
		s.adminSecurityError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"verified": true})
}

func (s *Server) adminSecurityError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, admin.ErrMFALimited):
		writeError(w, r, http.StatusTooManyRequests, "admin_verification_limited", "wait five minutes before trying again")
	case errors.Is(err, admin.ErrMFAInvalid):
		writeError(w, r, http.StatusBadRequest, "admin_verification_failed", "password or authenticator code is invalid, expired or already used")
	case errors.Is(err, admin.ErrForbidden):
		writeError(w, r, http.StatusForbidden, "admin_forbidden", "an approved administrator and valid session are required")
	default:
		s.logger.Error("admin security operation unavailable", "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "admin_security_unavailable", "administrator verification is temporarily unavailable")
	}
}
