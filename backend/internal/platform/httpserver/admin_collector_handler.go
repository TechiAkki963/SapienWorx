package httpserver

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/TechiAkki963/SapienWorx/backend/internal/admin"
)

func (s *Server) adminCollectorIngest(w http.ResponseWriter, r *http.Request) {
	if strings.TrimSpace(s.cfg.Admin.CollectorHMACSecret) == "" {
		http.NotFound(w, r)
		return
	}
	timestampRaw := strings.TrimSpace(r.Header.Get("X-SWX-Timestamp"))
	signatureRaw := strings.TrimSpace(r.Header.Get("X-SWX-Signature"))
	if timestampRaw == "" || signatureRaw == "" {
		writeError(w, r, http.StatusUnauthorized, "collector_auth_required", "collector authentication is required")
		return
	}
	unixSeconds, err := strconv.ParseInt(timestampRaw, 10, 64)
	if err != nil {
		writeError(w, r, http.StatusUnauthorized, "collector_auth_invalid", "collector authentication is invalid")
		return
	}
	sentAt := time.Unix(unixSeconds, 0).UTC()
	now := time.Now().UTC()
	skew := now.Sub(sentAt)
	if skew < 0 {
		skew = -skew
	}
	if skew > s.cfg.Admin.CollectorMaxClockSkew {
		writeError(w, r, http.StatusUnauthorized, "collector_signature_expired", "collector signature timestamp is outside the accepted window")
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 64<<10+1))
	if err != nil || len(body) > 64<<10 {
		writeError(w, r, http.StatusRequestEntityTooLarge, "collector_payload_too_large", "collector payload exceeds the allowed size")
		return
	}
	mac := hmac.New(sha256.New, []byte(s.cfg.Admin.CollectorHMACSecret))
	_, _ = mac.Write([]byte(timestampRaw))
	_, _ = mac.Write([]byte("\n"))
	_, _ = mac.Write(body)
	expected := mac.Sum(nil)

	signatureRaw = strings.TrimPrefix(signatureRaw, "sha256=")
	provided, err := hex.DecodeString(signatureRaw)
	if err != nil || !hmac.Equal(expected, provided) {
		writeError(w, r, http.StatusUnauthorized, "collector_signature_invalid", "collector signature is invalid")
		return
	}

	var envelope admin.CollectorEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_request", "collector payload is invalid")
		return
	}
	result, err := s.admin.IngestCollector(r.Context(), envelope)
	if err != nil {
		s.writeAdminError(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusAccepted, result)
}
