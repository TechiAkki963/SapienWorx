package httpserver

import (
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
	"github.com/TechiAkki963/SapienWorx/backend/internal/resume"
	"github.com/TechiAkki963/SapienWorx/backend/internal/storage"
)

func (s *Server) offerStudio(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-store")
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		return
	}
	candidate := claims.Role == "candidate"
	store := s.recruiter.OfferStudio(s.objectStorage)
	id := r.PathValue("offerID")
	if r.Method == http.MethodGet {
		if id == "" {
			f := recruiter.OfferListQuery{Page: 1, Limit: 25, Status: r.URL.Query().Get("status"), Query: r.URL.Query().Get("q")}
			if v := r.URL.Query().Get("page"); v != "" {
				f.Page, _ = strconv.Atoi(v)
			}
			if v := r.URL.Query().Get("limit"); v != "" {
				f.Limit, _ = strconv.Atoi(v)
			}
			items, err := store.Offers(r.Context(), claims.Subject, r.URL.Query().Get("job_id"), candidate, f)
			if err != nil {
				s.writeOfferError(w, r, err)
				return
			}
			writeJSON(w, http.StatusOK, items)
			return
		}
		item, err := store.Offer(r.Context(), claims.Subject, id, candidate)
		if err != nil {
			s.writeOfferError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, item)
		return
	}
	if candidate {
		writeError(w, r, http.StatusForbidden, "offer_permission", "Candidate offers can only be changed through a response action.")
		return
	}
	var input recruiter.OfferWriteInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := store.Save(r.Context(), claims.Subject, id, input)
	if err != nil {
		s.writeOfferError(w, r, err)
		return
	}
	status := http.StatusOK
	if id == "" {
		status = http.StatusCreated
	}
	writeJSON(w, status, item)
}
func (s *Server) offerStudioCommand(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		return
	}
	var input recruiter.OfferCommand
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := s.recruiter.OfferStudio(s.objectStorage).Command(r.Context(), claims.Subject, r.PathValue("offerID"), claims.Role == "candidate", input)
	if err != nil {
		s.writeOfferError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}
func (s *Server) offerStudioTemplates(w http.ResponseWriter, r *http.Request) {
	actor, ok := recruiterID(r)
	if !ok {
		return
	}
	store := s.recruiter.OfferStudio(s.objectStorage)
	if r.Method == http.MethodGet {
		items, err := store.Templates(r.Context(), actor)
		if err != nil {
			s.writeOfferError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items})
		return
	}
	var input recruiter.OfferTemplateInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := store.SaveTemplate(r.Context(), actor, r.PathValue("templateID"), input)
	if err != nil {
		s.writeOfferError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}
