package gateway

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/json"
)

// Rollout policy is part of the existing reviewed/promoted model configuration.
// No policy means OFF. Candidates have no employer tenant: use explicit actors
// until the percentage/all-beta stages are separately approved.
func BetaRolloutAllowed(raw json.RawMessage, scope Scope) bool {
	var config struct {
		Beta struct {
			Stage      string   `json:"stage"`
			Actors     []string `json:"actor_ids"`
			Tenants    []string `json:"tenant_ids"`
			Percentage int      `json:"percentage"`
		} `json:"beta_rollout"`
	}
	if len(raw) > 65536 || json.Unmarshal(raw, &config) != nil || !validScope(scope) {
		return false
	}
	p := config.Beta
	if len(p.Actors) > 1000 || len(p.Tenants) > 1000 || p.Percentage < 0 || p.Percentage > 100 {
		return false
	}
	for _, ids := range [][]string{p.Actors, p.Tenants} {
		for _, id := range ids {
			if !uuid.MatchString(id) {
				return false
			}
		}
	}
	contains := func(ids []string, value string) bool {
		for _, id := range ids {
			if id == value {
				return true
			}
		}
		return false
	}
	switch p.Stage {
	case "internal":
		return contains(p.Actors, scope.UserID)
	case "tenants":
		return contains(p.Actors, scope.UserID) || scope.TenantID != "" && contains(p.Tenants, scope.TenantID)
	case "percentage":
		if p.Percentage < 1 || p.Percentage > 10 {
			return false
		}
		key := "actor:" + scope.UserID
		if scope.TenantID != "" {
			key = "tenant:" + scope.TenantID
		}
		sum := sha256.Sum256([]byte("sapienworx-beta-ai-v1:" + key))
		return binary.BigEndian.Uint64(sum[:8])%100 < uint64(p.Percentage)
	case "all_beta":
		return p.Percentage == 100
	default:
		return false
	}
}
