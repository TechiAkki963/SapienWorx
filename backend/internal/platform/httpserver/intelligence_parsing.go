package httpserver

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/parsing"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/TechiAkki963/SapienWorx/backend/internal/resume"
)

func (s *Server) SetAIParsing(service *parsing.Service) { s.aiParsing = service }
func (s *Server) aiContext(w http.ResponseWriter, r *http.Request) (context.Context, bool) {
	return s.aiRequestContext(w, r, true)
}

func (s *Server) aiRequestContext(w http.ResponseWriter, r *http.Request, requireParsing bool) (context.Context, bool) {
	w.Header().Set("Cache-Control", "no-store")
	claims, ok := ClaimsFromContext(r.Context())
	if !ok || requireParsing && s.aiParsing == nil {
		writeError(w, r, 503, "ai_unavailable", "AI parsing is unavailable; use manual entry.")
		return nil, false
	}
	// HTTP correlation headers are caller supplied/non-UUID. Mint a separate
	// trusted operation UUID instead of logging arbitrary header text in AI telemetry.
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		writeError(w, r, 503, "ai_unavailable", "AI parsing is unavailable.")
		return nil, false
	}
	id[6] = (id[6] & 15) | 64
	id[8] = (id[8] & 63) | 128
	scope := gateway.Scope{UserID: claims.Subject, RequestID: fmt.Sprintf("%x-%x-%x-%x-%x", id[:4], id[4:6], id[6:8], id[8:10], id[10:]), Role: string(claims.Role)}
	if scope.Role == "recruiter" {
		if s.company == nil {
			writeError(w, r, 403, "ai_forbidden", "Company access is required.")
			return nil, false
		}
		member, err := s.company.Member(r.Context(), claims.Subject)
		if err != nil || member.Status != "active" || !member.Can("jobs.manage") {
			writeError(w, r, 403, "ai_forbidden", "Job management access is required.")
			return nil, false
		}
		scope.TenantID = member.CompanyID
	} else if scope.Role != "candidate" {
		writeError(w, r, 403, "ai_forbidden", "Parsing access is unavailable.")
		return nil, false
	}
	return gateway.WithScope(r.Context(), scope), true
}

// aiCapabilities checks the same trusted role/company/model/cohort gates as
// generation, without reserving budget, reading private proposals or calling a
// provider. Ordinary users receive no secret/configuration or cohort metadata.
func (s *Server) aiCapabilities(w http.ResponseWriter, r *http.Request) {
	ctx, ok := s.aiRequestContext(w, r, false)
	if !ok {
		return
	}
	type capability struct {
		Available bool `json:"available"`
	}
	features := map[string]capability{}
	for name, feature := range map[string]gateway.Feature{
		"cv.parse": gateway.CVParser, "job.parse": gateway.JDParser,
		"job.generate_description": gateway.JDGenerator,
	} {
		available := s.aiGateway != nil && s.aiParsing != nil
		if feature == gateway.CVParser && os.Getenv("CV_CLAMD_ADDRESS") == "" {
			available = false
		}
		if available {
			available = s.aiGateway.Authorize(ctx, feature) == nil
		}
		features[name] = capability{Available: available}
	}
	writeJSON(w, http.StatusOK, struct {
		Features map[string]capability `json:"features"`
	}{features})
}
func (s *Server) writeAIError(w http.ResponseWriter, r *http.Request, err error) {
	status, code := 503, "ai_unavailable"
	switch {
	case errors.Is(err, parsing.ErrForbidden):
		status, code = 404, "not_found"
	case errors.Is(err, parsing.ErrInvalid):
		status, code = 422, "ai_invalid"
	case errors.Is(err, parsing.ErrConflict):
		status, code = 409, "revision_conflict"
	case errors.Is(err, parsing.ErrPending):
		status, code = 409, "ai_pending"
	}
	var safe *gateway.Error
	if errors.As(err, &safe) {
		switch safe.Code {
		case gateway.InvalidRequest:
			status, code = 400, "ai_invalid"
		case gateway.RateLimited, gateway.BudgetExceeded:
			status, code = 429, "ai_limit"
		case gateway.Disabled:
			status, code = 503, "ai_disabled"
		}
	}
	writeError(w, r, status, code, "AI proposal is unavailable or needs review; manual entry remains available.")
}
func (s *Server) writeAIArtifact(w http.ResponseWriter, r *http.Request, a parsing.Artifact) {
	var outcome parsing.Outcome
	if json.Unmarshal(a.Result, &outcome) != nil {
		s.writeAIError(w, r, parsing.ErrUnavailable)
		return
	}
	if a.Task == "job.parse" && len(a.Review) > 0 {
		var reviewed struct {
			Corrected recruiter.DetailedJobInput `json:"corrected"`
		}
		if json.Unmarshal(a.Review, &reviewed) != nil {
			s.writeAIError(w, r, parsing.ErrUnavailable)
			return
		}
		outcome.Value, _ = json.Marshal(reviewed.Corrected)
	}
	outcome.Status = a.Status
	// Operational request IDs remain in private storage/admin telemetry, not the owner view.
	outcome.ProviderRequestID = ""
	status := http.StatusOK
	if a.Status == "provider_error" {
		status = 503
	}
	if a.Status == "validation_error" {
		status = 422
	}
	writeJSON(w, status, struct {
		ID        string          `json:"id"`
		Revision  uint64          `json:"revision"`
		Result    parsing.Outcome `json:"result"`
		ExpiresAt time.Time       `json:"expires_at"`
	}{a.ID, a.Revision, outcome, a.ExpiresAt})
}
func (s *Server) aiJobParse(w http.ResponseWriter, r *http.Request) {
	ctx, ok := s.aiContext(w, r)
	if !ok {
		return
	}
	var in struct {
		Text    string `json:"text"`
		Consent bool   `json:"external_ai_consent"`
	}
	if !decodeJSON(w, r, &in) {
		return
	}
	a, err := s.aiParsing.ParseJob(ctx, in.Text, in.Consent)
	if err != nil {
		s.writeAIError(w, r, err)
		return
	}
	s.writeAIArtifact(w, r, a)
}
func (s *Server) aiJobGenerate(w http.ResponseWriter, r *http.Request) {
	ctx, ok := s.aiContext(w, r)
	if !ok {
		return
	}
	var in parsing.JobDescriptionGenerationRequest
	if !decodeJSON(w, r, &in) {
		return
	}
	a, err := s.aiParsing.GenerateDescription(ctx, in)
	if err != nil {
		s.writeAIError(w, r, err)
		return
	}
	s.writeAIArtifact(w, r, a)
}

