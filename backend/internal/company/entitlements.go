// Package company owns tenant administration, entitlement resolution and usage.
// Platform authentication roles remain separate from roles inside a company.
package company

import (
	"context"
	"errors"
	"strings"
	"time"
)

var (
	ErrPrivateContent = errors.New("public review contains contact details or links")
	ErrReviewExists   = errors.New("a review already exists for this company and experience type")
	ErrNotFound       = errors.New("company resource not found")
	ErrForbidden      = errors.New("company permission denied")
	ErrInvalid        = errors.New("invalid company input")
	ErrLimit          = errors.New("company allocation reached")
	ErrInactive       = errors.New("talent subscription inactive")
)

var PremiumFeatures = []string{"talent.discovery", "talent.smart_pools", "talent.alerts", "talent.outreach", "talent.analytics", "talent.intelligence"}
var CapacityKeys = []string{"sub_admins", "recruiters", "talent_seats", "active_jobs", "saved_searches", "smart_pools", "outreach_sequences"}
var UsageKeys = []string{"talent_profile_unlock", "outreach_message"}

type Subscription struct {
	CompanyID      string            `json:"company_id"`
	Managed        bool              `json:"managed"`
	PlanName       string            `json:"plan_name"`
	State          string            `json:"state"`
	PeriodStart    *time.Time        `json:"period_start,omitempty"`
	PeriodEnd      *time.Time        `json:"period_end,omitempty"`
	GraceUntil     *time.Time        `json:"grace_until,omitempty"`
	CancelAtEnd    bool              `json:"cancel_at_end"`
	Features       map[string]bool   `json:"features"`
	Capacity       map[string]*int64 `json:"capacity"`
	Usage          map[string]*int64 `json:"usage"`
	FreeCapacity   map[string]*int64 `json:"free_capacity"`
	LimitsApproved bool              `json:"limits_approved"`
}

type Override struct {
	ID         string    `json:"id"`
	Key        string    `json:"key"`
	Enabled    *bool     `json:"enabled,omitempty"`
	Additional *int64    `json:"additional,omitempty"`
	ExpiresAt  time.Time `json:"expires_at"`
	Reason     string    `json:"reason"`
}

type Effective struct {
	CompanyID      string            `json:"company_id"`
	Managed        bool              `json:"managed"`
	State          string            `json:"state"`
	PlanName       string            `json:"plan_name"`
	PreviousPlan   string            `json:"previous_plan,omitempty"`
	PremiumUntil   *time.Time        `json:"premium_until,omitempty"`
	PeriodStart    *time.Time        `json:"period_start,omitempty"`
	PeriodEnd      *time.Time        `json:"period_end,omitempty"`
	Features       map[string]bool   `json:"features"`
	Capacity       map[string]*int64 `json:"capacity"`
	Usage          map[string]*int64 `json:"usage"`
	LimitsApproved bool              `json:"limits_approved"`
	DataPreserved  bool              `json:"data_preserved"`
}

func contains(keys []string, key string) bool {
	for _, value := range keys {
		if value == key {
			return true
		}
	}
	return false
}
func cloneLimits(values map[string]*int64) map[string]*int64 {
	result := map[string]*int64{}
	for key, value := range values {
		if value != nil {
			n := *value
			result[key] = &n
		} else {
			result[key] = nil
		}
	}
	return result
}

func ValidateSubscription(s Subscription) error {
	if (s.PeriodStart == nil) != (s.PeriodEnd == nil) || (s.PeriodStart != nil && s.PeriodEnd != nil && !s.PeriodEnd.After(*s.PeriodStart)) {
		return ErrInvalid
	}
	if len(strings.TrimSpace(s.PlanName)) < 1 || len(s.PlanName) > 80 {
		return ErrInvalid
	}
	if !contains([]string{"free", "active", "payment_due", "past_due", "expired"}, s.State) {
		return ErrInvalid
	}
	if s.Managed && s.State != "free" && (s.PeriodStart == nil || s.PeriodEnd == nil || !s.PeriodEnd.After(*s.PeriodStart)) {
		return ErrInvalid
	}
	if s.GraceUntil != nil && (s.PeriodEnd == nil || s.GraceUntil.Before(*s.PeriodEnd) || s.GraceUntil.After(s.PeriodEnd.Add(90*24*time.Hour))) {
		return ErrInvalid
	}
	for key := range s.Features {
		if !contains(PremiumFeatures, key) {
			return ErrInvalid
		}
	}
	for _, item := range []struct {
		keys   []string
		values map[string]*int64
	}{{CapacityKeys, s.Capacity}, {CapacityKeys, s.FreeCapacity}, {UsageKeys, s.Usage}} {
		for key, value := range item.values {
			if !contains(item.keys, key) || (value != nil && (*value < 0 || *value > 1000000000)) {
				return ErrInvalid
			}
		}
	}
	return nil
}

