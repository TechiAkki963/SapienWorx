package company

func scopeContains(outer, inner Scope) bool {
	if outer.All {
		return true
	}
	if inner.All {
		return false
	}
	for _, pair := range [][2][]string{{outer.Departments, inner.Departments}, {outer.Locations, inner.Locations}, {outer.JobIDs, inner.JobIDs}} {
		for _, value := range pair[1] {
			found := false
			for _, allowed := range pair[0] {
				// Resource queries compare scope values exactly. Delegation must use
				// the same comparison, or case/spacing changes could expand access.
				if value == allowed {
					found = true
					break
				}
			}
			if !found {
				return false
			}
		}
	}
	return true
}
func canManageTeammate(actor Member, role string, scope Scope) bool {
	return actor.Owner() || (actor.Status == "active" && actor.Role == "sub_admin" && (role == "recruiter" || role == "collaborator") && scopeContains(actor.Scope, scope))
}