func (s *Server) aiJobGenerationReview(w http.ResponseWriter, r *http.Request) {
	ctx, ok := s.aiContext(w, r)
	if !ok {
		return
	}
	var input parsing.GenerationReview
	if !decodeJSON(w, r, &input) {
		return
	}
	a, err := s.aiParsing.ReviewDescription(ctx, r.PathValue("generationID"), input)
	if err != nil {
		s.writeAIError(w, r, err)
		return
	}
	s.writeAIArtifact(w, r, a)
}
func (s *Server) aiCVParse(w http.ResponseWriter, r *http.Request) {
	ctx, ok := s.aiContext(w, r)
	if !ok {
		return
	}
	if err := s.aiParsing.Gateway.Authorize(ctx, gateway.CVParser); err != nil {
		s.writeAIError(w, r, err)
		return
	}
	if err := r.ParseMultipartForm(2 << 20); err != nil {
		s.writeAIError(w, r, parsing.ErrInvalid)
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		s.writeAIError(w, r, parsing.ErrInvalid)
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, resume.MaxFileBytes+1))
	if err != nil || len(data) > resume.MaxFileBytes {
		s.writeAIError(w, r, parsing.ErrInvalid)
		return
	}
	var ocr resume.OCRFunc
	if os.Getenv("CV_OCR_ENABLED") == "true" {
		ocr = resume.OCRPDF
	}
	a, err := s.aiParsing.ParseCVDocument(ctx, header.Filename, data, r.FormValue("external_ai_consent") == "true", os.Getenv("CV_CLAMD_ADDRESS"), ocr)
	if err != nil {
		s.writeAIError(w, r, err)
		return
	}
	if a.Status != "requires_review" && a.Status != "owner_reviewed" {
		s.writeAIArtifact(w, r, a)
		return
	}
	view, err := s.aiParsing.CVReview(ctx, a.ID)
	if err != nil {
		s.writeAIError(w, r, err)
		return
	}
	writeJSON(w, 200, view)
}
func (s *Server) aiProposal(w http.ResponseWriter, r *http.Request) {
	ctx, ok := s.aiContext(w, r)
	if !ok {
		return
	}
	id := r.PathValue("parseID")
	a, err := s.aiParsing.Get(ctx, id)
	if err != nil {
		s.writeAIError(w, r, err)
		return
	}
	if r.Method == http.MethodGet {
		if a.Task == "cv.parse" {
			view, e := s.aiParsing.CVReview(ctx, id)
			if e != nil {
				s.writeAIError(w, r, e)
				return
			}
			writeJSON(w, 200, view)
		} else {
			s.writeAIArtifact(w, r, a)
		}
		return
	}
	if a.Task == "cv.parse" {
		var in struct {
			Expected  uint64              `json:"expected_revision"`
			Decisions []contract.Decision `json:"decisions"`
			Confirm   bool                `json:"confirm"`
		}
		if !decodeJSON(w, r, &in) {
			return
		}
		view, e := s.aiParsing.ReviewCV(ctx, id, in.Expected, contract.ReviewPatch{Decisions: in.Decisions}, in.Confirm)
		if e != nil {
			s.writeAIError(w, r, e)
			return
		}
		writeJSON(w, 200, view)
		return
	}
	var input parsing.JobReview
	if !decodeJSON(w, r, &input) {
		return
	}
	updated, e := s.aiParsing.ReviewJob(ctx, id, input)
	if e != nil {
		s.writeAIError(w, r, e)
		return
	}
	s.writeAIArtifact(w, r, updated)
}

func (s *Server) aiCVApply(w http.ResponseWriter, r *http.Request) {
	ctx, ok := s.aiContext(w, r)
	if !ok {
		return
	}
	var input parsing.CVApplyInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.aiParsing.ApplyCV(ctx, r.PathValue("parseID"), input)
	if err != nil {
		s.writeAIError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, result)
}
