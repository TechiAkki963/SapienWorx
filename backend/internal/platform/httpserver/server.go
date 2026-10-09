package httpserver

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/TechiAkki963/SapienWorx/backend/internal/platform/config"
	"github.com/TechiAkki963/SapienWorx/backend/internal/privacy"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/TechiAkki963/SapienWorx/backend/internal/storage"
	"github.com/TechiAkki963/SapienWorx/backend/internal/workforce"
	"github.com/jackc/pgx/v5/pgxpool"
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
	workforce     *workforce.Service
	privacy       *privacy.Service
	messages      *messagingRuntime
	emailDelivery emailDeliveryRuntime
	objectStorage storage.ObjectStore
	cfg           config.Config
	company       *company.SQLStore
}

func New(cfg config.Config, db DatabaseHealth, tokens *auth.TokenManager, authService *auth.Service, candidateService *candidate.Service, recruiterService *recruiter.Service, adminService *admin.Service, workforceService *workforce.Service, logger *slog.Logger) *Server {
	s := &Server{db: db, dbTimeout: cfg.Database.HealthTimeout, logger: logger, tokens: tokens, auth: authService, candidate: candidateService, recruiter: recruiterService, admin: adminService, workforce: workforceService, privacy: newPrivacyService(db), messages: newMessagingRuntime(db, cfg.Messaging, logger), cfg: cfg}
	if pool, ok := db.(*pgxpool.Pool); ok {
		s.company = company.NewSQLStore(pool)
	}
	if recruiterService != nil && len(cfg.Auth.JWTSecret) >= 32 && len(cfg.HTTP.AllowedOrigins) > 0 {
		recruiterService.ConfigureReferralInvitations(cfg.Auth.JWTSecret, cfg.HTTP.AllowedOrigins[0])
	}
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
	mux.Handle("POST /api/v1/auth/logout", Chain(http.HandlerFunc(s.logout), RequireCSRF(cfg.Auth.CSRFCookieName)))
	mux.HandleFunc("GET /api/v1/jobs", s.listJobs)
	mux.HandleFunc("GET /api/v1/companies", s.publicCompanies)
	mux.HandleFunc("GET /api/v1/companies/{companyID}", s.publicCompany)
	mux.HandleFunc("GET /api/v1/companies/{companyID}/reviews", s.publicCompanyReviews)
	mux.HandleFunc("GET /api/v1/jobs/{jobID}", s.getJob)
	mux.HandleFunc("GET /api/v1/profiles/{token}", s.publicCandidateProfile)
	mux.HandleFunc("GET /api/v1/privacy/subprocessors", s.publicSubprocessors)
	mux.HandleFunc("POST /api/v1/admin/collector/events", s.adminCollectorIngest)

	protected := func(next http.Handler) http.Handler {
		return Chain(next, Authenticate(tokens, cfg.Auth.AccessCookieName), RequireCurrentSession(authService), RequireCSRF(cfg.Auth.CSRFCookieName), s.companyMessagingGuard)
	}
	candidateOnly := RequireRoles(auth.RoleCandidate)
	recruiterOnly := func(next http.Handler) http.Handler {
		return Chain(next, RequireRoles(auth.RoleRecruiter), s.companyRecruiterGuard)
	}
	candidateActivity := CandidateActivity(candidateService, logger)
	adminOnly := MasterAdminOnly(tokens, cfg.Auth.AccessCookieName, adminService, logger)
	adminGuard := func(permissions ...admin.Permission) Middleware {
		return func(next http.Handler) http.Handler {
			if !cfg.Admin.AccessEnabled {
				return Chain(next, adminOnly, RequireCSRF(cfg.Auth.CSRFCookieName))
			}
			return Chain(next, adminOnly, scopedAdminPermission(adminService, logger, permissions...), RequireCSRF(cfg.Auth.CSRFCookieName))
		}
	}
	mux.Handle("GET /api/v1/admin/access", Chain(http.HandlerFunc(s.adminAccessStatus), adminGuard()))
	mux.Handle("GET /api/v1/admin/email-health", Chain(http.HandlerFunc(s.adminEmailHealth), adminGuard(admin.SystemRead)))
	mux.Handle("POST /api/v1/admin/security/mfa/enroll", Chain(http.HandlerFunc(s.adminMFA), adminGuard(), loginGuard))
	mux.Handle("POST /api/v1/admin/security/mfa/verify", Chain(http.HandlerFunc(s.adminMFA), adminGuard(), loginGuard))

	mux.Handle("GET /api/v1/auth/recovery-context", Chain(http.HandlerFunc(s.recoveryContext), protected))
	mux.HandleFunc("GET /api/v1/company/invitation", s.companyInvitation)
	mux.Handle("POST /api/v1/company/invitation/accept", Chain(http.HandlerFunc(s.companyInvitationAccept), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("GET /api/v1/company/access", Chain(http.HandlerFunc(s.companyAccess), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("GET /api/v1/candidate/company-reviews", Chain(http.HandlerFunc(s.candidateCompanyReviews), protected, candidateOnly))
	mux.Handle("POST /api/v1/candidate/company-reviews", Chain(http.HandlerFunc(s.candidateCompanyReviews), protected, candidateOnly))
	mux.Handle("PATCH /api/v1/candidate/company-reviews/{reviewID}", Chain(http.HandlerFunc(s.candidateCompanyReviews), protected, candidateOnly))
	mux.Handle("DELETE /api/v1/candidate/company-reviews/{reviewID}", Chain(http.HandlerFunc(s.candidateCompanyReviews), protected, candidateOnly))
	mux.Handle("POST /api/v1/company/reviews/{reviewID}/response", Chain(http.HandlerFunc(s.companyReviewResponse), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("POST /api/v1/reviews/{reviewID}/{action}", Chain(http.HandlerFunc(s.companyReviewAction), protected))
	mux.Handle("GET /api/v1/admin/company-reviews", Chain(http.HandlerFunc(s.adminCompanyReviews), adminGuard(admin.TrustRiskRead)))
	mux.Handle("PATCH /api/v1/admin/company-reviews/{reviewID}", Chain(http.HandlerFunc(s.adminCompanyReviews), adminGuard(admin.TrustRiskReview)))
	mux.Handle("GET /api/v1/company/workspace", Chain(http.HandlerFunc(s.companyWorkspace), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("GET /api/v1/company/jobs/{jobID}/hiring", Chain(http.HandlerFunc(s.companyHiringWork), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("POST /api/v1/company/jobs/{jobID}/interviews", Chain(http.HandlerFunc(s.companyHiringWork), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("PUT /api/v1/company/setup", Chain(http.HandlerFunc(s.companySetup), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("GET /api/v1/company/plan", Chain(http.HandlerFunc(s.companyPlan), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("PUT /api/v1/company/owner-talent-seat", Chain(http.HandlerFunc(s.companyOwnerTalentSeat), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("POST /api/v1/admin/companies/{companyID}/overrides", Chain(http.HandlerFunc(s.adminCompanyOverride), adminGuard(admin.OrganizationsReview)))
	mux.Handle("GET /api/v1/company/team", Chain(http.HandlerFunc(s.companyTeam), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("POST /api/v1/company/team", Chain(http.HandlerFunc(s.companyTeam), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("PATCH /api/v1/company/team/{userID}", Chain(http.HandlerFunc(s.companyMemberChange), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("GET /api/v1/company/team/{userID}/resources", Chain(http.HandlerFunc(s.companyMemberResources), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("DELETE /api/v1/company/invitations/{inviteID}", Chain(http.HandlerFunc(s.companyInviteRevoke), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("GET /api/v1/company/audit", Chain(http.HandlerFunc(s.companyAudit), protected, RequireRoles(auth.RoleRecruiter)))
	mux.Handle("POST /api/v1/admin/companies", Chain(http.HandlerFunc(s.adminCompanyCreate), adminGuard(admin.OrganizationsReview)))
	mux.Handle("POST /api/v1/admin/companies/{companyID}/owner-invitation", Chain(http.HandlerFunc(s.adminCompanyOwnerInvite), adminGuard(admin.OrganizationsReview)))
	mux.Handle("GET /api/v1/admin/companies/{companyID}/subscription", Chain(http.HandlerFunc(s.adminCompanySubscription), adminGuard(admin.OrganizationsRead)))
	mux.Handle("PUT /api/v1/admin/companies/{companyID}/subscription", Chain(http.HandlerFunc(s.adminCompanySubscription), adminGuard(admin.OrganizationsReview)))
	mux.Handle("GET /api/v1/auth/me", Chain(http.HandlerFunc(s.me), protected))
	mux.Handle("GET /api/v1/workforce/taxonomy/suggest", Chain(http.HandlerFunc(s.workforceTaxonomySuggest), protected))
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
	mux.Handle("PATCH /api/v1/candidate/profile/discovery", Chain(http.HandlerFunc(s.candidateDiscoveryVisibility), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/profile/photo", Chain(http.HandlerFunc(s.candidateProfilePhoto), protected, candidateOnly, candidateActivity))
	mux.Handle("POST /api/v1/candidate/profile/photo", Chain(http.HandlerFunc(s.candidatePhotoUpload), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/profile/photo", Chain(http.HandlerFunc(s.candidatePhotoGet), protected, candidateOnly, candidateActivity))
	mux.Handle("DELETE /api/v1/candidate/profile/photo", Chain(http.HandlerFunc(s.candidatePhotoRemove), protected, candidateOnly, candidateActivity))
	mux.Handle("POST /api/v1/candidate/profile/phone/request", Chain(http.HandlerFunc(s.candidatePhoneRequest), protected, candidateOnly, candidateActivity, otpGuard))
	mux.Handle("POST /api/v1/candidate/profile/phone/verify", Chain(http.HandlerFunc(s.candidatePhoneVerify), protected, candidateOnly, candidateActivity, otpGuard))
	mux.Handle("GET /api/v1/candidate/profile/metrics", Chain(http.HandlerFunc(s.candidateProfileMetrics), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/job-locations", Chain(http.HandlerFunc(s.candidateJobLocations), protected, candidateOnly, candidateActivity))
	mux.Handle("GET /api/v1/candidate/profile/details", Chain(http.HandlerFunc(s.candidateProfileDetails), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/profile/details", Chain(http.HandlerFunc(s.candidateProfileDetails), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/onboarding", Chain(http.HandlerFunc(s.candidateOnboarding), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/profile/contact-sharing", Chain(http.HandlerFunc(s.candidateContactSharing), protected, candidateOnly, candidateActivity))
	mux.Handle("POST /api/v1/candidate/cv/presign", Chain(http.HandlerFunc(s.candidateCVPresign), protected, candidateOnly, candidateActivity))
	if cfg.Environment != "production" && os.Getenv("CV_PARSE_PREVIEW_ENABLED") == "true" {
		mux.Handle("POST /api/v1/candidate/cv/parse-preview", Chain(http.HandlerFunc(s.candidateCVParsePreview), protected, candidateOnly, candidateActivity))
	}
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
	mux.Handle("GET /api/v1/candidate/notifications/inbox", Chain(http.HandlerFunc(s.candidateNotificationInbox), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/notifications/read-all", Chain(http.HandlerFunc(s.candidateNotificationReadAll), protected, candidateOnly, candidateActivity))
	mux.Handle("PATCH /api/v1/candidate/notifications/{notificationID}/read", Chain(http.HandlerFunc(s.candidateNotificationRead), protected, candidateOnly, candidateActivity))

	mux.Handle("GET /api/v1/recruiter/dashboard", Chain(http.HandlerFunc(s.recruiterDashboard), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/discover", Chain(http.HandlerFunc(s.recruiterDiscover), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/discover", Chain(http.HandlerFunc(s.recruiterDiscover), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/saved-searches", Chain(http.HandlerFunc(s.recruiterSavedSearches), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/saved-searches", Chain(http.HandlerFunc(s.recruiterSavedSearches), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/recent-searches", Chain(http.HandlerFunc(s.recruiterRecentSearches), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/company/branding", Chain(http.HandlerFunc(s.recruiterCompanyBranding), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/company/branding", Chain(http.HandlerFunc(s.recruiterCompanyBranding), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/team", Chain(http.HandlerFunc(s.recruiterTeam), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/jobs", Chain(http.HandlerFunc(s.recruiterJobs), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/jobs", Chain(http.HandlerFunc(s.recruiterJobs), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/jobs/bulk", Chain(http.HandlerFunc(s.recruiterBulkJobs), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/jobs/builder", Chain(http.HandlerFunc(s.recruiterJobBuilder), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/jobs/{jobID}", Chain(http.HandlerFunc(s.recruiterJobDetail), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}", Chain(http.HandlerFunc(s.recruiterJobDetail), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/status", Chain(http.HandlerFunc(s.recruiterJobStatus), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/jobs/{jobID}/duplicate", Chain(http.HandlerFunc(s.recruiterDuplicateJob), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/jobs/{jobID}/history", Chain(http.HandlerFunc(s.recruiterJobHistory), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/jobs/{jobID}/analytics", Chain(http.HandlerFunc(s.recruiterJobAnalytics), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/compensation", Chain(http.HandlerFunc(s.recruiterJobCompensation), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/skills", Chain(http.HandlerFunc(s.recruiterJobSkills), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/jobs/{jobID}/education", Chain(http.HandlerFunc(s.recruiterJobEducation), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/pipeline", Chain(http.HandlerFunc(s.recruiterPipeline), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/candidates/{candidateID}", Chain(http.HandlerFunc(s.recruiterCandidateDetail), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/candidates/{candidateID}/match", Chain(http.HandlerFunc(s.recruiterCandidateMatch), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/candidates/{candidateID}/cv", Chain(http.HandlerFunc(s.recruiterCandidateCVDownload), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/candidates/{candidateID}/contact", Chain(http.HandlerFunc(s.recruiterCandidateContact), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/candidates/{candidateID}/activity", Chain(http.HandlerFunc(s.recruiterCandidateActivity), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/candidates/{candidateID}/comments", Chain(http.HandlerFunc(s.recruiterCandidateComments), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/candidates/{candidateID}/comments", Chain(http.HandlerFunc(s.recruiterCandidateComments), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/candidates/{candidateID}/comments/{commentID}", Chain(http.HandlerFunc(s.recruiterCandidateComment), protected, recruiterOnly))
	mux.Handle("DELETE /api/v1/recruiter/candidates/{candidateID}/comments/{commentID}", Chain(http.HandlerFunc(s.recruiterCandidateComment), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/applications/{applicationID}/stage", Chain(http.HandlerFunc(s.recruiterApplicationStage), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/talent-pools", Chain(http.HandlerFunc(s.namedTalentPools), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/talent-pools", Chain(http.HandlerFunc(s.namedTalentPools), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/talent-pools/{poolID}/candidates", Chain(http.HandlerFunc(s.namedTalentPoolCandidates), protected, recruiterOnly))
	mux.Handle("PUT /api/v1/recruiter/talent-pools/{poolID}/candidates/{candidateID}", Chain(http.HandlerFunc(s.namedTalentPoolEntry), protected, recruiterOnly))
	mux.Handle("DELETE /api/v1/recruiter/talent-pools/{poolID}/candidates/{candidateID}", Chain(http.HandlerFunc(s.namedTalentPoolEntry), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/talent-pool", Chain(http.HandlerFunc(s.recruiterTalentPool), protected, recruiterOnly))
	mux.Handle("PUT /api/v1/recruiter/talent-pool/{candidateID}", Chain(http.HandlerFunc(s.recruiterTalentPoolCandidate), protected, recruiterOnly))
	mux.Handle("DELETE /api/v1/recruiter/talent-pool/{candidateID}", Chain(http.HandlerFunc(s.recruiterTalentPoolCandidate), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/interviews", Chain(http.HandlerFunc(s.recruiterInterviews), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/interviews", Chain(http.HandlerFunc(s.recruiterInterviews), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/interviews/{interviewID}", Chain(http.HandlerFunc(s.recruiterInterviewChange), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/interviews/{interviewID}/feedback", Chain(http.HandlerFunc(s.recruiterInterviewFeedback), protected, recruiterOnly))
	mux.Handle("PUT /api/v1/recruiter/interviews/{interviewID}/feedback", Chain(http.HandlerFunc(s.recruiterInterviewFeedback), protected, recruiterOnly))
	mux.Handle("PUT /api/v1/recruiter/interviews/{interviewID}/response", Chain(http.HandlerFunc(s.recruiterInterviewResponse), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/interviews/{interviewID}/history", Chain(http.HandlerFunc(s.recruiterInterviewHistory), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/notifications", Chain(http.HandlerFunc(s.recruiterNotifications), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/notifications/{notificationID}", Chain(http.HandlerFunc(s.recruiterNotificationChange), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/notifications/{notificationID}/open", Chain(http.HandlerFunc(s.recruiterNotificationOpen), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/notification-preferences", Chain(http.HandlerFunc(s.recruiterNotificationPreferences), protected, recruiterOnly))
	mux.Handle("PUT /api/v1/recruiter/notification-preferences", Chain(http.HandlerFunc(s.recruiterNotificationPreferences), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/offers", Chain(http.HandlerFunc(s.recruiterOffers), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/offers", Chain(http.HandlerFunc(s.recruiterOffers), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/offers/{offerID}", Chain(http.HandlerFunc(s.recruiterOfferStatus), protected, recruiterOnly))
	mux.Handle("POST /api/v1/referrals/lookup", Chain(http.HandlerFunc(s.publicReferralInvitation), otpGuard))
	mux.Handle("POST /api/v1/candidate/referrals", Chain(http.HandlerFunc(s.candidateReferralInvitation), protected, candidateOnly, otpGuard))
	mux.Handle("GET /api/v1/candidate/referral-invitations", Chain(http.HandlerFunc(s.candidateOwnedReferrals), protected, candidateOnly))
	mux.Handle("POST /api/v1/candidate/referral-invitations", Chain(http.HandlerFunc(s.candidateOwnedReferrals), protected, candidateOnly, otpGuard))
	mux.Handle("GET /api/v1/recruiter/referral-invitations", Chain(http.HandlerFunc(s.recruiterReferralInvitations), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/referral-invitations", Chain(http.HandlerFunc(s.recruiterReferralInvitations), protected, recruiterOnly, otpGuard))
	mux.Handle("POST /api/v1/recruiter/referral-invitations/{referralID}/actions", Chain(http.HandlerFunc(s.recruiterReferralInvitationAction), protected, recruiterOnly, otpGuard))
	mux.Handle("GET /api/v1/recruiter/referral-invitations/{referralID}/events", Chain(http.HandlerFunc(s.recruiterReferralInvitationEvents), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/referrals", Chain(http.HandlerFunc(s.recruiterReferrals), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/referrals", Chain(http.HandlerFunc(s.recruiterReferrals), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/referrals/{referralID}", Chain(http.HandlerFunc(s.recruiterReferralStatus), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/analytics", Chain(http.HandlerFunc(s.recruiterAnalytics), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/saved-searches/{searchID}/matches", Chain(http.HandlerFunc(s.recruiterSavedSearchMatches), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/saved-searches/{searchID}", Chain(http.HandlerFunc(s.recruiterSavedSearchAlert), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/saved-searches/{searchID}", Chain(http.HandlerFunc(s.recruiterSavedSearchAlert), protected, recruiterOnly))
	mux.Handle("DELETE /api/v1/recruiter/saved-searches/{searchID}", Chain(http.HandlerFunc(s.recruiterSavedSearchAlert), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/message-templates", Chain(http.HandlerFunc(s.recruiterMessageTemplates), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/message-templates", Chain(http.HandlerFunc(s.recruiterMessageTemplates), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/message-templates/{templateID}", Chain(http.HandlerFunc(s.recruiterMessageTemplate), protected, recruiterOnly))
	mux.Handle("DELETE /api/v1/recruiter/message-templates/{templateID}", Chain(http.HandlerFunc(s.recruiterMessageTemplate), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/inmail", Chain(http.HandlerFunc(s.recruiterInitiateInMail), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/inmail/bulk", Chain(http.HandlerFunc(s.recruiterBulkInMail), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/outreach/sequences", Chain(http.HandlerFunc(s.recruiterOutreachSequences), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/outreach/sequences", Chain(http.HandlerFunc(s.recruiterOutreachSequences), protected, recruiterOnly))
	mux.Handle("GET /api/v1/recruiter/outreach/campaigns", Chain(http.HandlerFunc(s.recruiterOutreachCampaigns), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/outreach/campaigns", Chain(http.HandlerFunc(s.recruiterOutreachCampaigns), protected, recruiterOnly))
	mux.Handle("POST /api/v1/recruiter/outreach/campaigns/{campaignID}/launch", Chain(http.HandlerFunc(s.recruiterOutreachCampaignLaunch), protected, recruiterOnly))
	mux.Handle("PATCH /api/v1/recruiter/outreach/campaigns/{campaignID}", Chain(http.HandlerFunc(s.recruiterOutreachCampaignStatus), protected, recruiterOnly))

	messagingUsers := RequireRoles(auth.RoleCandidate, auth.RoleRecruiter)
	mux.Handle("GET /api/v1/messaging/threads", Chain(http.HandlerFunc(s.messagingThreads), protected, messagingUsers, candidateActivity))
	mux.Handle("GET /api/v1/messaging/threads/{threadID}/messages", Chain(http.HandlerFunc(s.messagingMessages), protected, messagingUsers, candidateActivity))
	mux.Handle("POST /api/v1/messaging/threads/{threadID}/messages", Chain(http.HandlerFunc(s.messagingMessages), protected, messagingUsers, candidateActivity))
	mux.Handle("PATCH /api/v1/messaging/threads/{threadID}/read", Chain(http.HandlerFunc(s.messagingRead), protected, messagingUsers, candidateActivity))
	mux.Handle("GET /api/v1/messaging/inbox/ws", Chain(http.HandlerFunc(s.messagingInboxSocket), protected, messagingUsers, candidateActivity))
	mux.Handle("GET /api/v1/messaging/threads/{threadID}/ws", Chain(http.HandlerFunc(s.messagingSocket), protected, messagingUsers, candidateActivity))

	mux.Handle("GET /api/v1/admin/metrics", Chain(http.HandlerFunc(s.adminMetrics), adminGuard(admin.OverviewRead, admin.SystemRead)))
	mux.Handle("GET /api/v1/admin/dashboard", Chain(http.HandlerFunc(s.adminDashboard), adminGuard(admin.OverviewRead)))
	mux.Handle("GET /api/v1/admin/applications", Chain(http.HandlerFunc(s.adminApplications), adminGuard(admin.RecruitmentRead)))
	mux.Handle("GET /api/v1/admin/interviews", Chain(http.HandlerFunc(s.adminInterviews), adminGuard(admin.RecruitmentRead)))
	mux.Handle("GET /api/v1/admin/applications/{applicationID}/history", Chain(http.HandlerFunc(s.adminApplicationHistory), adminGuard(admin.RecruitmentRead)))
	mux.Handle("GET /api/v1/admin/company-verifications", Chain(http.HandlerFunc(s.adminCompanyVerifications), adminGuard(admin.OrganizationsRead)))
	mux.Handle("GET /api/v1/admin/company-verifications/{verificationID}/document", Chain(http.HandlerFunc(s.adminRegistrationDocument), adminGuard(admin.OrganizationsDocuments)))
	mux.Handle("POST /api/v1/admin/company-verifications/{verificationID}/approve", Chain(http.HandlerFunc(s.adminApproveCompany), adminGuard(admin.OrganizationsReview)))
	mux.Handle("POST /api/v1/admin/company-verifications/{verificationID}/reject", Chain(http.HandlerFunc(s.adminRejectCompany), adminGuard(admin.OrganizationsReview)))
	mux.Handle("GET /api/v1/admin/users", Chain(http.HandlerFunc(s.adminUsers), adminGuard(admin.UsersRead)))
	mux.Handle("GET /api/v1/admin/users/{userID}/summary", Chain(http.HandlerFunc(s.adminAccountSummary), adminGuard(admin.UsersRead)))
	mux.Handle("GET /api/v1/admin/organizations", Chain(http.HandlerFunc(s.adminOrganizations), adminGuard(admin.OrganizationsRead)))
	mux.Handle("POST /api/v1/admin/users/{userID}/reactivate", Chain(http.HandlerFunc(s.adminReactivateUser), adminGuard(admin.UsersModerate)))
	mux.Handle("POST /api/v1/admin/users/{userID}/revoke-sessions", Chain(http.HandlerFunc(s.adminRevokeUserSessions), adminGuard(admin.UsersModerate)))
	mux.Handle("POST /api/v1/admin/users/{userID}/suspend", Chain(http.HandlerFunc(s.adminSuspendUser), adminGuard(admin.UsersModerate)))
	mux.Handle("POST /api/v1/admin/users/{userID}/force-password-reset", Chain(http.HandlerFunc(s.adminForcePasswordReset), adminGuard(admin.UsersModerate)))
	mux.Handle("GET /api/v1/admin/jobs", Chain(http.HandlerFunc(s.adminJobs), adminGuard(admin.JobsRead)))
	mux.Handle("POST /api/v1/admin/jobs/{jobID}/takedown", Chain(http.HandlerFunc(s.adminTakedownJob), adminGuard(admin.JobsModerate)))
	mux.Handle("GET /api/v1/admin/audit-logs", Chain(http.HandlerFunc(s.adminAuditLogs), adminGuard(admin.AuditRead)))
	mux.Handle("GET /api/v1/admin/budget-settings", Chain(http.HandlerFunc(s.adminBudgetSettings), adminGuard(admin.SystemRead)))
	mux.Handle("PATCH /api/v1/admin/budget-settings", Chain(http.HandlerFunc(s.adminBudgetSettings), adminGuard(admin.SystemConfigure)))
	mux.Handle("GET /api/v1/admin/privacy/requests", Chain(http.HandlerFunc(s.adminPrivacyRequests), adminGuard(admin.PrivacyRead)))
	mux.Handle("PATCH /api/v1/admin/privacy/requests/{requestID}/status", Chain(http.HandlerFunc(s.adminPrivacyRequestTransition), adminGuard(admin.PrivacyManage)))
	mux.Handle("GET /api/v1/admin/privacy/incidents", Chain(http.HandlerFunc(s.adminPrivacyIncidents), adminGuard(admin.PrivacyRead)))
	mux.Handle("GET /api/v1/admin/privacy/subprocessors", Chain(http.HandlerFunc(s.adminPrivacySubprocessors), adminGuard(admin.PrivacyRead)))
	mux.Handle("GET /api/v1/admin/privacy/processing-activities", Chain(http.HandlerFunc(s.adminPrivacyProcessingActivities), adminGuard(admin.PrivacyRead)))
	mux.Handle("GET /api/v1/admin/control-plane", Chain(http.HandlerFunc(s.adminControlPlane), adminGuard(admin.ControlPlaneRead)))
	mux.Handle("GET /api/v1/admin/runtime-snapshot", Chain(http.HandlerFunc(s.adminRuntimeSnapshot), adminGuard(admin.SystemRead)))
	mux.Handle("GET /api/v1/admin/alerts", Chain(http.HandlerFunc(s.adminAlerts), adminGuard(admin.ControlPlaneRead)))
	mux.Handle("POST /api/v1/admin/alerts/evaluate", Chain(http.HandlerFunc(s.adminEvaluateAlerts), adminGuard(admin.ControlPlaneManage)))
	mux.Handle("PATCH /api/v1/admin/alerts/{alertID}", Chain(http.HandlerFunc(s.adminAlertTransition), adminGuard(admin.ControlPlaneManage)))
	mux.Handle("GET /api/v1/admin/workforce-taxonomy", Chain(http.HandlerFunc(s.adminWorkforceTaxonomy), adminGuard(admin.TaxonomyRead)))
	mux.Handle("POST /api/v1/admin/workforce-taxonomy/provisional/{termID}/resolve", Chain(http.HandlerFunc(s.adminResolveWorkforceTaxonomyTerm), adminGuard(admin.TaxonomyManage)))
	mux.Handle("GET /api/v1/admin/trust/risk-flags", Chain(http.HandlerFunc(s.adminTrustRiskFlags), adminGuard(admin.TrustRiskRead)))
	mux.Handle("PATCH /api/v1/admin/trust/risk-flags/{flagID}", Chain(http.HandlerFunc(s.adminTrustRiskReview), adminGuard(admin.TrustRiskReview)))
	mux.Handle("GET /api/v1/admin/intelligence", Chain(http.HandlerFunc(s.adminIntelligence), adminGuard(admin.IntelligenceRead, admin.IntelligenceMetricsRead)))
	mux.Handle("POST /api/v1/admin/intelligence/run", Chain(http.HandlerFunc(s.adminRunIntelligence), adminGuard(admin.IntelligenceModelsEvaluate)))
	mux.Handle("PATCH /api/v1/admin/intelligence/insights/{insightID}", Chain(http.HandlerFunc(s.adminReviewIntelligenceInsight), adminGuard(admin.IntelligenceFeedbackReview)))
	mux.Handle("PATCH /api/v1/admin/intelligence/reviews/{reviewID}", Chain(http.HandlerFunc(s.adminReviewIntelligenceCase), adminGuard(admin.IntelligenceFeedbackReview)))
	mux.Handle("PATCH /api/v1/admin/intelligence/switches/{switchKey}", Chain(http.HandlerFunc(s.adminUpdateIntelligenceSwitch), adminGuard(admin.IntelligenceKillSwitch)))
	mux.Handle("POST /api/v1/admin/intelligence/models", Chain(http.HandlerFunc(s.adminRegisterIntelligenceModel), adminGuard(admin.IntelligenceConfigUpdate)))
	mux.Handle("POST /api/v1/admin/intelligence/models/{modelID}/evaluate", Chain(http.HandlerFunc(s.adminRequestIntelligenceModelEvaluation), adminGuard(admin.IntelligenceModelsEvaluate)))
	mux.Handle("POST /api/v1/admin/intelligence/models/{modelID}/promote", Chain(http.HandlerFunc(s.adminPromoteIntelligenceModel), adminGuard(admin.IntelligenceModelsApprove)))
	mux.Handle("POST /api/v1/admin/intelligence/prompts", Chain(http.HandlerFunc(s.adminRegisterIntelligencePrompt), adminGuard(admin.IntelligenceConfigUpdate)))
	mux.Handle("POST /api/v1/admin/intelligence/prompts/{promptID}/activate", Chain(http.HandlerFunc(s.adminActivateIntelligencePrompt), adminGuard(admin.IntelligencePromptsApprove)))
	mux.Handle("POST /api/v1/admin/control-plane/approvals", Chain(http.HandlerFunc(s.adminCreateApproval), adminGuard(admin.ControlPlaneManage)))
	mux.Handle("POST /api/v1/admin/control-plane/approvals/{approvalID}/decisions", Chain(http.HandlerFunc(s.adminDecideApproval), adminGuard(admin.ControlPlaneManage)))
	mux.Handle("POST /api/v1/admin/control-plane/cases", Chain(http.HandlerFunc(s.adminCreateCase), adminGuard(admin.ControlPlaneManage)))
	mux.Handle("PATCH /api/v1/admin/control-plane/cases/{caseID}", Chain(http.HandlerFunc(s.adminUpdateCase), adminGuard(admin.ControlPlaneManage)))
	mux.Handle("GET /api/v1/admin/control-plane/cases/{caseID}/history", Chain(http.HandlerFunc(s.adminCaseHistory), adminGuard(admin.ControlPlaneRead)))
	mux.Handle("POST /api/v1/admin/control-plane/organization-reviews", Chain(http.HandlerFunc(s.adminCreateOrganizationGovernanceReview), adminGuard(admin.ControlPlaneManage)))
	mux.Handle("POST /api/v1/admin/control-plane/knowledge", Chain(http.HandlerFunc(s.adminKnowledgeArticle), adminGuard(admin.ContentManage)))
	mux.Handle("PUT /api/v1/admin/control-plane/settings", Chain(http.HandlerFunc(s.adminOperationalSetting), adminGuard(admin.SystemConfigure)))
	mux.Handle("POST /api/v1/admin/control-plane/operation-evidence", Chain(http.HandlerFunc(s.adminOperationEvidence), adminGuard(admin.SystemConfigure)))
	mux.Handle("POST /api/v1/admin/control-plane/cost-snapshots", Chain(http.HandlerFunc(s.adminCostSnapshot), adminGuard(admin.SystemConfigure)))
	mux.Handle("POST /api/v1/admin/control-plane/releases", Chain(http.HandlerFunc(s.adminCreateReleaseAcceptance), adminGuard(admin.ReleaseManage)))
	mux.Handle("PATCH /api/v1/admin/control-plane/releases/{releaseID}", Chain(http.HandlerFunc(s.adminUpdateReleaseAcceptance), adminGuard(admin.ReleaseManage)))

	handler := Chain(mux, TrustedProxyRemoteAddr(cfg.HTTP.TrustedProxyCIDRs), RequestID, Recover(logger), AccessLog(logger), SecurityHeaders, CORS(cfg.HTTP.AllowedOrigins), CandidateUploadBodyLimit(cfg.HTTP.MaxBodyBytes))
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
