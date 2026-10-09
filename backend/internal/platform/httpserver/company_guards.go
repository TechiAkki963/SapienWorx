package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"net/http"
	"strings"
)

// Scoped members use the scoped company workspace. Broad legacy collection
// endpoints fail closed instead of returning company-wide records to them.
func (s *Server) companyRecruiterGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.company == nil {
			next.ServeHTTP(w, r)
			return
		}
		claims, _ := ClaimsFromContext(r.Context())
		m, err := s.company.Member(r.Context(), claims.Subject)
		if err != nil {
			s.writeCompanyError(w, r, err)
			return
		}
		if m.Status != "active" {
			s.writeCompanyError(w, r, company.ErrForbidden)
			return
		}
		path := r.URL.Path
		read := r.Method == "GET"
		if m.Role != "legacy_recruiter" {
			if strings.Contains(path, "/company/branding") && !read && !m.Owner() {
				s.writeCompanyError(w, r, company.ErrForbidden)
				return
			}
			if !m.Scope.All || m.Role == "collaborator" {
				job := r.PathValue("jobID")
				permission := "jobs.view"
				if !read {
					permission = "jobs.manage"
				}
				if app := r.PathValue("applicationID"); app != "" {
					job, err = s.company.ResourceJob(r.Context(), m.CompanyID, "application", app)
					permission = "applications.manage"
					if read {
						permission = "applications.view"
					}
				}
				if interview := r.PathValue("interviewID"); interview != "" {
					job, err = s.company.ResourceJob(r.Context(), m.CompanyID, "interview", interview)
					permission = "interviews.view"
					if !read {
						permission = "interviews.manage"
						if strings.HasSuffix(path, "/feedback") || strings.HasSuffix(path, "/response") {
							permission = "interviews.feedback"
						}
					}
				}
				if err != nil || job == "" || !m.Can(permission) || !s.company.JobAllowed(r.Context(), m, job) {
					s.writeCompanyError(w, r, company.ErrForbidden)
					return
				}
			}
		}
		feature := PremiumFeature(path, read)
		if feature != "" {
			e, eErr := company.NewService(s.company).Effective(r.Context(), m.CompanyID)
			if eErr != nil {
				s.writeCompanyError(w, r, eErr)
				return
			}
			if !e.Allows(feature) || (!m.TalentSeat && m.Role != "legacy_recruiter") {
				s.writeCompanyError(w, r, company.ErrInactive)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
func PremiumFeature(path string, read bool) string {
	if strings.Contains(path, "/sourcing-insights") {
		return "talent.analytics"
	}
	if strings.Contains(path, "/discover") || strings.HasSuffix(path, "/matches") || strings.Contains(path, "/recent-searches") {
		return "talent.discovery"
	}
	if strings.Contains(path, "/saved-searches") && !read {
		return "talent.alerts"
	}
	if strings.Contains(path, "/outreach") && !read {
		return "talent.outreach"
	}
	if (strings.Contains(path, "/talent-pool") || strings.Contains(path, "/talent-pools")) && !read {
		return "talent.smart_pools"
	}
	return ""
}
func (s *Server) companyMessagingGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if s.company != nil && ok && claims.Role == auth.RoleRecruiter && strings.HasPrefix(r.URL.Path, "/api/v1/messaging/") {
			m, err := s.company.Member(r.Context(), claims.Subject)
			if err != nil || m.Status != "active" || !m.Scope.All || m.Role == "collaborator" {
				s.writeCompanyError(w, r, company.ErrForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
