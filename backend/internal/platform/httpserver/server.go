package httpserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
	"github.com/TechiAkki963/SapienWorx/backend/internal/privacy"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/TechiAkki963/SapienWorx/backend/internal/storage"
)

type DatabaseHealth interface{ Ping(context.Context) error }

type Server struct {
	http          *http.Server
	db            DatabaseHealth
	dbTimeout     time.Duration
	logger        *slog.Logger
	tokens        *auth.TokenManager
	auth          *auth.Service
	candidate     *candidate.Service
	recruiter     *recruiter.Service
	admin         *admin.Service
	privacy       *privacy.Service
	messages      *messagingRuntime
	objectStorage storage.ObjectStore
	cfg           config.Config
}

func New(cfg config.Config, db DatabaseHealth, tokens *auth.TokenManager, authService *auth.Service, candidateService *candidate.Service, recruiterService *recruiter.Service, adminService *admin.Service, logger *slog.Logger) *Server {
	s := &Server{db: db, dbTimeout: cfg.Database.HealthTimeout, logger: logger, tokens: tokens, auth: authService, candidate: candidateService, recruiter: recruiterService, admin: adminService, privacy: newPrivacyService(db), messages: newMessagingRuntime(db), cfg: cfg}
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
	mux.Handle("POST /api/v1/auth/email/request", Chain(http.HandlerFunc(s.requestEmailVerification), otpGuard))
	mux.Handle("POST /api/v1/auth/email/verify", Chain(http.HandlerFunc(s.verifyEmail), otpGuard))
	mux.Handle("POST /api/v1/auth/password/forgot", Chain(http.HandlerFunc(s.forgotPassword), otpGuard))
	mux.Handle("POST /api/v1/auth/password/reset", Chain(http.HandlerFunc(s.resetPassword), otpGuard))
	mux.HandleFunc("POST /api/v1/auth/refresh", s.refresh)
	mux.HandleFunc("POST /api/v1/auth/logout", s.logout)
	mux.HandleFunc("GET /api/v1/jobs", s.listJobs)
	mux.HandleFunc("GET /api/v1/jobs/{jobID}", s.getJob)
	mux.HandleFunc("GET /api/v1/profiles/{token}", s.publicCandidateProfile)
	mux.HandleFunc("GET /api/v1/privacy/subprocessors", s.publicSubprocessors)

	protected := Authenticate(tokens, cfg.Auth.AccessCookieName)
	candidateOnly := RequireRoles(auth.RoleCandidate)
	recruiterOnly := RequireRoles(auth.RoleRecruiter)
	candidateActivity := CandidateActivity(candidateService, logger)
	adminOnly := MasterAdminOnly(tokens, cfg.Auth.AccessCookieName, adminService, logger)

	mux.Handle("GET /api/v1/auth/me", Chain(http.HandlerFunc(s.me), protected))
	mux.Handle("POST /api/v1/users/profile-image", Chain(http.HandlerFunc(s.uploadUserProfileImage), protected))
	mux.Handle("GET /api/v1/users/profile-image", Chain(http.HandlerFunc(s.getUserProfileImage), protected))
	mux.Handle("POST /api/v1/auth/logout-all", Chain(http.HandlerFunc(s.logoutAll), protected))
	mux.Handle("GET /api/v1/user/privacy/requests", Chain(http.HandlerFunc(s.userPrivacyRequests), protected))
	mux.Handle("POST /api/v1/user/privacy/requests", Chain(http.HandlerFunc(s.userPrivacyRequests), protected))
	mux.Handle("GET /api/v1/user/privacy/export", Chain(http.HandlerFunc(s.userPrivacyExport), protected))
	mux.Handle("DELETE /api/v1/user/account", Chain(http.HandlerFunc(s.userAccountErasure), protected))

	mux.Handle("GET /api/v1/candidate/dashboard", Chain(http.HandlerFunc(s.candidateDashboard), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/jobs", Chain(http.HandlerFunc(s.candidateJobs), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/profile", Chain(http.HandlerFunc(s.candidateProfile), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/profile", Chain(http.HandlerFunc(s.candidateProfile), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/profile/summary", Chain(http.HandlerFunc(s.candidateProfileSummary), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/profile/photo", Chain(http.HandlerFunc(s.candidateProfilePhoto), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/profile/details", Chain(http.HandlerFunc(s.candidateProfileDetails), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/profile/details", Chain(http.HandlerFunc(s.candidateProfileDetails), protected, candidateOnly, candidateActivity))
	mux.Handle("POST /api/v1/candidate/cv/presign", Chain(http.HandlerFunc(s.candidateCVPresign), protected, candidateOnly, candidateActivity))
	mux.Handle("POST /api/v1/candidate/cv/complete", Chain(http.HandlerFunc(s.candidateCVComplete), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/cv", Chain(http.HandlerFunc(s.candidateCVDownload), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/recommendations", Chain(http.HandlerFunc(s.candidateRecommendations), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/applications", Chain(http.HandlerFunc(s.candidateApplications), protected, candidateOnly, candidateActivity))
	mux.Handle("POST /api/v1/candidate/applications", Chain(http.HandlerFunc(s.candidateApplications), protected, candidateOnly, candidateActivity))
	mux.Handle("POST /api/v1/candidate/applications/{applicationID}/withdraw", Chain(http.HandlerFunc(s.candidateApplicationWithdraw), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/interviews", Chain(http.HandlerFunc(s.candidateInterviews), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/saved-jobs", Chain(http.HandlerFunc(s.candidateSavedJobs), protected, candidateOnly, candidateActivity))
	mux.Handle("PUT /api/v1/candidate/saved-jobs/{jobID}", Chain(http.HandlerFunc(s.candidateSavedJob), protected, candidateOnly, candidateActivity))
	mux.Handle("DELETE /api/v1/candidate/saved-jobs/{jobID}", Chain(http.HandlerFunc(s.candidateSavedJob), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/company-watchlist", Chain(http.HandlerFunc(s.candidateCompanyWatchlist), protected, candidateOnly, candidateActivity))
	mux.Handle("PUT /api/v1/candidate/company-watchlist/{companyID}", Chain(http.HandlerFunc(s.candidateCompanyWatch), protected, candidateOnly, candidateActivity))
	mux.Handle("DELETE /api/v1/candidate/company-watchlist/{companyID}", Chain(http.HandlerFunc(s.candidateCompanyWatch), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/notifications", Chain(http.HandlerFunc(s.candidateNotifications), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/notifications/{notificationID}/read", Chain(http.HandlerFunc(s.candidateNotificationRead), protected, candidateOnly, candidateActivity))

	mux.Handle("GET /api/v1/recruiter/dashboard", Chain(http.HandlerFunc(s.recruiterDashboard), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/company/branding", Chain(http.HandlerFunc(s.recruiterCompanyBranding), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/company/branding", Chain(http.HandlerFunc(s.recruiterCompanyBranding), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/jobs", Chain(http.HandlerFunc(s.recruiterJobs), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/jobs", Chain(http.HandlerFunc(s.recruiterJobs), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/jobs/builder", Chain(http.HandlerFunc(s.recruiterJobBuilder), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/status", Chain(http.HandlerFunc(s.recruiterJobStatus), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/compensation", Chain(http.HandlerFunc(s.recruiterJobCompensation), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/skills", Chain(http.HandlerFunc(s.recruiterJobSkills), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/education", Chain(http.HandlerFunc(s.recruiterJobEducation), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/pipeline", Chain(http.HandlerFunc(s.recruiterPipeline), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/candidates/{candidateID}", Chain(http.HandlerFunc(s.recruiterCandidateDetail), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/candidates/{candidateID}/cv", Chain(http.HandlerFunc(s.recruiterCandidateCVDownload), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/applications/{applicationID}/stage", Chain(http.HandlerFunc(s.recruiterApplicationStage), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/talent-pool", Chain(http.HandlerFunc(s.recruiterTalentPool), protected, recruiterOnly))
	mux.Handle("PUT /api/v1/recruiter/talent-pool/{candidateID}", Chain(http.HandlerFunc(s.recruiterTalentPoolCandidate), protected, recruiterOnly))
	mux.Handle("DELETE /api/v1/recruiter/talent-pool/{candidateID}", Chain(http.HandlerFunc(s.recruiterTalentPoolCandidate), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/interviews", Chain(http.HandlerFunc(s.recruiterInterviews), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/interviews", Chain(http.HandlerFunc(s.recruiterInterviews), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/message-templates", Chain(http.HandlerFunc(s.recruiterMessageTemplates), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/message-templates", Chain(http.HandlerFunc(s.recruiterMessageTemplates), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/message-templates/{templateID}", Chain(http.HandlerFunc(s.recruiterMessageTemplate), protected, recruiterOnly))
	mux.Handle("DELETE /api/v1/recruiter/message-templates/{templateID}", Chain(http.HandlerFunc(s.recruiterMessageTemplate), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/inmail", Chain(http.HandlerFunc(s.recruiterInitiateInMail), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/inmail/bulk", Chain(http.HandlerFunc(s.recruiterBulkInMail), protected, recruiterOnly))

	messagingUsers := RequireRoles(auth.RoleCandidate, auth.RoleRecruiter)
	mux.Handle("GET /api/v1/messaging/threads", Chain(http.HandlerFunc(s.messagingThreads), protected, messagingUsers, candidateActivity))
	mux.Handle("GET /api/v1/messaging/threads/{threadID}/messages", Chain(http.HandlerFunc(s.messagingMessages), protected, messagingUsers, candidateActivity))
	mux.Handle("POST /api/v1/messaging/threads/{threadID}/messages", Chain(http.HandlerFunc(s.messagingMessages), protected, messagingUsers, candidateActivity))
	mux.Handle("PATCH /api/v1/messaging/threads/{threadID}/read", Chain(http.HandlerFunc(s.messagingRead), protected, messagingUsers, candidateActivity))
	mux.Handle("GET /api/v1/messaging/threads/{threadID}/ws", Chain(http.HandlerFunc(s.messagingSocket), protected, messagingUsers, candidateActivity))

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
	mux.Handle("GET /api/v1/admin/privacy/requests", Chain(http.HandlerFunc(s.adminPrivacyRequests), adminOnly))
	mux.Handle("PATCH /api/v1/admin/privacy/requests/{requestID}/status", Chain(http.HandlerFunc(s.adminPrivacyRequestTransition), adminOnly))
	mux.Handle("GET /api/v1/admin/privacy/incidents", Chain(http.HandlerFunc(s.adminPrivacyIncidents), adminOnly))
	mux.Handle("GET /api/v1/admin/privacy/subprocessors", Chain(http.HandlerFunc(s.adminPrivacySubprocessors), adminOnly))
	mux.Handle("GET /api/v1/admin/privacy/processing-activities", Chain(http.HandlerFunc(s.adminPrivacyProcessingActivities), adminOnly))

	handler := Chain(mux, TrustedProxyRemoteAddr(cfg.HTTP.TrustedProxyCIDRs), RequestID, Recover(logger), AccessLog(logger), SecurityHeaders, CORS(cfg.HTTP.AllowedOrigins), MaxBodyBytes(cfg.HTTP.MaxBodyBytes))
	s.http = &http.Server{Addr: cfg.HTTP.Address, Handler: handler, ReadTimeout: cfg.HTTP.ReadTimeout, ReadHeaderTimeout: cfg.HTTP.ReadHeaderTimeout, WriteTimeout: cfg.HTTP.WriteTimeout, IdleTimeout: cfg.HTTP.IdleTimeout}
	return s
}

func (s *Server) SetObjectStorage(objectStore storage.ObjectStore) { s.objectStorage = objectStore }
func (s *Server) ListenAndServe() error                            { return s.http.ListenAndServe() }
func (s *Server) Shutdown(ctx context.Context) error {
	s.messages.Close()
	return s.http.Shutdown(ctx)
}

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
	profile, err := s.auth.SessionProfile(r.Context(), claims.Subject)
	if err != nil {
		if errors.Is(err, auth.ErrAccountUnavailable) {
			writeError(w, r, http.StatusUnauthorized, "session_unavailable", "session is no longer available")
			return
		}
		s.logger.Error("session profile lookup failed", "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusServiceUnavailable, "profile_unavailable", "profile information is temporarily unavailable")
		return
	}
	if profile.Role != claims.Role {
		writeError(w, r, http.StatusUnauthorized, "session_invalid", "session is no longer valid")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}