func (s *Server) offerStudioApplications(w http.ResponseWriter, r *http.Request) {
	actor, ok := recruiterID(r)
	if !ok {
		return
	}
	items, err := s.recruiter.OfferStudio(s.objectStorage).EligibleApplications(r.Context(), actor, r.URL.Query().Get("job_id"), r.URL.Query().Get("application_id"), r.URL.Query().Get("q"))
	if err != nil {
		s.writeOfferError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
func (s *Server) offerStudioSettings(w http.ResponseWriter, r *http.Request) {
	actor, ok := recruiterID(r)
	if !ok {
		return
	}
	store := s.recruiter.OfferStudio(s.objectStorage)
	if r.Method == http.MethodGet {
		item, err := store.Settings(r.Context(), actor)
		if err != nil {
			s.writeOfferError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, item)
		return
	}
	var input recruiter.OfferSettingsInput
	if !decodeJSON(w, r, &input) {
		return
	}
	item, err := store.SaveSettings(r.Context(), actor, input)
	if err != nil {
		s.writeOfferError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, item)
}
func (s *Server) offerStudioDocument(w http.ResponseWriter, r *http.Request) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		return
	}
	version, err := strconv.Atoi(r.PathValue("version"))
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_version", "Select a valid offer version.")
		return
	}
	mode := r.URL.Query().Get("mode")
	if mode == "" {
		mode = "view"
	}
	store := s.recruiter.OfferStudio(s.objectStorage)
	var item storage.PresignedRequest
	if documentID := r.PathValue("documentID"); documentID != "" {
		item, err = store.AttachmentDocument(r.Context(), claims.Subject, r.PathValue("offerID"), version, documentID, claims.Role == "candidate", mode)
	} else {
		item, err = store.Document(r.Context(), claims.Subject, r.PathValue("offerID"), version, claims.Role == "candidate", mode)
	}
	if err != nil {
		s.writeOfferError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, http.StatusOK, map[string]any{"download": item})
}
func (s *Server) offerStudioAttachmentUpload(w http.ResponseWriter, r *http.Request) {
	actor, ok := recruiterID(r)
	if !ok {
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_annexure", "Select a PDF annexure under 1.5 MB.")
		return
	}
	defer file.Close()
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	body, err := io.ReadAll(io.LimitReader(file, resume.MaxFileBytes+1))
	if err != nil || len(body) > resume.MaxFileBytes {
		writeError(w, r, http.StatusRequestEntityTooLarge, "annexure_too_large", "PDF annexures must be under 1.5 MB.")
		return
	}
	item, err := s.recruiter.OfferStudio(s.objectStorage).UploadAttachment(r.Context(), actor, r.FormValue("application_id"), header.Filename, body)
	if err != nil {
		s.writeOfferError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}
func (s *Server) offerStudioAudit(w http.ResponseWriter, r *http.Request) {
	actor, ok := recruiterID(r)
	if !ok {
		return
	}
	items, err := s.recruiter.OfferStudio(s.objectStorage).Audit(r.Context(), actor, r.PathValue("offerID"))
	if err != nil {
		s.writeOfferError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
func (s *Server) writeOfferError(w http.ResponseWriter, r *http.Request, err error) {
	w.Header().Set("Cache-Control", "private, no-store")
	switch {
	case errors.Is(err, resume.ErrScannerUnavailable):
		writeError(w, r, http.StatusServiceUnavailable, "annexure_scanner_unavailable", "Annexure upload is unavailable until the private document scanner is ready.")
	case errors.Is(err, resume.ErrMalwareDetected):
		writeError(w, r, http.StatusUnprocessableEntity, "unsafe_annexure", "This annexure did not pass the document scan.")
	case errors.Is(err, recruiter.ErrOfferStale):
		writeError(w, r, http.StatusConflict, "offer_changed", "This offer changed. Reload the latest version before continuing.")
	case errors.Is(err, recruiter.ErrOfferForbidden):
		writeError(w, r, http.StatusForbidden, "offer_permission", "Your company role does not allow this offer action.")
	case errors.Is(err, recruiter.ErrOfferApproval):
		writeError(w, r, http.StatusConflict, "offer_approval_required", "This action requires an eligible offer and the configured distinct approvers.")
	case errors.Is(err, recruiter.ErrOfferCalculation):
		writeError(w, r, http.StatusBadRequest, "offer_calculation", "Check required values, currency, field references and formulas. Calculations must resolve without negative values or division by zero.")
	case errors.Is(err, storage.ErrUnavailable):
		writeError(w, r, http.StatusServiceUnavailable, "offer_storage_unavailable", "Private offer document storage is unavailable. The offer has not been sent.")
	default:
		s.writeRecruiterError(w, r, err)
	}
}

func (s *Server) offerStudioTemplateArchive(w http.ResponseWriter, r *http.Request) {
	actor, ok := recruiterID(r)
	if !ok {
		return
	}
	var in recruiter.OfferTemplateArchiveInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := s.recruiter.OfferStudio(s.objectStorage).ArchiveTemplate(r.Context(), actor, r.PathValue("templateID"), in); err != nil {
		s.writeOfferError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
