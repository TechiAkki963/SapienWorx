package workforce

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgxpool"
)

const RoleBlueprintVersion = "rb-1.1"

var ErrRoleBlueprintUnavailable = errors.New("approved role guidance unavailable")

var roleEmployerClaim = regexp.MustCompile(`(?i)(\b(salary|bonus|benefits|insurance|visa sponsorship|working hours|night shift|remote policy|hybrid policy|notice period|company culture|company size)\b|[$₹]|ignore.{0,40}instructions|system prompt)`)

type RoleTaxonomyReference struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	EntityType string `json:"entity_type"`
}

// RoleBlueprint is a read projection of approved workforce entities, relations
// and occupation metadata. It is not an employer requirement or a second taxonomy.
type RoleBlueprint struct {
	Version               string                  `json:"version"`
	Source                string                  `json:"source"`
	ApprovalStatus        string                  `json:"approval_status"`
	EmployerPolicy        bool                    `json:"employer_policy"`
	Occupation            RoleTaxonomyReference   `json:"occupation"`
	JobFamily             RoleTaxonomyReference   `json:"job_family"`
	FunctionalArea        RoleTaxonomyReference   `json:"functional_area"`
	IndustryContext       RoleTaxonomyReference   `json:"industry_context"`
	AboutRole             string                  `json:"about_role"`
	CoreResponsibilities  []string                `json:"core_responsibilities"`
	CoreSkills            []RoleTaxonomyReference `json:"core_skills"`
	OptionalSkills        []RoleTaxonomyReference `json:"optional_skills"`
	CommonTools           []RoleTaxonomyReference `json:"common_tools"`
	CommonCompetencies    []RoleTaxonomyReference `json:"common_competencies"`
	TypicalQualifications []string                `json:"typical_qualifications"`
	ReviewNotes           []string                `json:"review_notes"`
}

func (b RoleBlueprint) Valid() bool {
	if b.Version != RoleBlueprintVersion || b.Source != "product_authorised_occupation_guidance" || b.ApprovalStatus != "approved" || b.EmployerPolicy || b.Occupation.ID == "" || b.Occupation.EntityType != "occupation" || len(b.CoreResponsibilities) < 5 || len(b.CoreResponsibilities) > 8 || len(b.CoreSkills) < 3 || len(b.CoreSkills) > 10 || len(b.OptionalSkills) > 8 || b.AboutRole == "" {
		return false
	}
	if b.JobFamily.ID == "" || b.JobFamily.EntityType != "job_family" || b.FunctionalArea.ID == "" || b.FunctionalArea.EntityType != "functional_area" || b.IndustryContext.ID == "" || b.IndustryContext.EntityType != "industry" {
		return false
	}
	if roleEmployerClaim.MatchString(b.AboutRole + " " + strings.Join(b.CoreResponsibilities, " ")) {
		return false
	}
	seenSkills := map[string]bool{}
	for _, item := range append(append([]RoleTaxonomyReference{}, b.CoreSkills...), b.OptionalSkills...) {
		key := strings.ToLower(strings.TrimSpace(item.Name))
		if seenSkills[key] {
			return false
		}
		seenSkills[key] = true
	}
	text := append([]string{b.AboutRole, b.Occupation.Name, b.JobFamily.Name, b.FunctionalArea.Name, b.IndustryContext.Name}, b.CoreResponsibilities...)
	text = append(text, b.ReviewNotes...)
	// No unscoped degree/licence requirements in this initial jurisdiction-neutral catalog.
	if len(b.TypicalQualifications) != 0 || len(b.ReviewNotes) > 6 {
		return false
	}
	for _, items := range [][]RoleTaxonomyReference{b.CoreSkills, b.OptionalSkills, b.CommonTools, b.CommonCompetencies} {
		if len(items) > 12 {
			return false
		}
		for _, item := range items {
			if item.ID == "" || item.Name == "" || !strings.Contains("|competency|skill|tool|technology|equipment|", "|"+item.EntityType+"|") {
				return false
			}
			text = append(text, item.Name)
		}
	}
	for _, s := range text {
		if !utf8.ValidString(s) || len(s) > 800 || strings.TrimSpace(s) == "" || strings.IndexFunc(s, unicode.IsControl) >= 0 {
			return false
		}
	}
	return true
}

