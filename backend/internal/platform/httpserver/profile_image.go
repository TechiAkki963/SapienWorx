package httpserver

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gen2brain/webp"
)

const (
	maxProfileImageUpload = 5 << 20
	maxProfileImagePixels = 12_000_000
	maxStoredImageBytes   = 190 << 10
)

var errInvalidProfileImage = errors.New("upload a valid JPEG, PNG, or WebP image no larger than 5 MB")

func (s *Server) uploadUserProfileImage(w http.ResponseWriter, r *http.Request) {
	if s.objectStorage == nil {
		writeError(w, r, http.StatusServiceUnavailable, "storage_unavailable", "profile image storage is unavailable")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxProfileImageUpload+(1<<20))
	if err := r.ParseMultipartForm(512 << 10); err != nil {
		writeError(w, r, http.StatusRequestEntityTooLarge, "image_too_large", "profile image must be 5 MB or smaller")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, _, err := r.FormFile("image")
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_image", errInvalidProfileImage.Error())
		return
	}
	defer file.Close()
	input, err := io.ReadAll(io.LimitReader(file, maxProfileImageUpload+1))
	if err != nil || len(input) == 0 || len(input) > maxProfileImageUpload {
		writeError(w, r, http.StatusBadRequest, "invalid_image", errInvalidProfileImage.Error())
		return
	}
	encoded, err := compressProfileImage(input)
	if err != nil {
		writeError(w, r, http.StatusBadRequest, "invalid_image", errInvalidProfileImage.Error())
		return
	}
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	var version [16]byte
	if _, err := rand.Read(version[:]); err != nil {
		writeError(w, r, http.StatusInternalServerError, "image_upload_failed", "could not prepare profile image")
		return
	}
	versionText := hex.EncodeToString(version[:])
	key := fmt.Sprintf("profile-images/%s/%s.webp", claims.Subject, versionText)
	if err := s.objectStorage.PutObject(r.Context(), key, "image/webp", encoded); err != nil {
		s.logger.Error("profile image upload failed", "request_id", RequestIDFromContext(r.Context()))
		writeError(w, r, http.StatusBadGateway, "image_upload_failed", "could not save profile image")
		return
	}
	imageURL := "/api/v1/users/profile-image?version=" + versionText
	previous, err := s.auth.SaveProfileImage(r.Context(), claims.Subject, imageURL, key)
	if err != nil {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = s.objectStorage.DeleteObject(cleanupCtx, key)
		writeError(w, r, http.StatusInternalServerError, "image_upload_failed", "could not save profile image")
		return
	}
	if previous != "" && previous != key {
		if err := s.objectStorage.DeleteObject(r.Context(), previous); err != nil {
			s.logger.Warn("old profile image cleanup failed", "request_id", RequestIDFromContext(r.Context()))
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, map[string]any{"profile_image_url": imageURL, "size_bytes": len(encoded), "content_type": "image/webp"})
}

func (s *Server) getUserProfileImage(w http.ResponseWriter, r *http.Request) {
	if s.objectStorage == nil {
		writeError(w, r, http.StatusServiceUnavailable, "storage_unavailable", "profile image storage is unavailable")
		return
	}
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		writeError(w, r, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}
	key, err := s.auth.ProfileImageKey(r.Context(), claims.Subject)
	if err != nil || key == "" {
		writeError(w, r, http.StatusNotFound, "image_not_found", "profile image not found")
		return
	}
	if !strings.HasPrefix(key, "profile-images/"+claims.Subject+"/") || !strings.HasSuffix(key, ".webp") {
		writeError(w, r, http.StatusNotFound, "image_not_found", "profile image not found")
		return
	}
	request, err := s.objectStorage.PresignGet(r.Context(), key, "")
	if err != nil {
		writeError(w, r, http.StatusBadGateway, "image_unavailable", "profile image is unavailable")
		return
	}
	w.Header().Set("Cache-Control", "private, no-store")
	http.Redirect(w, r, request.URL, http.StatusFound)
}

func compressProfileImage(input []byte) ([]byte, error) {
	config, format, err := image.DecodeConfig(bytes.NewReader(input))
	if err != nil || config.Width < 1 || config.Height < 1 || int64(config.Width)*int64(config.Height) > maxProfileImagePixels {
		return nil, errInvalidProfileImage
	}
	switch format {
	case "jpeg", "png", "webp":
	default:
		return nil, errInvalidProfileImage
	}
	decoded, actualFormat, err := image.Decode(bytes.NewReader(input))
	if err != nil || actualFormat != format {
		return nil, errInvalidProfileImage
	}
	for _, maxSide := range []int{640, 512, 384, 256} {
		resized := resizeForProfile(decoded, maxSide)
		for _, quality := range []int{80, 68, 56, 44} {
			var out bytes.Buffer
			if err := webp.Encode(&out, resized, webp.Options{Quality: quality, Method: 3}); err != nil {
				return nil, err
			}
			if out.Len() <= maxStoredImageBytes {
				return out.Bytes(), nil
			}
		}
	}
	return nil, errors.New("encoded profile image exceeds the storage limit")
}

func resizeForProfile(src image.Image, maxSide int) image.Image {
	bounds := src.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	if width <= maxSide && height <= maxSide {
		return src
	}
	scale := float64(maxSide) / float64(max(width, height))
	dstWidth, dstHeight := max(1, int(float64(width)*scale)), max(1, int(float64(height)*scale))
	dst := image.NewRGBA(image.Rect(0, 0, dstWidth, dstHeight))
	for y := 0; y < dstHeight; y++ {
		sy := bounds.Min.Y + min(height-1, int(float64(y)*float64(height)/float64(dstHeight)))
		for x := 0; x < dstWidth; x++ {
			sx := bounds.Min.X + min(width-1, int(float64(x)*float64(width)/float64(dstWidth)))
			r, g, b, a := src.At(sx, sy).RGBA()
			dst.SetRGBA(x, y, color.RGBA{R: uint8(r >> 8), G: uint8(g >> 8), B: uint8(b >> 8), A: uint8(a >> 8)})
		}
	}
	return dst
}