// Resolve is deliberately read-only. Expiration reduces capabilities; it never
// deletes records, changes user accounts or uses the security-suspension state.
func Resolve(s Subscription, overrides []Override, now time.Time) Effective {
	result := Effective{CompanyID: s.CompanyID, Managed: s.Managed, State: s.State, PlanName: s.PlanName, Features: map[string]bool{}, Capacity: cloneLimits(s.Capacity), Usage: cloneLimits(s.Usage), LimitsApproved: s.LimitsApproved, DataPreserved: true, PeriodStart: s.PeriodStart, PeriodEnd: s.PeriodEnd}
	if !s.Managed {
		result.State = "legacy_access"
		result.PlanName = "Existing access preserved"
		result.LimitsApproved = false
		for _, key := range PremiumFeatures {
			result.Features[key] = true
		}
		result.Capacity = map[string]*int64{}
		result.Usage = map[string]*int64{}
		return result
	}
	active := s.PeriodStart != nil && s.PeriodEnd != nil && !now.Before(*s.PeriodStart) && now.Before(*s.PeriodEnd) && s.State != "free" && s.State != "expired"
	if active {
		result.PremiumUntil = s.PeriodEnd
		if s.CancelAtEnd {
			result.State = "cancellation_scheduled"
		}
	}
	if !active && !s.CancelAtEnd && (s.State == "past_due" || s.State == "payment_due") && s.PeriodEnd != nil && !now.Before(*s.PeriodEnd) {
		until := s.PeriodEnd.Add(7 * 24 * time.Hour)
		if s.GraceUntil != nil {
			until = *s.GraceUntil
		}
		if now.Before(until) {
			active = true
			result.State = "grace"
			result.PremiumUntil = &until
		}
	}
	if active {
		for _, key := range PremiumFeatures {
			result.Features[key] = s.Features[key]
		}
	} else {
		result.PreviousPlan = s.PlanName
		result.PlanName = "SapienWorx Recruit Free"
		result.State = "free"
		result.Capacity = cloneLimits(s.FreeCapacity)
		result.Usage = map[string]*int64{}
		for _, key := range PremiumFeatures {
			result.Features[key] = false
		}
	}
	for _, grant := range overrides {
		if !now.Before(grant.ExpiresAt) {
			continue
		}
		// Feature add-ons refine an active subscription. Extending an expired
		// subscription requires an audited period extension, not an unmetered grant.
		if active && grant.Enabled != nil && contains(PremiumFeatures, grant.Key) {
			result.Features[grant.Key] = *grant.Enabled
		}
		if grant.Additional != nil && *grant.Additional > 0 {
			target := result.Capacity
			if contains(UsageKeys, grant.Key) {
				target = result.Usage
			}
			if current, ok := target[grant.Key]; ok && current != nil {
				n := *current + *grant.Additional
				target[grant.Key] = &n
			}
		}
	}
	return result
}

func (e Effective) Allows(feature string) bool { return e.Features[feature] }
func (e Effective) Limit(resource string, usage bool) *int64 {
	if !e.LimitsApproved {
		return nil
	}
	if usage {
		return e.Usage[resource]
	}
	return e.Capacity[resource]
}

// Store is the persistence boundary. Domain policy can be tested without SQL.
type Store interface {
	Subscription(context.Context, string) (Subscription, []Override, error)
	CompanyForRecruiter(context.Context, string) (string, error)
}
type Service struct {
	store Store
	now   func() time.Time
}

func NewService(store Store) *Service { return &Service{store: store, now: time.Now} }
func (s *Service) Effective(ctx context.Context, companyID string) (Effective, error) {
	policy, grants, err := s.store.Subscription(ctx, companyID)
	if err != nil {
		return Effective{}, err
	}
	return Resolve(policy, grants, s.now().UTC()), nil
}
func (s *Service) RecruiterAccess(ctx context.Context, userID string) (Effective, error) {
	id, err := s.store.CompanyForRecruiter(ctx, userID)
	if err != nil {
		return Effective{}, err
	}
	return s.Effective(ctx, id)
}
