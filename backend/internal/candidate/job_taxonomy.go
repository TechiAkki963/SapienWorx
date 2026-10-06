package candidate

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	"strings"
)

type JobLocation struct {
	ID            string   `json:"id"`
	CanonicalName string   `json:"canonical_name"`
	State         string   `json:"state"`
	CountryCode   string   `json:"country_code"`
	Aliases       []string `json:"aliases"`
}

func (s *Service) JobLocations(ctx context.Context, query string) ([]JobLocation, error) {
	query = strings.TrimSpace(query)
	if len(query) > 180 {
		return nil, ErrWorkspaceInput
	}
	rows, err := s.db.Query(ctx, `SELECT id,canonical_name,state,country_code,aliases FROM workforce.geography_entities WHERE status='active' AND ($1='' OR strpos(lower(canonical_name),lower($1))>0 OR EXISTS(SELECT 1 FROM unnest(aliases) a WHERE strpos(lower(a),lower($1))>0)) ORDER BY CASE WHEN lower(canonical_name)=lower($1) THEN 0 ELSE 1 END,canonical_name,country_code LIMIT 20`, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []JobLocation{}
	for rows.Next() {
		var v JobLocation
		if err := rows.Scan(&v.ID, &v.CanonicalName, &v.State, &v.CountryCode, &v.Aliases); err != nil {
			return nil, err
		}
		result = append(result, v)
	}
	return result, rows.Err()
}
func normalizedSearchInputs(values []string, ids bool) ([]string, error) {
	if len(values) > 20 {
		return nil, ErrWorkspaceInput
	}
	result := []string{}
	seen := map[string]bool{}
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if len(v) > 180 || ids && !workspaceUUID.MatchString(v) {
			return nil, ErrWorkspaceInput
		}
		key := strings.ToLower(v)
		if !seen[key] {
			seen[key] = true
			result = append(result, v)
		}
	}
	return result, nil
}
func (s *Service) structuredTerms(ctx context.Context, ids, labels, types []string) ([]string, []string, error) {
	cleanIDs, err := normalizedSearchInputs(ids, true)
	if err != nil {
		return nil, nil, err
	}
	cleanLabels, err := normalizedSearchInputs(labels, false)
	if err != nil {
		return nil, nil, err
	}
	terms := []string{}
	if len(cleanIDs) > 0 {
		rows, err := s.db.Query(ctx, `SELECT id::text,canonical_name FROM workforce.taxonomy_entities WHERE id=ANY($1::uuid[]) AND entity_type=ANY($2::text[]) AND status='active'`, cleanIDs, types)
		if err != nil {
			return nil, nil, err
		}
		n := 0
		for rows.Next() {
			var id, label string
			if err = rows.Scan(&id, &label); err != nil {
				rows.Close()
				return nil, nil, err
			}
			terms = append(terms, label)
			n++
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, nil, err
		}
		if n != len(cleanIDs) {
			return nil, nil, ErrWorkspaceInput
		}
	}
	for _, label := range cleanLabels {
		term, err := s.resolveWorkforceTerm(ctx, label, types)
		if err != nil {
			return nil, nil, err
		}
		if term != nil {
			cleanIDs = append(cleanIDs, term.ID)
			terms = append(terms, term.Canonical)
		} else {
			terms = append(terms, label)
		}
	}
	dedup := func(values []string) []string {
		out := []string{}
		seen := map[string]bool{}
		for _, v := range values {
			key := strings.ToLower(v)
			if !seen[key] {
				seen[key] = true
				out = append(out, v)
			}
		}
		return out
	}
	cleanIDs = dedup(cleanIDs)
	terms = dedup(terms)
	return cleanIDs, terms, nil
}
func (s *Service) structuredLocations(ctx context.Context, ids, labels []string) ([]string, []string, error) {
	cleanIDs, err := normalizedSearchInputs(ids, true)
	if err != nil {
		return nil, nil, err
	}
	terms, err := normalizedSearchInputs(labels, false)
	if err != nil {
		return nil, nil, err
	}
	if len(cleanIDs) > 0 {
		var n int
		if err = s.db.QueryRow(ctx, `SELECT count(*) FROM workforce.geography_entities WHERE id=ANY($1::uuid[]) AND status='active'`, cleanIDs).Scan(&n); err != nil {
			return nil, nil, err
		}
		if n != len(cleanIDs) {
			return nil, nil, ErrWorkspaceInput
		}
	}
	unresolved := []string{}
	for _, label := range terms {
		var id string
		err = s.db.QueryRow(ctx, `SELECT id::text FROM workforce.geography_entities WHERE status='active' AND (workforce.normalize_term(canonical_name)=workforce.normalize_term($1) OR EXISTS(SELECT 1 FROM unnest(aliases) a WHERE workforce.normalize_term(a)=workforce.normalize_term($1))) ORDER BY country_code,id LIMIT 1`, label).Scan(&id)
		if err != nil {
			if !errors.Is(err, pgx.ErrNoRows) {
				return nil, nil, err
			}
			unresolved = append(unresolved, label)
		} else {
			cleanIDs = append(cleanIDs, id)
		}
	}
	seen := map[string]bool{}
	unique := []string{}
	for _, id := range cleanIDs {
		if !seen[id] {
			seen[id] = true
			unique = append(unique, id)
		}
	}
	return unique, unresolved, nil
}
