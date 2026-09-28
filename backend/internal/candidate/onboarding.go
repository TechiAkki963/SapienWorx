package candidate

import (
	"context"
	"errors"
	"regexp"

	"github.com/jackc/pgx/v5"
)

var ErrInvalidOnboardingTransition = errors.New("invalid onboarding transition")
var onboardingJobPath = regexp.MustCompile(`^/(?:candidate/jobs|jobs)/[a-zA-Z0-9-]+$`)

// SetOnboardingState is the only writer for the server-owned onboarding keys.
// Profiles without a state predate onboarding and remain accessible unchanged.
func (s *Service) SetOnboardingState(ctx context.Context, userID, next, returnTo string) (ProfileDetails, error) {
	if returnTo != "" && !onboardingJobPath.MatchString(returnTo) {
		return ProfileDetails{}, ErrInvalidOnboardingTransition
	}
	method := ""
	switch next {
	case "manual_started":
		method = "manual"
	case "cv_started", "review_required":
		method = "cv"
	case "profile_ready":
		// Keep the method already chosen.
	default:
		return ProfileDetails{}, ErrInvalidOnboardingTransition
	}
	var tag string
	err := s.db.QueryRow(ctx, `UPDATE candidate_profiles SET profile_details=profile_details || jsonb_build_object('onboarding_status',$2::text,'onboarding_method',CASE WHEN $3::text='' THEN profile_details->>'onboarding_method' ELSE $3::text END) || CASE WHEN $4::text='' THEN '{}'::jsonb ELSE jsonb_build_object('onboarding_return_to',$4::text) END,updated_at=now() WHERE user_id=$1 AND profile_details ? 'onboarding_status' AND ($2 <> 'review_required' OR profile_details->>'onboarding_method'='cv') AND ($2 <> 'profile_ready' OR profile_details->>'onboarding_method' IN ('cv','manual')) RETURNING user_id::text`, userID, next, method, returnTo).Scan(&tag)
	if errors.Is(err, pgx.ErrNoRows) {
		return ProfileDetails{}, ErrInvalidOnboardingTransition
	}
	if err != nil {
		return ProfileDetails{}, err
	}
	return s.Details(ctx, userID)
}
