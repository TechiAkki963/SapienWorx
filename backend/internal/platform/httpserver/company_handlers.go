package httpserver

import (
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/jackc/pgx/v5/pgconn"
	"net/http"
	"strings"
)

func (s *Server) companyHiringWork(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	m, err := s.company.Member(r.Context(), claims.Subject)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	job := r.PathValue("jobID")
	if r.Method == http.MethodGet {
		work, err := s.company.HiringWork(r.Context(), m, job)
		if err != nil {
			s.writeCompanyError(w, r, err)
			return
		}
		writeJSON(w, 200, work)
		return
	}
	if !m.Can("interviews.manage") || !s.company.JobAllowed(r.Context(), m, job) {
		s.writeCompanyError(w, r, company.ErrNotFound)
		return
	}
	var in recruiter.InterviewInput
	if !decodeJSON(w, r, &in) {
		return
	}
	applicationJob, err := s.company.ResourceJob(r.Context(), m.CompanyID, "application", in.ApplicationID)
	if err != nil || applicationJob != job {
		s.writeCompanyError(w, r, company.ErrNotFound)
		return
	}
	item, err := s.recruiter.ScheduleInterviewEfficient(r.Context(), claims.Subject, in)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, 201, item)
}

func (s *Server) writeCompanyError(w http.ResponseWriter, r *http.Request, err error) {
	var sqlError *pgconn.PgError
	if errors.As(err, &sqlError) && (sqlError.Code == "22P02" || sqlError.Code == "23514" || sqlError.Code == "23505") {
		err = company.ErrInvalid
	}
	code, status, message := "company_unavailable", 503, "Company service is temporarily unavailable."
	switch {
	case errors.Is(err, company.ErrPrivateContent):
		code, status, message = "company_review_private_content", 400, "The review contains contact details or links. Ask the reviewer to remove them before publication."
	case errors.Is(err, company.ErrReviewExists):
		code, status, message = "company_review_exists", 409, "You already have a review for this company and experience type. Edit your existing review."
	case errors.Is(err, company.ErrNotFound):
		code, status, message = "not_found", 404, "This company resource is unavailable."
	case errors.Is(err, company.ErrForbidden):
		code, status, message = "company_forbidden", 403, "You do not have permission for this company action."
	case errors.Is(err, company.ErrInvalid):
		code, status, message = "company_invalid", 400, "Check the company fields, scope and required reason."
	case errors.Is(err, company.ErrInactive):
		code, status, message = "talent_inactive", 403, "Talent subscription inactive. Your hiring records and sourcing history are preserved. Contact your Company Admin."
	case errors.Is(err, company.ErrLimit):
		code, status, message = "allocation_reached", 409, "The approved company allocation has been reached. Contact your Company Admin."
	}
	writeError(w, r, status, code, message)
}

