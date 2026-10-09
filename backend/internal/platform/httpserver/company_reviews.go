package httpserver

import (
	"github.com/TechiAkki963/SapienWorx/backend/internal/company"
	"net/http"
	"strconv"
)

func (s *Server) publicCompanies(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	page := 1
	if raw := r.URL.Query().Get("page"); raw != "" {
		n, e := strconv.Atoi(raw)
		if e != nil {
			s.writeCompanyError(w, r, company.ErrInvalid)
			return
		}
		page = n
	}
	items, total, err := s.company.PublicCompanies(r.Context(), r.URL.Query().Get("q"), page)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"items": items, "total": total, "page": page, "limit": 20})
}
func (s *Server) publicCompany(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	id := r.PathValue("companyID")
	c, err := s.company.PublicCompany(r.Context(), id)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	jobs, err := s.company.PublicJobs(r.Context(), id)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	ratings, err := s.company.CategoryRatings(r.Context(), id)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"company": c, "jobs": jobs, "category_ratings": ratings})
}
func (s *Server) publicCompanyReviews(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	id := r.PathValue("companyID")
	if _, err := s.company.PublicCompany(r.Context(), id); err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	q := r.URL.Query()
	f := company.ReviewFilter{Kind: q.Get("kind"), Location: q.Get("location"), JobFunction: q.Get("job_function"), Sort: q.Get("sort"), Page: 1}
	var err error
	if q.Get("page") != "" {
		f.Page, err = strconv.Atoi(q.Get("page"))
		if err != nil {
			s.writeCompanyError(w, r, company.ErrInvalid)
			return
		}
	}
	if q.Get("rating") != "" {
		f.Rating, err = strconv.Atoi(q.Get("rating"))
		if err != nil {
			s.writeCompanyError(w, r, company.ErrInvalid)
			return
		}
	}
	items, total, err := s.company.PublicReviews(r.Context(), id, f)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 200, map[string]any{"items": items, "total": total, "page": f.Page, "limit": 20})
}
func (s *Server) candidateCompanyReviews(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	if r.Method == "GET" {
		items, err := s.company.OwnReviews(r.Context(), claims.Subject)
		if err != nil {
			s.writeCompanyError(w, r, err)
			return
		}
		writeJSON(w, 200, map[string]any{"items": items})
		return
	}
	if r.Method == "DELETE" {
		if err := s.company.DeleteReview(r.Context(), claims.Subject, r.PathValue("reviewID")); err != nil {
			s.writeCompanyError(w, r, err)
			return
		}
		w.WriteHeader(204)
		return
	}
	var input company.ReviewInput
	if !decodeJSON(w, r, &input) {
		return
	}
	id, err := s.company.SaveReview(r.Context(), claims.Subject, r.PathValue("reviewID"), input)
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	writeJSON(w, 201, map[string]string{"id": id, "status": "pending_moderation"})
}
func (s *Server) companyReviewResponse(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	var in struct {
		Body string `json:"body"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := s.company.ReviewResponse(r.Context(), claims.Subject, r.PathValue("reviewID"), in.Body); err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
func (s *Server) companyReviewAction(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	id := r.PathValue("reviewID")
	if r.PathValue("action") != "helpful" && r.PathValue("action") != "report" {
		s.writeCompanyError(w, r, company.ErrNotFound)
		return
	}
	var err error
	if r.PathValue("action") == "helpful" {
		err = s.company.ReviewVote(r.Context(), claims.Subject, id)
	} else {
		var in struct {
			Kind   string `json:"kind"`
			Reason string `json:"reason"`
		}
		if !decodeJSON(w, r, &in) {
			return
		}
		err = s.company.ReportReview(r.Context(), claims.Subject, id, in.Kind, in.Reason)
	}
	if err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
func (s *Server) adminCompanyReviews(w http.ResponseWriter, r *http.Request) {
	if !s.companyAvailable(w, r) {
		return
	}
	if r.Method == "GET" {
		items, err := s.company.ModerationQueue(r.Context())
		if err != nil {
			s.writeCompanyError(w, r, err)
			return
		}
		writeJSON(w, 200, map[string]any{"items": items})
		return
	}
	claims, _ := ClaimsFromContext(r.Context())
	var in company.ModerationInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := s.company.ModerateReview(r.Context(), claims.Subject, r.PathValue("reviewID"), in); err != nil {
		s.writeCompanyError(w, r, err)
		return
	}
	w.WriteHeader(204)
}