// GenerationRoleBlueprint requires an exact active, approved occupation. No fuzzy
// title guess, unchecked catalog fallback or employer-specific inference occurs.
func GenerationRoleBlueprint(ctx context.Context, db *pgxpool.Pool, title string) (RoleBlueprint, error) {
	var b RoleBlueprint
	if db == nil {
		return b, ErrRoleBlueprintUnavailable
	}
	var raw []byte
	err := db.QueryRow(ctx, `SELECT id,canonical_name,entity_type,metadata->'jd_generation_blueprint_v1_1'
 FROM workforce.taxonomy_entities WHERE entity_type='occupation' AND normalized_name=workforce.normalize_term($1)
 AND status='active' AND country_scope='' AND language_code='en' AND metadata ? 'jd_generation_blueprint_v1_1'`, title).Scan(&b.Occupation.ID, &b.Occupation.Name, &b.Occupation.EntityType, &raw)
	if err != nil || json.Unmarshal(raw, &b) != nil {
		return RoleBlueprint{}, ErrRoleBlueprintUnavailable
	}
	// References must be rebuilt from active taxonomy relationships, not trusted
	// from similarly named fields placed in occupation metadata.
	b.CoreSkills, b.OptionalSkills, b.CommonTools, b.CommonCompetencies = nil, nil, nil, nil
	b.JobFamily, b.FunctionalArea, b.IndustryContext = RoleTaxonomyReference{}, RoleTaxonomyReference{}, RoleTaxonomyReference{}
	// Metadata cannot override the selected canonical occupation identity.
	if db.QueryRow(ctx, `SELECT id,canonical_name,entity_type FROM workforce.taxonomy_entities WHERE entity_type='occupation' AND normalized_name=workforce.normalize_term($1) AND status='active' AND country_scope='' AND language_code='en'`, title).Scan(&b.Occupation.ID, &b.Occupation.Name, &b.Occupation.EntityType) != nil {
		return RoleBlueprint{}, ErrRoleBlueprintUnavailable
	}
	rows, err := db.Query(ctx, `SELECT t.id,t.canonical_name,t.entity_type,r.metadata FROM workforce.taxonomy_relationships r
 JOIN workforce.taxonomy_entities t ON t.id=r.target_entity_id WHERE r.source_entity_id=$1 AND r.status='active' AND t.status='active'
 AND (r.relationship_type='occupation_competency' OR r.relationship_type IN ('occupation_job_family','occupation_functional_area','occupation_industry')) ORDER BY t.canonical_name,t.id`, b.Occupation.ID)
	if err != nil {
		return RoleBlueprint{}, ErrRoleBlueprintUnavailable
	}
	defer rows.Close()
	for rows.Next() {
		var item RoleTaxonomyReference
		var data []byte
		var bands map[string]bool
		if rows.Scan(&item.ID, &item.Name, &item.EntityType, &data) != nil {
			return RoleBlueprint{}, ErrRoleBlueprintUnavailable
		}
		// Relationship metadata may have other JSON values; read only owned boolean keys.
		var metadata map[string]json.RawMessage
		if json.Unmarshal(data, &metadata) != nil {
			return RoleBlueprint{}, ErrRoleBlueprintUnavailable
		}
		bands = map[string]bool{}
		for _, band := range []string{"core_skills", "optional_skills", "common_tools", "common_competencies", "job_family", "functional_area", "industry_context"} {
			var enabled bool
			_ = json.Unmarshal(metadata["jd_generation_v1_1_"+band], &enabled)
			bands[band] = enabled
		}
		if bands["core_skills"] {
			b.CoreSkills = append(b.CoreSkills, item)
		}
		if bands["optional_skills"] {
			b.OptionalSkills = append(b.OptionalSkills, item)
		}
		if bands["common_tools"] {
			b.CommonTools = append(b.CommonTools, item)
		}
		if bands["common_competencies"] {
			b.CommonCompetencies = append(b.CommonCompetencies, item)
		}
		if bands["job_family"] {
			b.JobFamily = item
		}
		if bands["functional_area"] {
			b.FunctionalArea = item
		}
		if bands["industry_context"] {
			b.IndustryContext = item
		}
	}
	if rows.Err() != nil || !b.Valid() {
		return RoleBlueprint{}, ErrRoleBlueprintUnavailable
	}
	return b, nil
}
