package httpserver

import (
	"errors"
	"github.com/TechiAkki963/SapienWorx/backend/internal/auth"
	"github.com/TechiAkki963/SapienWorx/backend/internal/candidate"
	"io"
	"net/http"
)

func (s *Server) candidatePhotoUpload(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	encoded, err := readProfileImageUpload(w, r)
	if err != nil {
		writeError(w, r, 400, "invalid_image", errInvalidProfileImage.Error())
		return
	}
	if err = s.candidate.UpdatePhoto(r.Context(), id, "image/webp", encoded); err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	summary, err := s.candidate.Summary(r.Context(), id)
	if err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, 200, map[string]any{"photo_data_url": summary.PhotoDataURL, "profile_image_url": summary.PhotoDataURL, "content_type": "image/webp", "size_bytes": len(encoded)})
}

func readProfileImageUpload(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxProfileImageUpload+(1<<20))
	err := r.ParseMultipartForm(512 << 10)
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	if err != nil {
		return nil, err
	}
	file, _, err := r.FormFile("image")
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, maxProfileImageUpload+1))
	if err != nil || len(data) == 0 || len(data) > maxProfileImageUpload {
		return nil, errInvalidProfileImage
	}
	return compressProfileImage(data)
}

func (s *Server) candidatePhotoRemove(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	if err := s.candidate.RemovePhoto(r.Context(), id); err != nil {
		s.writeCandidateError(w, r, err)
		return
	}
	w.WriteHeader(204)
}

func (s *Server) candidatePhotoGet(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	data, mime, err := s.candidate.Photo(r.Context(), id)
	if err != nil {
		if errors.Is(err, candidate.ErrNotFound) {
			writeError(w, r, 404, "image_not_found", "profile image not found")
		} else {
			s.writeCandidateError(w, r, err)
		}
		return
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Write(data)
}

func (s *Server) candidatePhoneRequest(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	var input struct {
		Phone string `json:"phone"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := s.auth.RequestCandidatePhoneChange(r.Context(), id, input.Phone)
	if err != nil {
		s.writePhoneChangeError(w, r, err)
		return
	}
	writeJSON(w, 200, result)
}

func (s *Server) candidatePhoneVerify(w http.ResponseWriter, r *http.Request) {
	id, ok := candidateID(r)
	if !ok {
		writeError(w, r, 401, "unauthorized", "authentication required")
		return
	}
	var input struct {
		ChallengeID string `json:"challenge_id"`
		Code        string `json:"code"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	phone, err := s.auth.VerifyCandidatePhoneChange(r.Context(), id, input.ChallengeID, input.Code)
	if err != nil {
		s.writePhoneChangeError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	writeJSON(w, 200, map[string]any{"primary_phone": phone, "phone_verified": true})
}

func (s *Server) writePhoneChangeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, auth.ErrSMSUnavailable):
		writeError(w, r, 503, "sms_unavailable", "mobile verification is temporarily unavailable; your current number has not changed")
	case errors.Is(err, auth.ErrOTPRateLimited):
		w.Header().Set("Retry-After", "60")
		writeError(w, r, 429, "otp_rate_limited", "wait before requesting another code")
	case errors.Is(err, auth.ErrInvalidOTP):
		writeError(w, r, 400, "invalid_otp", "invalid or expired verification code")
	case errors.Is(err, auth.ErrPhoneValidation):
		writeError(w, r, 400, "invalid_phone", "enter a valid country calling code and mobile number in international format")
	case errors.Is(err, auth.ErrPhoneUnavailable):
		writeError(w, r, 409, "phone_unavailable", "this number cannot be used; your current number has not changed")
	default:
		s.writeAuthError(w, r, err)
	}
}
