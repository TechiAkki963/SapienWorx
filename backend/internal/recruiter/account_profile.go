package recruiter

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrProfileStale = errors.New("recruiter profile changed")
var workPhonePattern = regexp.MustCompile(`^\+[1-9][0-9]{7,14}$`)

// AccountProfile is the caller's own professional identity. Account email,
// company membership and authentication phone are never writable here.
type AccountProfile struct {
	FullName          string    `json:"full_name"`
	Designation       string    `json:"designation"`
	WorkEmail         string    `json:"work_email"`
	WorkEmailVerified bool      `json:"work_email_verified"`
	CompanyName       string    `json:"company_name"`
	WorkPhone         string    `json:"work_phone"`
	Location          string    `json:"location"`
	Expertise         []string  `json:"expertise"`
	Bio               string    `json:"bio"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type AccountProfileInput struct {
	FullName          *string   `json:"full_name"`
	Designation       *string   `json:"designation"`
	WorkPhone         *string   `json:"work_phone"`
	Location          *string   `json:"location"`
	Expertise         *[]string `json:"expertise"`
	Bio               *string   `json:"bio"`
	ExpectedUpdatedAt time.Time `json:"expected_updated_at"`
}

func validateAccountProfile(in *AccountProfileInput) error {
	if in.ExpectedUpdatedAt.IsZero() || (in.FullName == nil && in.Designation == nil && in.WorkPhone == nil && in.Location == nil && in.Expertise == nil && in.Bio == nil) {
		return ErrInvalid
	}
	for _, field := range []struct {
		value     *string
		max       int
		multiline bool
	}{{in.FullName, 160, false}, {in.Designation, 160, false}, {in.WorkPhone, 20, false}, {in.Location, 160, false}, {in.Bio, 1000, true}} {
		if field.value == nil {
			continue
		}
		*field.value = strings.TrimSpace(*field.value)
		if !validProfileText(*field.value, field.max, field.multiline) {
			return ErrInvalid
		}
	}
	if in.FullName != nil && *in.FullName == "" {
		return ErrInvalid
	}
	if in.WorkPhone != nil && *in.WorkPhone != "" && !workPhonePattern.MatchString(*in.WorkPhone) {
		return ErrInvalid
	}
	if in.Expertise != nil {
		if len(*in.Expertise) > 12 {
			return ErrInvalid
		}
		seen := map[string]bool{}
		cleaned := make([]string, 0, len(*in.Expertise))
		for _, value := range *in.Expertise {
			value = strings.TrimSpace(value)
			if value == "" || !validProfileText(value, 40, false) {
				return ErrInvalid
			}
			key := strings.ToLower(value)
			if !seen[key] {
				cleaned = append(cleaned, value)
				seen[key] = true
			}
		}
		*in.Expertise = cleaned
	}
	return nil
}
func validProfileText(value string, max int, multiline bool) bool {
	if !utf8.ValidString(value) || utf8.RuneCountInString(value) > max {
		return false
	}
	for _, r := range value {
		if unicode.IsControl(r) && !(multiline && (r == '\n' || r == '\r')) {
			return false
		}
	}
	return true
}

type accountProfileStore interface {
	Read(context.Context, string) (AccountProfile, error)
	Update(context.Context, string, AccountProfileInput) (AccountProfile, error)
}
type sqlAccountProfileStore struct{ db *pgxpool.Pool }

func (s *Service) AccountProfile(ctx context.Context, actor string) (AccountProfile, error) {
	var store accountProfileStore = sqlAccountProfileStore{s.db}
	return store.Read(ctx, actor)
}
func (s *Service) UpdateAccountProfile(ctx context.Context, actor string, in AccountProfileInput) (AccountProfile, error) {
	if err := validateAccountProfile(&in); err != nil {
		return AccountProfile{}, err
	}
	var store accountProfileStore = sqlAccountProfileStore{s.db}
	return store.Update(ctx, actor, in)
}

// No resource ID is accepted from the client: ownership is always the session subject.
const accountProfileQuery = `SELECT rp.full_name,COALESCE(rp.designation,''),u.email,u.email_verified_at IS NOT NULL,c.display_name,
 rp.work_phone,rp.location,rp.expertise,rp.bio,rp.updated_at FROM recruiter_profiles rp
 JOIN users u ON u.id=rp.user_id JOIN companies c ON c.id=rp.company_id
 LEFT JOIN company_memberships m ON m.user_id=rp.user_id AND m.company_id=rp.company_id
 WHERE rp.user_id=$1 AND u.role='recruiter' AND u.is_active AND u.status='active'
 AND rp.verification_status='verified' AND c.verification_status='verified' AND COALESCE(m.status,'active')='active'`

func scanAccountProfile(row pgx.Row) (AccountProfile, error) {
	var p AccountProfile
	err := row.Scan(&p.FullName, &p.Designation, &p.WorkEmail, &p.WorkEmailVerified, &p.CompanyName, &p.WorkPhone, &p.Location, &p.Expertise, &p.Bio, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, ErrNotFound
	}
	return p, err
}
func (s sqlAccountProfileStore) Read(ctx context.Context, actor string) (AccountProfile, error) {
	return scanAccountProfile(s.db.QueryRow(ctx, accountProfileQuery, actor))
}
func (s sqlAccountProfileStore) Update(ctx context.Context, actor string, in AccountProfileInput) (AccountProfile, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return AccountProfile{}, err
	}
	defer tx.Rollback(ctx)
	previous, err := scanAccountProfile(tx.QueryRow(ctx, accountProfileQuery+" FOR UPDATE OF rp,u,c", actor))
	if err != nil {
		return AccountProfile{}, err
	}
	if !previous.UpdatedAt.Equal(in.ExpectedUpdatedAt) {
		return AccountProfile{}, ErrProfileStale
	}
	p := previous
	if in.FullName != nil {
		p.FullName = *in.FullName
	}
	if in.Designation != nil {
		p.Designation = *in.Designation
	}
	if in.WorkPhone != nil {
		p.WorkPhone = *in.WorkPhone
	}
	if in.Location != nil {
		p.Location = *in.Location
	}
	if in.Expertise != nil {
		p.Expertise = *in.Expertise
	}
	if in.Bio != nil {
		p.Bio = *in.Bio
	}
	err = tx.QueryRow(ctx, `UPDATE recruiter_profiles SET full_name=$2,designation=NULLIF($3,''),work_phone=$4,location=$5,expertise=$6,bio=$7,updated_at=clock_timestamp() WHERE user_id=$1 RETURNING updated_at`, actor, p.FullName, p.Designation, p.WorkPhone, p.Location, p.Expertise, p.Bio).Scan(&p.UpdatedAt)
	if err != nil {
		return AccountProfile{}, err
	}
	// Audit the action without copying contact details or free text into logs.
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,outcome) VALUES($1,$1,'recruiter_profile_updated','recruiter_profile','success')`, actor); err != nil {
		return AccountProfile{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return AccountProfile{}, err
	}
	return p, nil
}
