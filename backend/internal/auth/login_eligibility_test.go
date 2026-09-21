package auth

import (
	"errors"
	"testing"
	"time"
)

func TestLoginEligibility(t *testing.T) {
	now := time.Now()
	tests := []struct {
		name   string
		record loginRecord
		want   error
	}{
		{"verified candidate", loginRecord{Role: RoleCandidate, Status: "active", IsActive: true, EmailVerifiedAt: &now}, nil},
		{"unverified candidate", loginRecord{Role: RoleCandidate, Status: "pending_verification", IsActive: true}, ErrEmailUnverified},
		{"verified recruiter pending approval", loginRecord{Role: RoleRecruiter, Status: "pending_verification", IsActive: true, EmailVerifiedAt: &now, RecruiterVerification: "pending"}, ErrRecruiterPending},
		{"approved recruiter", loginRecord{Role: RoleRecruiter, Status: "active", IsActive: true, EmailVerifiedAt: &now, RecruiterVerification: "verified"}, nil},
		{"unverified recruiter", loginRecord{Role: RoleRecruiter, Status: "pending_verification", IsActive: true, RecruiterVerification: "pending"}, ErrEmailUnverified},
		{"disabled candidate", loginRecord{Role: RoleCandidate, Status: "active", IsActive: false, EmailVerifiedAt: &now}, ErrAccountUnavailable},
		{"suspended candidate", loginRecord{Role: RoleCandidate, Status: "suspended", IsActive: true, EmailVerifiedAt: &now}, ErrAccountUnavailable},
		{"active master admin", loginRecord{Role: RoleMasterAdmin, Status: "active", IsActive: true}, nil},
		{"disabled master admin", loginRecord{Role: RoleMasterAdmin, Status: "disabled", IsActive: true}, ErrAccountUnavailable},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := loginEligibility(tt.record); !errors.Is(err, tt.want) {
				t.Fatalf("loginEligibility() = %v; want %v", err, tt.want)
			}
		})
	}
}
