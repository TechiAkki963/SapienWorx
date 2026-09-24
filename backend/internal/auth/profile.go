package auth

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

type SessionProfile struct {
	ID              string `json:"id"`
	Role            Role   `json:"role"`
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name"`
	Headline        string `json:"headline"`
	ProfileImageURL string `json:"profile_image_url,omitempty"`
	ProfileImageKey string `json:"-"`
}

func (s *Service) SessionProfile(ctx context.Context, userID string) (SessionProfile, error) {
	var result SessionProfile
	var fullName string
	err := s.db.QueryRow(ctx, `
		SELECT u.id::text,u.role::text,
		       COALESCE(cp.full_name,rp.full_name,ap.full_name,''),
		       CASE u.role
		         WHEN 'candidate' THEN COALESCE(NULLIF(cp.headline,''),NULLIF(cp.profile_details->>'current_designation',''),'')
		         WHEN 'recruiter' THEN concat_ws(' @ ',NULLIF(rp.designation,''),NULLIF(c.display_name,''))
		         ELSE 'Master Administrator'
		       END,
		       COALESCE(u.profile_image_url,''),COALESCE(u.profile_image_key,'')
		FROM users u
		LEFT JOIN candidate_profiles cp ON cp.user_id=u.id
		LEFT JOIN recruiter_profiles rp ON rp.user_id=u.id
		LEFT JOIN companies c ON c.id=rp.company_id
		LEFT JOIN admin_profiles ap ON ap.user_id=u.id
		WHERE u.id=$1 AND u.is_active=true`, userID).Scan(
		&result.ID, &result.Role, &fullName, &result.Headline, &result.ProfileImageURL, &result.ProfileImageKey,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionProfile{}, ErrAccountUnavailable
	}
	if err != nil {
		return SessionProfile{}, err
	}
	nameParts := strings.Fields(fullName)
	if len(nameParts) > 0 {
		result.FirstName = nameParts[0]
		result.LastName = strings.Join(nameParts[1:], " ")
	}
	return result, nil
}

func (s *Service) SaveProfileImage(ctx context.Context, userID, imageURL, key string) (string, error) {
	if !strings.HasPrefix(key, "profile-images/"+userID+"/") || !strings.HasSuffix(key, ".webp") || imageURL != "/api/v1/users/profile-image?version="+strings.TrimSuffix(strings.TrimPrefix(key, "profile-images/"+userID+"/"), ".webp") {
		return "", errors.New("invalid profile image reference")
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	var previous string
	if err = tx.QueryRow(ctx, `SELECT COALESCE(profile_image_key,'') FROM users WHERE id=$1 AND is_active=true FOR UPDATE`, userID).Scan(&previous); errors.Is(err, pgx.ErrNoRows) {
		return "", ErrAccountUnavailable
	} else if err != nil {
		return "", err
	}
	if _, err = tx.Exec(ctx, `UPDATE users SET profile_image_url=$2,profile_image_key=$3,updated_at=now() WHERE id=$1`, userID, imageURL, key); err != nil {
		return "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return "", err
	}
	return previous, nil
}

func (s *Service) ProfileImageKey(ctx context.Context, userID string) (string, error) {
	var key string
	err := s.db.QueryRow(ctx, `SELECT COALESCE(profile_image_key,'') FROM users WHERE id=$1 AND is_active=true`, userID).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrAccountUnavailable
	}
	return key, err
}
