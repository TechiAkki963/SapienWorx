package candidate

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type PublicProfile struct {
	FullName              string   `json:"full_name"`
	Headline              *string  `json:"headline,omitempty"`
	CurrentLocation       string   `json:"current_location,omitempty"`
	PreferredLocations    []string `json:"preferred_locations"`
	TotalExperienceMonths int      `json:"total_experience_months"`
	PhotoDataURL          string   `json:"photo_data_url,omitempty"`
}

func (s *Service) PublicProfile(ctx context.Context, token string) (PublicProfile, error) {
	var userID string
	err := s.db.QueryRow(ctx, `SELECT user_id FROM candidate_profiles WHERE profile_share_token::text=$1 AND COALESCE((profile_details->>'profile_visible_in_sourcing')::boolean,false)=true`, token).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return PublicProfile{}, ErrNotFound
	}
	if err != nil {
		return PublicProfile{}, err
	}
	summary, err := s.Summary(ctx, userID)
	if err != nil {
		return PublicProfile{}, err
	}
	return PublicProfile{
		FullName: summary.FullName,
		Headline: summary.Headline,
		CurrentLocation: summary.CurrentLocation,
		PreferredLocations: summary.PreferredLocations,
		TotalExperienceMonths: summary.TotalExperienceMonths,
		PhotoDataURL: summary.PhotoDataURL,
	}, nil
}
