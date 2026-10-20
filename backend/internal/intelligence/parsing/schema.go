package parsing

import (
	"encoding/json"
	"reflect"
	"sort"
	"strings"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

const JobSchemaVersion = "v1.2"
const CVSchemaVersion = "v1.1"

var jobFields = []string{"title", "department", "employment_type", "work_mode", "role_category", "location", "min_experience_years", "max_experience_years", "skills", "description", "responsibilities", "company_overview", "why_join", "hiring_process", "education_requirements", "openings", "min_salary_lakhs", "max_salary_lakhs"}

// JobSchema projects existing DetailedJobInput names/types. Operational ownership,
// notes, publication and referral policy cannot be model supplied. Compensation
// uses the existing optional editor fields, strictly explicit annual INR only.
func JobSchema() *gateway.OutputSchema {
	allowed := map[string]bool{}
	for _, key := range jobFields {
		allowed[key] = true
	}
	properties := map[string]any{}
	t := reflect.TypeFor[recruiter.DetailedJobInput]()
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		key := strings.Split(f.Tag.Get("json"), ",")[0]
		if !allowed[key] {
			continue
		}
		typ := f.Type
		if typ.Kind() == reflect.Pointer {
			typ = typ.Elem()
		}
		n := map[string]any{}
		switch typ.Kind() {
		case reflect.String:
			n = map[string]any{"type": []string{"string", "null"}, "maxLength": 8000}
		case reflect.Int:
			n = map[string]any{"type": []string{"integer", "null"}, "minimum": 0, "maximum": 60}
		case reflect.Float64:
			n = map[string]any{"type": []string{"number", "null"}, "minimum": 0, "description": "Explicit annual INR salary in lakhs (100000 INR per lakh). Use null if missing, ambiguous, non-INR, or not annual. Never estimate, annualize monthly pay, or convert currencies."}
		case reflect.Slice:
			n = map[string]any{"type": []string{"array", "null"}, "maxItems": 100, "items": map[string]any{"type": "string", "maxLength": 500}}
		}
		if key == "openings" {
			n["maximum"] = 10000
		}
		if key == "employment_type" {
			n["enum"] = []any{nil, "full_time", "part_time", "contract", "internship", "temporary"}
		}
		if key == "work_mode" {
			n["enum"] = []any{nil, "onsite", "hybrid", "remote"}
		}
		if key == "skills" {
			n["description"] = "Required skills explicitly stated in the document. Never promote preferred or optional skills into requirements."
		}
		if description, ok := map[string]string{
			"department":             "Organizational department/team explicitly labelled in source. Never infer from title, industry, job family or skills. Otherwise null.",
			"role_category":          "Explicit job family/role category, preserving source wording. Do not substitute industry, department or shortened title.",
			"education_requirements": "Academic education and degrees only. Licences and certifications are NOT education. Preserve them in source context for owner review; no typed credential field is available here.",
			"min_experience_years":   "Explicit minimum experience in years. Zero is valid, null is unknown. Do not default missing experience to zero.",
			"openings":               "Explicit positive number of openings; null if unknown. Zero is invalid, never default missing to one.",
		}[key]; ok {
			n["description"] = description
		}
		if key == "openings" {
			n["minimum"] = 1
		}
		properties[key] = n
	}
	raw, _ := json.Marshal(map[string]any{"type": "object", "properties": properties, "required": jobFields, "additionalProperties": false})
	return &gateway.OutputSchema{Name: "sapienworx_job_draft_v1_2", JSON: raw}
}

// CVSchema reuses the canonical ProfileData definitions. Only the provider wire
// projection makes optional keys required/nullable and forbids server IDs.
func CVSchema() (*gateway.OutputSchema, error) {
	raw, err := contract.JSONSchema("candidate_profile")
	if err != nil {
		return nil, err
	}
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return nil, ErrInvalid
	}
	defs := doc["$defs"].(map[string]any)
	used := map[string]any{}
	var walk func(any)
	walk = func(value any) {
		switch v := value.(type) {
		case map[string]any:
			if ref, ok := v["$ref"].(string); ok {
				key := strings.TrimPrefix(ref, "#/$defs/")
				if _, seen := used[key]; !seen {
					node := defs[key]
					used[key] = node
					walk(node)
				}
			}
			if props, ok := v["properties"].(map[string]any); ok {
				keys := []string{}
				for key, node := range props {
					keys = append(keys, key)
					switch key {
					case "id", "namespace", "experience_id", "education_id", "project_id":
						props[key] = map[string]any{"type": "null"}
					default:
						walk(node)
					}
				}
				sort.Strings(keys)
				v["required"] = keys
				v["additionalProperties"] = false
			}
			for key, node := range v {
				if key != "properties" {
					walk(node)
				}
			}
		case []any:
			for _, node := range v {
				walk(node)
			}
		}
	}
	root := defs["ProfileData"].(map[string]any)
	walk(root)
	delete(used, "ProfileData")
	if props, ok := used["Identity"].(map[string]any); ok {
		props["description"] = "Preserve the explicit candidate name, including an unambiguous CV header. Unknown/redacted names remain null. Do not infer identity from email or employer."
	}
	if props, ok := used["Professional"].(map[string]any); ok {
		props["description"] = "Preserve source headline separately from current designation. Explicit total experience zero is valid; missing history does not mean zero. No inferred seniority."
	}
	root["$defs"] = used
	encoded, err := json.Marshal(root)
	if err != nil {
		return nil, err
	}
	return &gateway.OutputSchema{Name: "sapienworx_cv_profile_v1_1", JSON: encoded}, nil
}
