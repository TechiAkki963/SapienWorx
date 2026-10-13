package httpserver

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"net/http"
	"strings"
	"time"
)

func excludedJobVisitor(agent string) bool {
	agent = strings.ToLower(agent)
	if agent == "" {
		return true
	}
	for _, part := range []string{"bot", "crawler", "spider", "preview", "monitor", "healthcheck", "uptime", "headless", "curl/", "wget/"} {
		if strings.Contains(agent, part) {
			return true
		}
	}
	return false
}

func (s *Server) publicJobView(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if excludedJobVisitor(r.UserAgent()) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	// Browser-only same-origin/CORS-controlled event, separate from crawler GETs.
	origin := r.Header.Get("Origin")
	if origin == "" || !originAllowed(origin, s.cfg.HTTP.AllowedOrigins) {
		writeError(w, r, 403, "origin_not_allowed", "job view origin is not allowed")
		return
	}
	token := ""
	if cookie, err := r.Cookie(s.cfg.Auth.AccessCookieName); err == nil {
		token = cookie.Value
	}
	if header := r.Header.Get("Authorization"); strings.HasPrefix(header, "Bearer ") {
		token = strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
	}
	identity := ""
	if token != "" {
		claims, err := s.tokens.Parse(token)
		if err != nil {
			writeError(w, r, 401, "unauthorized", "valid session required")
			return
		}
		active, err := s.auth.SessionAllowed(r.Context(), claims)
		if err != nil {
			writeError(w, r, 503, "session_unavailable", "session could not be verified")
			return
		}
		if !active {
			writeError(w, r, 401, "session_revoked", "valid session required")
			return
		}
		if claims.Role != auth.RoleCandidate {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		identity = "candidate:" + claims.Subject
	} else {
		visitor := ""
		if cookie, err := r.Cookie("sw_job_visitor"); err == nil && len(cookie.Value) == 64 {
			if raw, err := hex.DecodeString(cookie.Value); err == nil && len(raw) == 32 {
				visitor = cookie.Value
			}
		}
		if visitor == "" {
			var raw [32]byte
			if _, err := rand.Read(raw[:]); err != nil {
				writeError(w, r, 503, "tracking_unavailable", "job view could not be recorded")
				return
			}
			visitor = hex.EncodeToString(raw[:])
			http.SetCookie(w, &http.Cookie{Name: "sw_job_visitor", Value: visitor, Path: "/", HttpOnly: true, Secure: s.cfg.Auth.CookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: int((24 * time.Hour).Seconds())})
		}
		identity = "session:" + visitor
	}
	if len(s.cfg.Auth.JWTSecret) < 32 {
		writeError(w, r, 503, "tracking_unavailable", "job view tracking is unavailable")
		return
	}
	mac := hmac.New(sha256.New, []byte(s.cfg.Auth.JWTSecret))
	mac.Write([]byte("job-view:" + r.PathValue("jobID") + ":" + identity))
	if err := s.candidate.RecordPublicJobView(r.Context(), r.PathValue("jobID"), hex.EncodeToString(mac.Sum(nil))); err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Anonymous view events carry no authenticated authority. Origin validation in
// the handler prevents browser cross-site events; authenticated cookie events
// retain the ordinary double-submit CSRF protection.
func (s *Server) jobViewCSRF(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if cookie, err := r.Cookie(s.cfg.Auth.AccessCookieName); err == nil && cookie.Value != "" {
			RequireCSRF(s.cfg.Auth.CSRFCookieName)(next).ServeHTTP(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}
