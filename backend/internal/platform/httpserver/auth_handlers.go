package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
)

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	if contentType := strings.TrimSpace(strings.Split(r.Header.Get("Content-Type"), ";")[0]); contentType != "" && contentType != "application/json" {
		writeError(w, r, http.StatusUnsupportedMediaType, "invalid_content_type", "Content-Type must be application/json")
		return false
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_request", "request body is invalid")
		return false
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		writeError(w, r, http.StatusBadRequest, "invalid_request", "request body must contain exactly one JSON value")
		return false
	}
	return true
}

func (s *Server) registerCandidate(w http.ResponseWriter, r *http.Request) {
	var input auth.EmailOnlyCandidateRegistration
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.auth.RegisterCandidateEmailOnly(r.Context(), input, r.UserAgent())
	if err != nil {
		s.writeAuthError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) registerRecruiter(w http.ResponseWriter, r *http.Request) {
	var input auth.EmailOnlyRecruiterRegistration
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.auth.RegisterRecruiterEmailOnly(r.Context(), input, r.UserAgent())
	if err != nil {
		s.writeAuthError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, result)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var input auth.LoginInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.auth.Login(r.Context(), input, r.UserAgent(), r.RemoteAddr)
	if err != nil {
		s.writeAuthError(w, r, err)
		return
	}
	s.setAuthCookies(w, result)
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) verifyOTP(w http.ResponseWriter, r *http.Request) {
	writeError(w, r, http.StatusGone, "sms_otp_disabled", "SMS OTP verification is not enabled; use email verification")
}

func (s *Server) resendOTP(w http.ResponseWriter, r *http.Request) {
	writeError(w, r, http.StatusGone, "sms_otp_disabled", "SMS OTP verification is not enabled; use email verification")
}

func (s *Server) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	code, err := s.auth.RequestPasswordReset(r.Context(), input.Email)
	if err != nil && !errors.Is(err, auth.ErrOTPRateLimited) {
		s.writeAuthError(w, r, err)
		return
	}
	payload := map[string]any{"accepted": true}
	if code != "" && s.auth.DebugOTPAllowed() {
		payload["development_code"] = code
	}
	writeJSON(w, http.StatusAccepted, payload)
}

func (s *Server) resetPassword(w http.ResponseWriter, r *http.Request) {
	var input auth.ResetPasswordInput
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.auth.ResetPassword(r.Context(), input); err != nil {
		s.writeAuthError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(s.cfg.Auth.RefreshCookieName)
	if err != nil {
		writeError(w, r, http.StatusUnauthorized, "invalid_refresh", "valid session required")
		return
	}
	result, err := s.auth.Refresh(r.Context(), cookie.Value, r.UserAgent(), r.RemoteAddr)
	if err != nil {
		s.clearAuthCookies(w)
		s.writeAuthError(w, r, err)
		return
	}
	s.setAuthCookies(w, result)
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(s.cfg.Auth.RefreshCookieName); err == nil {
		_ = s.auth.Logout(r.Context(), cookie.Value)
	}
	s.clearAuthCookies(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) logoutAll(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if err := s.auth.LogoutAll(r.Context(), claims.Subject); err != nil {
		s.writeAuthError(w, r, err)
		return
	}
	s.clearAuthCookies(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) verifyRecruiter(w http.ResponseWriter, r *http.Request) {
	userID := strings.TrimSpace(r.PathValue("userID"))
	if userID == "" {
		writeError(w, r, http.StatusBadRequest, "invalid_request", "recruiter user id is required")
		return
	}
	if err := s.auth.VerifyRecruiterEmailOnly(r.Context(), userID); err != nil {
		s.writeAuthError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"verified": true})
}

func (s *Server) setAuthCookies(w http.ResponseWriter, result auth.SessionResult) {
	sameSite := http.SameSiteLaxMode
	accessMaxAge := int(s.auth.AccessTokenTTL().Seconds())
	refreshMaxAge := int(s.auth.RefreshTokenTTL().Seconds())
	http.SetCookie(w, &http.Cookie{Name: s.cfg.Auth.AccessCookieName, Value: result.AccessToken, Path: "/", Domain: s.cfg.Auth.CookieDomain, MaxAge: accessMaxAge, HttpOnly: true, Secure: s.cfg.Auth.CookieSecure, SameSite: sameSite})
	http.SetCookie(w, &http.Cookie{Name: s.cfg.Auth.RefreshCookieName, Value: result.RefreshToken, Path: "/api/v1/auth", Domain: s.cfg.Auth.CookieDomain, MaxAge: refreshMaxAge, HttpOnly: true, Secure: s.cfg.Auth.CookieSecure, SameSite: sameSite})
}

func (s *Server) clearAuthCookies(w http.ResponseWriter) {
	expires := time.Unix(1, 0)
	for _, cookie := range []struct{ name, path string }{{s.cfg.Auth.AccessCookieName, "/"}, {s.cfg.Auth.RefreshCookieName, "/api/v1/auth"}} {
		http.SetCookie(w, &http.Cookie{Name: cookie.name, Value: "", Path: cookie.path, Domain: s.cfg.Auth.CookieDomain, MaxAge: -1, Expires: expires, HttpOnly: true, Secure: s.cfg.Auth.CookieSecure, SameSite: http.SameSiteLaxMode})
	}
}

func (s *Server) writeAuthError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, auth.ErrInvalidCredentials):
		writeError(w, r, http.StatusUnauthorized, "invalid_credentials", "email or password is incorrect")
	case errors.Is(err, auth.ErrEmailUnverified):
		writeError(w, r, http.StatusForbidden, "email_unverified", "registration email verification is incomplete")
	case errors.Is(err, auth.ErrRecruiterPending):
		writeError(w, r, http.StatusForbidden, "recruiter_approval_pending", "recruiter approval is pending")
	case errors.Is(err, auth.ErrAccountUnavailable):
		writeError(w, r, http.StatusForbidden, "account_unavailable", "account access is unavailable")
	case errors.Is(err, auth.ErrAccountPending):
		writeError(w, r, http.StatusForbidden, "account_pending", "account access is pending")
	case errors.Is(err, auth.ErrConflict):
		writeError(w, r, http.StatusConflict, "account_exists", "an account already exists for these details")
	case errors.Is(err, auth.ErrInvalidOTP):
		writeError(w, r, http.StatusBadRequest, "invalid_otp", "verification code is invalid or expired")
	case errors.Is(err, auth.ErrOTPRateLimited):
		writeError(w, r, http.StatusTooManyRequests, "otp_rate_limited", "wait before requesting another verification code")
	case errors.Is(err, auth.ErrInvalidRefresh):
		writeError(w, r, http.StatusUnauthorized, "invalid_refresh", "valid session required")
	case errors.Is(err, auth.ErrForbidden):
		writeError(w, r, http.StatusForbidden, "forbidden", "operation is not permitted")
	default:
		if strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "password") || strings.Contains(err.Error(), "email") || strings.Contains(err.Error(), "phone") || strings.Contains(err.Error(), "consent") || strings.Contains(err.Error(), "18+") {
			writeError(w, r, http.StatusBadRequest, "validation_error", err.Error())
			return
		}
		s.logger.Error("authentication operation failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "authentication operation could not be completed")
	}
}
