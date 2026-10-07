package httpserver

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

func recruiterID(r *http.Request) (string, bool) {
	claims, ok := ClaimsFromContext(r.Context())
	return claims.Subject, ok
}

func (s *Server) recruiterDiscover(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	values := map[string]string{}
	if r.Method == http.MethodPost {
		var input struct {
			Filters map[string]string `json:"filters"`
		}
		if !decodeJSON(w, r, &input) {
			return
		}
		values = input.Filters
	} else {
		for key, items := range r.URL.Query() {
			if len(items) != 1 {
				s.writeRecruiterError(w, r, recruiter.ErrInvalid)
				return
			}
			values[key] = items[0]
		}
	}
	filters, err := recruiter.ParseDiscoveryFilters(values)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	result, err := s.recruiter.Discover(r.Context(), id, filters)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	if len(values) > 0 {
		record := map[string]any{}
		for key, value := range values {
			if key != "page" && key != "page_size" && strings.TrimSpace(value) != "" {
				record[key] = value
			}
		}
		if len(record) > 0 {
			_ = s.recruiter.RecordSearch(r.Context(), id, record)
		}
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) recruiterDashboard(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	result, err := s.recruiter.Dashboard(r.Context(), id)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func recruiterJobWorkspaceFiltersFromRequest(r *http.Request) (recruiter.JobWorkspaceFilters, error) {
	q := r.URL.Query()
	page := 1
	limit := 20
	var err error
	if raw := strings.TrimSpace(q.Get("page")); raw != "" {
		page, err = strconv.Atoi(raw)
		if err != nil || page < 1 {
			return recruiter.JobWorkspaceFilters{}, recruiter.ErrInvalid
		}
	}
	if raw := strings.TrimSpace(q.Get("limit")); raw != "" {
		limit, err = strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 50 {
			return recruiter.JobWorkspaceFilters{}, recruiter.ErrInvalid
		}
	}
	return recruiter.JobWorkspaceFilters{
		Query:          q.Get("q"),
		Status:         q.Get("status"),
		EmploymentType: q.Get("employment_type"),
		WorkMode:       q.Get("work_mode"),
		RoleCategory:   q.Get("role_category"),
		Deadline:       q.Get("deadline"),
		Sort:           q.Get("sort"),
		Page:           page,
		Limit:          limit,
	}, nil
}

func (s *Server) recruiterJobs(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		filters, err := recruiterJobWorkspaceFiltersFromRequest(r)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		result, err := s.recruiter.JobWorkspace(r.Context(), id, filters)
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, result)
		return
	}
	var input recruiter.JobInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.recruiter.CreateJobEfficient(r.Context(), id, input)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterJobDetail(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	if r.Method == http.MethodGet {
		item, err := s.recruiter.EditableJob(r.Context(), id, r.PathValue("jobID"))
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, item)
		return
	}
	var input recruiter.DetailedJobInput
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.UpdateDetailedJob(r.Context(), id, r.PathValue("jobID"), input); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterJobStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.SetJobStatus(r.Context(), id, r.PathValue("jobID"), strings.TrimSpace(input.Status)); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterJobCompensation(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input recruiter.JobCompensationInput
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.SetJobCompensation(r.Context(), id, r.PathValue("jobID"), input); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterPipeline(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	q := r.URL.Query()
	intFilter := func(name string) int { value, _ := strconv.Atoi(q.Get(name)); return value }
	filters := recruiter.PipelineFilters{
		Query: q.Get("q"), ExcludeQuery: q.Get("exclude_q"), Stages: q["stage"],
		JobID: q.Get("job_id"), Attention: q.Get("attention"), CandidateID: q.Get("candidate_id"), Source: q.Get("source"),
		CurrentCompany: q.Get("current_company"), PreviousCompany: q.Get("previous_company"),
		Location: q.Get("location"), Designation: q.Get("designation"),
		Education: q.Get("education"), University: q.Get("university"),
		MinExperienceYears: intFilter("min_experience_years"), MaxExperienceYears: intFilter("max_experience_years"), MaxExperienceSet: q.Get("max_experience_years") != "",
		MaxNoticeDays: intFilter("max_notice_days"), ImmediateNotice: q.Get("max_notice_days") == "0", AppliedWithinDays: intFilter("applied_within_days"),
		ActiveWithinDays: intFilter("active_within_days"), UpdatedWithinDays: intFilter("updated_within_days"),
		HasCV: q.Get("has_cv") == "true", Sort: q.Get("sort"),
	}
	result, err := s.recruiter.Pipeline(r.Context(), id, filters, page, limit)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) recruiterCandidateDetail(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	result, err := s.recruiter.CandidateDetail(r.Context(), id, r.PathValue("candidateID"))
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) recruiterCandidateMatch(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	jobID := strings.TrimSpace(r.URL.Query().Get("job_id"))
	if jobID == "" {
		s.writeRecruiterError(w, r, recruiter.ErrInvalid)
		return
	}
	result, err := s.recruiter.CandidateMatch(r.Context(), id, r.PathValue("candidateID"), jobID)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) recruiterApplicationStage(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input struct {
		Stage string `json:"stage"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.UpdateStage(r.Context(), id, r.PathValue("applicationID"), strings.TrimSpace(input.Stage)); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterInterviews(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	if r.Method == http.MethodGet {
		items, err := s.recruiter.InterviewsForJob(r.Context(), id, r.URL.Query().Get("job_id"))
		if err != nil {
			s.writeRecruiterError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input recruiter.InterviewInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.recruiter.ScheduleInterviewEfficient(r.Context(), id, input)
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (s *Server) recruiterInterviewChange(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	var input recruiter.InterviewChangeInput
	if !decodeJSON(w, r, &input) {
		return
	}
	if err := s.recruiter.ChangeInterview(r.Context(), id, r.PathValue("interviewID"), input); err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) recruiterInterviewHistory(w http.ResponseWriter, r *http.Request) {
	id, ok := recruiterID(r)
	if !ok {
		return
	}
	items, err := s.recruiter.InterviewHistory(r.Context(), id, r.PathValue("interviewID"))
	if err != nil {
		s.writeRecruiterError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *Server) writeRecruiterError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, recruiter.ErrReferralRateLimited):
		w.Header().Set("Retry-After", "86400")
		writeError(w, r, http.StatusTooManyRequests, "referral_limit", "You can invite up to 10 people in 24 hours. Please try later.")
	case errors.Is(err, recruiter.ErrReferralUnavailable):
		writeError(w, r, http.StatusNotFound, "referral_unavailable", "This invitation is unavailable, expired or belongs to a different verified email.")
	case errors.Is(err, recruiter.ErrReferralDuplicate):
		writeError(w, r, http.StatusConflict, "referral_duplicate", "A referral or application already exists for this person and job. Existing attribution is retained.")
	case errors.Is(err, recruiter.ErrReferralNotReady):
		writeError(w, r, http.StatusConflict, "referral_profile_incomplete", "Complete required profile information, accept the invitation and confirm application consent first.")
	case errors.Is(err, recruiter.ErrNotFound):
		writeError(w, r, http.StatusNotFound, "not_found", "recruiter resource was not found or is unavailable")
	case errors.Is(err, recruiter.ErrSearchRestricted):
		writeError(w, r, http.StatusForbidden, "search_policy_required", "This criterion is unavailable under the current tenant policy. Private compensation and protected attributes cannot be used in general talent search.")
	case errors.Is(err, recruiter.ErrInvalid):
		writeError(w, r, http.StatusBadRequest, "validation_error", "invalid recruiter workspace input")
	default:
		s.logger.Error("recruiter operation failed", "error", err, "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusInternalServerError, "internal_error", "recruiter operation failed")
	}
}
