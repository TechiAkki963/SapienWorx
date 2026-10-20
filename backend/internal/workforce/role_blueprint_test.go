package workforce

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestRoleBlueprintCatalogIsVersionedDistinctAndPolicyFree(t *testing.T) {
	raw, e := os.ReadFile("testdata/role-blueprints-v1.1.json")
	if e != nil {
		t.Fatal(e)
	}
	var rows []struct {
		Title          string   `json:"title"`
		About          string   `json:"about_role"`
		Duties         []string `json:"core_responsibilities"`
		Skills         []string `json:"core_skills"`
		Optional       []string `json:"optional_skills"`
		Qualifications []string `json:"typical_qualifications"`
	}
	if json.Unmarshal(raw, &rows) != nil || len(rows) != 8 {
		t.Fatal("eight roles")
	}
	seen := map[string]bool{}
	for _, row := range rows {
		if seen[row.Title] || len(row.Duties) != 6 || len(row.Skills) < 3 || len(row.Optional) == 0 || len(row.Qualifications) != 0 {
			t.Fatal("catalog coverage")
		}
		seen[row.Title] = true
		all := strings.ToLower(row.About + strings.Join(row.Duties, " ") + strings.Join(row.Skills, " "))
		for _, bad := range []string{"salary", "bonus", "insurance", "visa sponsorship", "night shift", "aws certification", "kubernetes required", "degree required"} {
			if strings.Contains(all, bad) {
				t.Fatal("employer policy in role guidance", bad)
			}
		}
		if row.Title != "Java Backend Developer" && strings.Contains(all, "rest api") {
			t.Fatal("software role leakage")
		}
	}
}

func TestRoleBlueprintRejectsUnapprovedUnscopedOrInvalidGuidance(t *testing.T) {
	b := RoleBlueprint{Version: RoleBlueprintVersion, Source: "product_authorised_occupation_guidance", ApprovalStatus: "approved", Occupation: RoleTaxonomyReference{ID: "occupation", Name: "Synthetic occupation", EntityType: "occupation"}, JobFamily: RoleTaxonomyReference{ID: "family", Name: "Family", EntityType: "job_family"}, FunctionalArea: RoleTaxonomyReference{ID: "area", Name: "Area", EntityType: "functional_area"}, IndustryContext: RoleTaxonomyReference{ID: "industry", Name: "Industry", EntityType: "industry"}, AboutRole: "Synthetic role guidance", CoreResponsibilities: []string{"One", "Two", "Three", "Four", "Five"}, CoreSkills: []RoleTaxonomyReference{{ID: "1", Name: "One", EntityType: "competency"}, {ID: "2", Name: "Two", EntityType: "competency"}, {ID: "3", Name: "Three", EntityType: "competency"}}}
	if !b.Valid() {
		t.Fatal("valid guidance rejected")
	}
	for _, kind := range []string{"version", "unapproved", "policy", "qualifications", "duties", "skills", "control", "employer-claim", "missing-source", "duplicate-skill"} {
		t.Run(kind, func(t *testing.T) {
			c := b
			switch kind {
			case "version":
				c.Version = "unknown"
			case "unapproved":
				c.ApprovalStatus = "pending"
			case "policy":
				c.EmployerPolicy = true
			case "qualifications":
				c.TypicalQualifications = []string{"Unscoped degree"}
			case "duties":
				c.CoreResponsibilities = c.CoreResponsibilities[:2]
			case "skills":
				c.CoreSkills = nil
			case "control":
				c.AboutRole = "bad\x00text"
			case "employer-claim":
				c.AboutRole = "Salary and insurance included."
			case "missing-source":
				c.JobFamily.ID = ""
			case "duplicate-skill":
				c.OptionalSkills = []RoleTaxonomyReference{c.CoreSkills[0]}
			}
			if c.Valid() {
				t.Fatal("invalid guidance accepted")
			}
		})
	}
}