func (s *Server) adminCompanyOverride(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	var input company.Override
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.company.GrantOverride(r.Context(), claims.Subject, r.PathValue("companyID"), input); err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
func (s *Server) companyOwnerTalentSeat(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	var input struct {
		Enabled bool   `json:"enabled"`
		Reason  string `json:"reason"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.company.OwnTalentSeat(r.Context(), claims.Subject, input.Enabled, input.Reason); err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
func (s *Server) companyAvailable(w http.ResponseWriter, r *http.Request) bool {
	w.Header().Set("Cache-Control", "no-store")
	if s.company == nil {
		s.writeCompanyError(w, r, errors.New("not configured"))
		return false
	}
	return true
}
func (s *Server) companyAccess(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	m, err := s.company.Member(r.Context(), claims.Subject)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	e, err := company.NewService(s.company).Effective(r.Context(), m.CompanyID)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	if m.Owner() {
		writeJSON(w, 200, map[string]any{"member": m, "entitlements": e})
		return
	}
	writeJSON(w, 200, map[string]any{"member": m, "entitlements": map[string]any{"state": e.State, "features": e.Features, "data_preserved": true}})
}
func (s *Server) companyWorkspace(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	m, err := s.company.Member(r.Context(), claims.Subject)
	if err != nil || m.Status != "active" {
		s.writeCompanyError(w, r, company.ErrForbidden)
		return
	}
	work, err := s.company.ScopedWork(r.Context(), m)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	payload := map[string]any{"member": m, "jobs": work}
	if m.Owner() {
		setup, err := s.company.Setup(r.Context(), m.CompanyID)
		if err != nil {
			s.writeCompanyError(w, r, err)
			return
		}
		payload["setup"] = setup
	}
	writeJSON(w, 200, payload)
}
func (s *Server) companySetup(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	var input company.Setup
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.company.SaveSetup(r.Context(), claims.Subject, input); err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
func (s *Server) companyPlan(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	m, err := s.company.Owner(r.Context(), claims.Subject)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	policy, grants, err := s.company.Subscription(r.Context(), m.CompanyID)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	usage, err := s.company.Usage(r.Context(), m.CompanyID)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	e, err := company.NewService(s.company).Effective(r.Context(), m.CompanyID)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	capacity, err := s.company.CapacityUsage(r.Context(), m.CompanyID)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"policy": policy, "entitlements": e, "usage": usage, "capacity_usage": capacity, "overrides": grants})
}
func (s *Server) companyTeam(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	if r.Method == http.MethodGet {
		members, invites, err := s.company.Team(r.Context(), claims.Subject)
		if err != nil {
			s.writeCompanyError(w, r, err)
			return
		}
		writeJSON(w, 200, map[string]any{"members": members, "invitations": invites})
		return
	}
	m, err := s.company.Member(r.Context(), claims.Subject)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	var input company.InviteInput
	if !decodeJSON(w, r, &input) {
		return
	}
	id, err := s.company.Invite(r.Context(), claims.Subject, m.CompanyID, input, []byte(s.cfg.Auth.JWTSecret), false)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 201, map[string]string{"id": id, "status": "invitation_queued"})
}
func (s *Server) companyMemberResources(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	resources, err := s.company.OwnedResources(r.Context(), claims.Subject, r.PathValue("userID"))
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 200, resources)
}
func (s *Server) companyMemberChange(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	var input company.MemberChange
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.company.ChangeMember(r.Context(), claims.Subject, r.PathValue("userID"), input); err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
func (s *Server) companyInviteRevoke(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	if err := s.company.RevokeInvite(r.Context(), claims.Subject, r.PathValue("inviteID")); err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
func (s *Server) companyInvitation(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	i, err := s.company.Invitation(r.Context(), r.URL.Query().Get("token"))
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"company_name": i.CompanyName, "email": i.Email, "name": i.Name, "role": i.Role, "expires_at": i.ExpiresAt})
}
func (s *Server) companyInvitationAccept(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	var in struct {
		Token string `json:"token"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := s.company.AcceptInvitation(r.Context(), claims.Subject, in.Token); err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
func (s *Server) companyAudit(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	items, err := s.company.Audit(r.Context(), claims.Subject)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"items": items})
}
func (s *Server) adminCompanyCreate(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	var input company.CreateCompanyInput
	if !decodeJSON(w, r, &input) {
		return
	}
	id, err := s.company.CreateCompany(r.Context(), claims.Subject, input)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 201, map[string]string{"id": id})
}
func (s *Server) adminCompanyOwnerInvite(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	var input company.InviteInput
	if !decodeJSON(w, r, &input) {
		return
	}
	input.Role = "primary_admin"
	input.Scope = company.Scope{All: true}
	id, err := s.company.Invite(r.Context(), claims.Subject, r.PathValue("companyID"), input, []byte(s.cfg.Auth.JWTSecret), true)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 201, map[string]string{"id": id, "status": "invitation_queued"})
}
func (s *Server) adminCompanySubscription(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	id := r.PathValue("companyID")
	if r.Method == http.MethodPut {
		claims, _ := ClaimsFromContext(r.Context())
		var input struct {
			Policy company.Subscription `json:"policy"`
			Reason string               `json:"reason"`
		}
		if !decodeJSON(w, r, &input) {
			return
		}
		input.Policy.CompanyID = id
		if err := s.company.SetSubscription(r.Context(), claims.Subject, input.Policy, strings.TrimSpace(input.Reason)); err != nil {
			s.writeCompanyError(w, r, err)
			return
		}
	}
	policy, grants, err := s.company.Subscription(r.Context(), id)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	usage, err := s.company.Usage(r.Context(), id)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	e, err := company.NewService(s.company).Effective(r.Context(), id)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"policy": policy, "overrides": grants, "entitlements": e, "usage": usage})
}
