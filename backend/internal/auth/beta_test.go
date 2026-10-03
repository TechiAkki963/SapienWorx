package auth

import (
	"testing"
	"time"
)

func TestBetaAndProductionRejectEachOthersTokens(t *testing.T) {
	// Also test a mistakenly reused key: issuer/audience must independently isolate environments.
	for _, sameKey := range []bool{false, true} {
		productionSecret := "production-only-secret-01234567890123456789"
		betaSecret := "beta-only-secret-01234567890123456789012345"
		if sameKey {
			betaSecret = productionSecret
		}
		production, err := NewTokenManager(productionSecret, "sapienworx-api", "sapienworx-web", time.Minute, 0)
		if err != nil {
			t.Fatal(err)
		}
		beta, err := NewTokenManager(betaSecret, "sapienworx-beta-api", "sapienworx-beta-web", time.Minute, 0)
		if err != nil {
			t.Fatal(err)
		}
		for _, role := range []Role{RoleCandidate, RoleRecruiter, RoleMasterAdmin} {
			prodToken, err := production.Issue("synthetic-user", role, "prod-session")
			if err != nil {
				t.Fatal(err)
			}
			betaToken, err := beta.Issue("synthetic-user", role, "beta-session")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := beta.Parse(prodToken); err == nil {
				t.Fatal("beta accepted production token")
			}
			if _, err := production.Parse(betaToken); err == nil {
				t.Fatal("production accepted beta token")
			}
			if _, err := beta.Parse(betaToken); err != nil {
				t.Fatal(err)
			}
		}
	}
}
