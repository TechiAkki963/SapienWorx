package httpserver

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

type DatabaseHealth interface{ Ping(context.Context) error }

type Server struct {
	http      *http.Server
	db        DatabaseHealth
	dbTimeout time.Duration
	logger    *slog.Logger
	tokens    *auth.TokenManager
	auth      *auth.Service
	candidate *candidate.Service
	recruiter *recruiter.Service
	admin     *admin.Service
	cfg       config.Config
}

func New(cfg config.Config, db DatabaseHealth, tokens *auth.TokenManager, authService *auth.Service, candidateService *candidate.Service, recruiterService *recruiter.Service, adminService *admin.Service, logger *slog.Logger) *Server {
	s := &Server{db: db, dbTimeout: cfg.Database.HealthTimeout, logger: logger, tokens: tokens, auth: authService, candidate: candidateService, recruiter: recruiterService, admin: adminService, cfg: cfg}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", s.live)
	mux.HandleFunc("GET /health/ready", s.ready)

	otpLimiter := NewIPRateLimiter(cfg.Auth.OTPIPLimit, cfg.Auth.OTPIPWindow)
	loginLimiter := NewIPRateLimiter(cfg.Auth.LoginIPLimit, cfg.Auth.LoginIPWindow)
	otpGuard := otpLimiter.Middleware("otp")
	loginGuard := loginLimiter.Middleware("login")

	mux.Handle("POST /api/v1/auth/candidate/register", Chain(http.HandlerFunc(s.registerCandidate), otpGuard))
	mux.Handle("POST /api/v1/auth/recruiter/register", Chain(http.HandlerFunc(s.registerRecruiter), otpGuard))
	mux.Handle("POST /api/v1/auth/login", Chain(http.HandlerFunc(s.login), loginGuard))
	mux.Handle("POST /api/v1/auth/otp/verify", Chain(http.HandlerFunc(s.verifyOTP), otpGuard))
	mux.Handle("POST /api/v1/auth/otp/resend", Chain(http.HandlerFunc(s.resendOTP), otpGuard))
	mux.HandleFunc("POST /api/v1/auth/email/request", s.requestEmailVerification)
	mux.HandleFunc("POST /api/v1/auth/email/verify", s.verifyEmail)
	mux.Handle("POST /api/v1/auth/password/forgot", Chain(http.HandlerFunc(s.forgotPassword), otpGuard))
	mux.Handle("POST /api/v1/auth/password/reset", Chain(http.HandlerFunc(s.resetPassword), otpGuard))
	mux.HandleFunc("POST /api/v1/auth/refresh", s.refresh)
	mux.HandleFunc("POST /api/v1/auth/logout", s.logout)
	mux.HandleFunc("GET /api/v1/jobs", s.listJobs)
	mux.HandleFunc("GET /api/v1/jobs/{jobID}", s.getJob)
	mux.HandleFunc("GET /api/v1/profiles/{token}", s.publicCandidateProfile)

	protected := Authenticate(tokens, cfg.Auth.AccessCookieName)
	candidateOnly := RequireRoles(auth.RoleCandidate)
	recruiterOnly := RequireRoles(auth.RoleRecruiter)
	candidateActivity := CandidateActivity(candidateService, logger)
	adminOnly := MasterAdminOnly(tokens, cfg.Auth.AccessCookieName, adminService, logger)

	mux.Handle("GET /api/v1/auth/me", Chain(http.HandlerFunc(s.me), protected))
	mux.Handle("POST /api/v1/auth/logout-all", Chain(http.HandlerFunc(s.logoutAll), protected))

	mux.Handle("GET /api/v1/candidate/dashboard", Chain(http.HandlerFunc(s.candidateDashboard), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/jobs", Chain(http.HandlerFunc(s.candidateJobs), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/profile", Chain(http.HandlerFunc(s.candidateProfile), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/profile", Chain(http.HandlerFunc(s.candidateProfile), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/profile/summary", Chain(http.HandlerFunc(s.candidateProfileSummary), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/profile/photo", Chain(http.HandlerFunc(s.candidateProfilePhoto), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/profile/details", Chain(http.HandlerFunc(s.candidateProfileDetails), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/profile/details", Chain(http.HandlerFunc(s.candidateProfileDetails), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/recommendations", Chain(http.HandlerFunc(s.candidateRecommendations), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/applications", Chain(http.HandlerFunc(s.candidateApplications), protected, candidateOnly, candidateActivity))
	mux.Handle("POST /api/v1/candidate/applications", Chain(http.HandlerFunc(s.candidateApplications), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/saved-jobs", Chain(http.HandlerFunc(s.candidateSavedJobs), protected, candidateOnly, candidateActivity))
	mux.Handle("PUT /api/v1/candidate/saved-jobs/{jobID}", Chain(http.HandlerFunc(s.candidateSavedJob), protected, candidateOnly, candidateActivity))
	mux.Handle("DELETE /api/v1/candidate/saved-jobs/{jobID}", Chain(http.HandlerFunc(s.candidateSavedJob), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/notifications", Chain(http.HandlerFunc(s.candidateNotifications), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/notifications/{notificationID}/read", Chain(http.HandlerFunc(s.candidateNotificationRead), protected, candidateOnly, candidateActivity))

	mux.Handle("GET /api/v1/recruiter/dashboard", Chain(http.HandlerFunc(s.recruiterDashboard), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/company/branding", Chain(http.HandlerFunc(s.recruiterCompanyBranding), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/company/branding", Chain(http.HandlerFunc(s.recruiterCompanyBranding), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/jobs", Chain(http.HandlerFunc(s.recruiterJobs), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/jobs", Chain(http.HandlerFunc(s.recruiterJobs), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/jobs/builder", Chain(http.HandlerFunc(s.recruiterJobBuilder), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/status", Chain(http.HandlerFunc(s.recruiterJobStatus), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/skills", Chain(http.HandlerFunc(s.recruiterJobSkills), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/education", Chain(http.HandlerFunc(s.recruiterJobEducation), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/pipeline", Chain(http.HandlerFunc(s.recruiterPipeline), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/candidates/{candidateID}", Chain(http.HandlerFunc(s.recruiterCandidateDetail), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/applications/{applicationID}/stage", Chain(http.HandlerFunc(s.recruiterApplicationStage), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/interviews", Chain(http.HandlerFunc(s.recruiterInterviews), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/interviews", Chain(http.HandlerFunc(s.recruiterInterviews), protected, recruiterOnly))

	mux.Handle("GET /api/v1/admin/metrics", Chain(http.HandlerFunc(s.adminMetrics), adminOnly))
	mux.Handle("GET /api/v1/admin/company-verifications", Chain(http.HandlerFunc(s.adminCompanyVerifications), adminOnly))
	mux.Handle("GET /api/v1/admin/company-verifications/{verificationID}/document", Chain(http.HandlerFunc(s.adminRegistrationDocument), adminOnly))
	mux.Handle("POST /api/v1/admin/company-verifications/{verificationID}/approve", Chain(http.HandlerFunc(s.adminApproveCompany), adminOnly))
	mux.Handle("POST /api/v1/admin/company-verifications/{verificationID}/reject", Chain(http.HandlerFunc(s.adminRejectCompany), adminOnly))
	mux.Handle("GET /api/v1/admin/users", Chain(http.HandlerFunc(s.adminUsers), adminOnly))
	mux.Handle("POST /api/v1/admin/users/{userID}/suspend", Chain(http.HandlerFunc(s.adminSuspendUser), adminOnly))
	mux.Handle("POST /api/v1/admin/users/{userID}/force-password-reset", Chain(http.HandlerFunc(s.adminForcePasswordReset), adminOnly))
	mux.Handle("GET /api/v1/admin/jobs", Chain(http.HandlerFunc(s.adminJobs), adminOnly))
	mux.Handle("POST /api/v1/admin/jobs/{jobID}/takedown", Chain(http.HandlerFunc(s.adminTakedownJob), adminOnly))
	mux.Handle("GET /api/v1/admin/audit-logs", Chain(http.HandlerFunc(s.adminAuditLogs), adminOnly))
	mux.Handle("GET /api/v1/admin/budget-settings", Chain(http.HandlerFunc(s.adminBudgetSettings), adminOnly))
	mux.Handle("PATCH /api/v1/admin/budget-settings", Chain(http.HandlerFunc(s.adminBudgetSettings), adminOnly))

	handler := Chain(mux, RequestID, Recover(logger), AccessLog(logger), SecurityHeaders, CORS(cfg.HTTP.AllowedOrigins), MaxBodyBytes(cfg.HTTP.MaxBodyBytes))
	s.http = &http.Server{Addr: cfg.HTTP.Address, Handler: handler, ReadTimeout: cfg.HTTP.ReadTimeout, ReadHeaderTimeout: cfg.HTTP.ReadHeaderTimeout, WriteTimeout: cfg.HTTP.WriteTimeout, IdleTimeout: cfg.HTTP.IdleTimeout}
	return s
}

func (s *Server) ListenAndServe() error              { return s.http.ListenAndServe() }
func (s *Server) Shutdown(ctx context.Context) error { return s.http.Shutdown(ctx) }

func (s *Server) live(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "sapienworx-api"})
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), s.dbTimeout)
	defer cancel()
	if err := s.db.Ping(ctx); err != nil {
		s.logger.Warn("readiness check failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "not_ready", "service dependencies are not ready")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": claims.Subject, "role": claims.Role})
}
