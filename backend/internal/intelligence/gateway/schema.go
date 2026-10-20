package gateway

import (
	"bytes"
	"encoding/json"
	"io"
	"regexp"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

var schemaName = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)

// ValidateStructuredOutput exposes the same bounded, duplicate-key rejecting
// validation used at provider admission for deterministic offline replay.
func ValidateStructuredOutput(output *OutputSchema, raw []byte) error {
	if len(raw) > 2<<20 {
		return failure(SchemaValidationFailed)
	}
	compiled, err := compileSchema(output)
	if err != nil {
		return err
	}
	return validateOutput(compiled, string(raw))
}

type noResources struct{}

func (noResources) Load(string) (any, error) { return nil, failure(InvalidRequest) }

func compileSchema(output *OutputSchema) (*jsonschema.Schema, error) {
	if output == nil {
		return nil, nil
	}
	if !schemaName.MatchString(output.Name) || len(output.JSON) > 16384 {
		return nil, failure(InvalidRequest)
	}
	var schema map[string]any
	if json.Unmarshal(output.JSON, &schema) != nil || schema["type"] != "object" || schema["additionalProperties"] != false || !inlineSchema(schema, 0) {
		return nil, failure(InvalidRequest)
	}
	compiler := jsonschema.NewCompiler()
	compiler.DefaultDraft(jsonschema.Draft2020)
	compiler.UseLoader(noResources{})
	compiler.AssertFormat()
	if compiler.AddResource("urn:sapienworx:ai-output", schema) != nil {
		return nil, failure(InvalidRequest)
	}
	compiled, err := compiler.Compile("urn:sapienworx:ai-output")
	if err != nil {
		return nil, failure(InvalidRequest)
	}
	return compiled, nil
}

// Only bounded inline schemas and local named definitions are accepted.
// Remote resources remain impossible; the loader always rejects them.
func inlineSchema(value any, depth int) bool {
	if depth > 16 {
		return false
	}
	switch v := value.(type) {
	case map[string]any:
		for key, nested := range v {
			if key == "$ref" {
				ref, ok := nested.(string)
				if !ok || !strings.HasPrefix(ref, "#/$defs/") || !schemaName.MatchString(strings.TrimPrefix(ref, "#/$defs/")) {
					return false
				}
				continue
			}
			if key == "$dynamicRef" || key == "$id" || key == "$schema" || key == "$vocabulary" || !inlineSchema(nested, depth+1) {
				return false
			}
		}
	case []any:
		if len(v) > 128 {
			return false
		}
		for _, nested := range v {
			if !inlineSchema(nested, depth+1) {
				return false
			}
		}
	}
	return true
}

func validateOutput(schema *jsonschema.Schema, output string) error {
	decoder := json.NewDecoder(bytes.NewBufferString(output))
	decoder.UseNumber()
	value, err := decodeValue(decoder, 0)
	if err != nil {
		return failure(SchemaValidationFailed)
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return failure(SchemaValidationFailed)
	}
	if schema.Validate(value) != nil {
		return failure(SchemaValidationFailed)
	}
	return nil
}

// Reject duplicate object keys and excessive nesting before schema validation.
// Different downstream JSON decoders must not interpret the same output differently.
func decodeValue(d *json.Decoder, depth int) (any, error) {
	if depth > 48 {
		return nil, failure(SchemaValidationFailed)
	}
	token, err := d.Token()
	if err != nil {
		return nil, err
	}
	delimiter, container := token.(json.Delim)
	if !container {
		return token, nil
	}
	switch delimiter {
	case '{':
		object := map[string]any{}
		for d.More() {
			key, err := d.Token()
			if err != nil {
				return nil, err
			}
			name, ok := key.(string)
			if !ok {
				return nil, failure(SchemaValidationFailed)
			}
			if _, exists := object[name]; exists {
				return nil, failure(SchemaValidationFailed)
			}
			value, err := decodeValue(d, depth+1)
			if err != nil {
				return nil, err
			}
			object[name] = value
		}
		end, err := d.Token()
		if err != nil || end != json.Delim('}') {
			return nil, failure(SchemaValidationFailed)
		}
		return object, nil
	case '[':
		array := []any{}
		for d.More() {
			value, err := decodeValue(d, depth+1)
			if err != nil {
				return nil, err
			}
			array = append(array, value)
		}
		end, err := d.Token()
		if err != nil || end != json.Delim(']') {
			return nil, failure(SchemaValidationFailed)
		}
		return array, nil
	}
	return nil, failure(SchemaValidationFailed)
}
