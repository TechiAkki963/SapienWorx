package profilecontract

import (
	"encoding/json"
	"reflect"
	"strings"
	"time"
)

// JSONSchema is a local, provider-neutral representation, not an AI prompt or a
// claim that every provider supports this complete schema in one generation.
func JSONSchema(kind string) ([]byte, error) {
	var root reflect.Type
	switch kind {
	case "candidate_profile":
		root = reflect.TypeFor[CandidateProfile]()
	case "parser_result":
		root = reflect.TypeFor[ParserResult]()
	case "review_view":
		root = reflect.TypeFor[ReviewView]()
	case "review_patch":
		root = reflect.TypeFor[ReviewPatch]()
	default:
		return nil, ErrInvalidContract
	}
	defs := map[string]any{}
	var describe func(reflect.Type) map[string]any
	describe = func(t reflect.Type) map[string]any {
		if t == reflect.TypeFor[json.RawMessage]() {
			return map[string]any{}
		}
		if t == reflect.TypeFor[time.Time]() {
			return map[string]any{"type": "string", "format": "date-time"}
		}
		if t.Kind() == reflect.Pointer {
			return map[string]any{"anyOf": []any{describe(t.Elem()), map[string]any{"type": "null"}}}
		}
		switch t.Kind() {
		case reflect.String:
			n := map[string]any{"type": "string"}
			if t == reflect.TypeFor[ParseStatus]() {
				n["enum"] = []string{"uploaded", "validating", "extracting", "parsing", "validating_result", "ready_for_review", "confirmed", "file_rejected", "extraction_failed", "parsing_failed", "validation_failed"}
			}
			if t == reflect.TypeFor[ReviewStatus]() {
				n["enum"] = []string{"unreviewed", "confirmed", "edited", "rejected"}
			}
			return n
		case reflect.Bool:
			return map[string]any{"type": "boolean"}
		case reflect.Int, reflect.Int64, reflect.Uint64:
			return map[string]any{"type": "integer"}
		case reflect.Float64:
			return map[string]any{"type": "number"}
		case reflect.Slice:
			return map[string]any{"type": []string{"array", "null"}, "items": describe(t.Elem())}
		case reflect.Map:
			return map[string]any{"type": []string{"object", "null"}, "additionalProperties": describe(t.Elem())}
		case reflect.Struct:
			name := t.Name()
			if _, exists := defs[name]; exists {
				return map[string]any{"$ref": "#/$defs/" + name}
			}
			defs[name] = map[string]any{}
			properties := map[string]any{}
			required := []string{}
			for i := 0; i < t.NumField(); i++ {
				f := t.Field(i)
				key := strings.Split(f.Tag.Get("json"), ",")[0]
				if key == "" || key == "-" {
					continue
				}
				node := describe(f.Type)
				apply := node
				if f.Type.Kind() == reflect.Pointer {
					apply = node["anyOf"].([]any)[0].(map[string]any)
				}
				if e := f.Tag.Get("enum"); e != "" {
					if f.Type.Kind() == reflect.Slice {
						node["items"] = map[string]any{"type": "string", "enum": strings.Split(e, ",")}
					} else {
						apply["enum"] = strings.Split(e, ",")
					}
				}
				if key == "schema_version" || key == "contract_version" || key == "profile_schema_version" {
					node["const"] = Version
				}
				if key == "confidence" {
					apply["minimum"] = 0
					apply["maximum"] = 1
				}
				if f.Type.Kind() == reflect.Slice {
					node["maxItems"] = collectionLimit("/" + key)
					if key == "issues" {
						node["maxItems"] = 1000
					}
					if key == "decisions" {
						node["maxItems"] = 8192
					}
				}
				if key == "field_metadata" || key == "fields" {
					node["maxProperties"] = 8192
				}
				if f.Type.Kind() != reflect.Pointer && f.Type.Kind() != reflect.Slice && f.Type.Kind() != reflect.Map && f.Type.Kind() != reflect.Struct || t == reflect.TypeFor[FieldMetadata]() {
					required = append(required, key)
				}
				properties[key] = node
			}
			if t == reflect.TypeFor[CandidateProfile]() {
				required = []string{"schema_version", "candidate_id", "profile", "verification"}
			}
			if t == reflect.TypeFor[ParserResult]() {
				required = []string{"contract_version", "profile_schema_version", "result_id", "candidate_id", "resume", "parser_provider", "parser_version", "source_type", "status", "profile", "field_metadata", "created_at"}
			}
			if t == reflect.TypeFor[ReviewPatch]() {
				required = []string{"expected_revision", "decisions"}
			}
			defs[name] = map[string]any{"type": "object", "additionalProperties": false, "properties": properties, "required": required}
			return map[string]any{"$ref": "#/$defs/" + name}
		}
		return map[string]any{}
	}
	ref := describe(root)
	document := map[string]any{"$schema": "https://json-schema.org/draft/2020-12/schema", "$id": "urn:sapienworx:" + kind + ":" + Version, "$ref": ref["$ref"], "$defs": defs}
	return json.MarshalIndent(document, "", "  ")
}
