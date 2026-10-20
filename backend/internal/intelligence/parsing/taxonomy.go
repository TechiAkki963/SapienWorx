package parsing

import (
	"context"
	"strings"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

type SkillMapping struct {
	ID   string
	Name string
}

func (s SQLStore) SkillAliases(ctx context.Context) (map[string]SkillMapping, error) {
	rows, err := s.DB.Query(ctx, `SELECT s.id,s.canonical_name,a.alias FROM intelligence.skills s LEFT JOIN intelligence.skill_aliases a ON a.skill_id=s.id ORDER BY s.id,a.alias LIMIT 20001`)
	if err != nil {
		return nil, ErrUnavailable
	}
	defer rows.Close()
	out := map[string]SkillMapping{}
	n := 0
	for rows.Next() {
		var id, name string
		var alias *string
		if rows.Scan(&id, &name, &alias) != nil {
			return nil, ErrUnavailable
		}
		n++
		if n > 20000 {
			return nil, ErrUnavailable
		}
		out[contract.ComparisonKey(name)] = SkillMapping{id, name}
		if alias != nil {
			out[contract.ComparisonKey(*alias)] = SkillMapping{id, name}
		}
	}
	if rows.Err() != nil {
		return nil, ErrUnavailable
	}
	return out, nil
}
func normalizeCV(data contract.ProfileData, aliases map[string]SkillMapping) (contract.ProfileData, int, int) {
	mapping := map[string]contract.EntityRef{}
	for key, v := range aliases {
		id, name, namespace := v.ID, v.Name, "intelligence"
		mapping[key] = contract.EntityRef{ID: &id, Name: &name, Namespace: &namespace}
	}
	data = contract.NormalizeData(data)
	data.Skills = contract.NormalizeSkills(data.Skills, mapping)
	resolved := 0
	for _, skill := range data.Skills {
		if skill.Entity.ID != nil {
			resolved++
		}
	}
	return data, resolved, len(data.Skills)
}
func normalizeJob(skills []string, aliases map[string]SkillMapping) ([]string, int) {
	out := []string{}
	seen := map[string]bool{}
	resolved := 0
	for _, raw := range skills {
		value := strings.TrimSpace(raw)
		if v, ok := aliases[contract.ComparisonKey(value)]; ok {
			value = v.Name
			resolved++
		}
		key := contract.ComparisonKey(value)
		if value != "" && !seen[key] {
			out = append(out, value)
			seen[key] = true
		}
	}
	return out, resolved
}
