package profilecontract

import (
	"encoding/json"
	"reflect"
	"strings"
	"time"

	"golang.org/x/text/unicode/norm"
)

func ComparisonKey(value string) string {
	return strings.ToLower(strings.Join(strings.Fields(norm.NFC.String(value)), " "))
}

func cloneData(input ProfileData) ProfileData {
	raw, _ := json.Marshal(input)
	var copy ProfileData
	_ = json.Unmarshal(raw, &copy)
	return copy
}

// NormalizeData is explicit and copy-on-write. Raw values remain byte-for-byte
// unchanged. No country, salary, employment status, dates or proficiency is guessed.
func NormalizeData(input ProfileData) ProfileData {
	result := cloneData(input)
	var visit func(reflect.Value)
	visit = func(value reflect.Value) {
		if value.Kind() == reflect.Pointer {
			if value.IsNil() {
				return
			}
			value = value.Elem()
		}
		switch value.Kind() {
		case reflect.Struct:
			t := value.Type()
			for i := 0; i < value.NumField(); i++ {
				if t.Field(i).Tag.Get("raw") == "true" {
					continue
				}
				visit(value.Field(i))
				field := value.Field(i)
				if (t.Field(i).Name == "CountryCode" || t.Field(i).Name == "Currency") && field.Kind() == reflect.Pointer && !field.IsNil() && field.Elem().Kind() == reflect.String {
					field.Elem().SetString(strings.ToUpper(field.Elem().String()))
				}
			}
		case reflect.Slice:
			for i := 0; i < value.Len(); i++ {
				visit(value.Index(i))
			}
		case reflect.String:
			if value.CanSet() {
				value.SetString(norm.NFC.String(strings.TrimSpace(value.String())))
			}
		}
	}
	visit(reflect.ValueOf(&result))
	for _, phone := range []**string{&result.Contact.PrimaryPhone, &result.Contact.AlternatePhone} {
		if *phone != nil {
			clean := strings.NewReplacer(" ", "", "(", "", ")", "", "-", "", ".", "").Replace(**phone)
			*phone = &clean
		}
	}
	for _, email := range []**string{&result.Contact.PrimaryEmail, &result.Contact.AlternateEmail} {
		if *email != nil {
			parts := strings.Split(**email, "@")
			if len(parts) == 2 {
				clean := parts[0] + "@" + strings.ToLower(parts[1])
				*email = &clean
			}
		}
	}
	if result.Contact.CountryCode != nil {
		x := strings.ToUpper(*result.Contact.CountryCode)
		result.Contact.CountryCode = &x
	}
	for _, money := range []*Money{result.Compensation.Current, result.Compensation.Expected} {
		if money != nil && money.Currency != nil {
			x := strings.ToUpper(*money.Currency)
			money.Currency = &x
		}
	}
	return result
}

// NormalizeSkills accepts only an explicit exact alias map supplied by an
// approved taxonomy. It does not build a taxonomy, fuzzy-match or drop duplicates.
func NormalizeSkills(input []Skill, aliases map[string]EntityRef) []Skill {
	profile := NormalizeData(ProfileData{Skills: input})
	out := profile.Skills
	for i := range out {
		if out[i].Entity.Name == nil {
			continue
		}
		original := *out[i].Entity.Name
		if mapped, ok := aliases[ComparisonKey(original)]; ok {
			raw := original
			if input[i].Entity.RawValue != nil {
				raw = *input[i].Entity.RawValue
			}
			out[i].Entity = cloneData(ProfileData{Skills: []Skill{{Entity: mapped}}}).Skills[0].Entity
			out[i].Entity.RawValue = &raw
		}
	}
	return out
}

// ParsePartialDate accepts explicit ISO precision and the legacy preview's
// English month/year format only. It never fills in January for year-only dates.
func ParsePartialDate(raw string) *PartialDate {
	value := strings.TrimSpace(raw)
	for _, item := range []struct{ layout, precision string }{{"2006-01-02", "day"}, {"2006-01", "month"}, {"2006", "year"}, {"Jan 2006", "month"}, {"January 2006", "month"}} {
		date, e := time.Parse(item.layout, value)
		if e != nil {
			continue
		}
		year := date.Year()
		d := &PartialDate{Precision: item.precision, Year: &year, RawValue: &raw}
		if item.precision != "year" {
			month := int(date.Month())
			d.Month = &month
		}
		if item.precision == "day" {
			day := date.Day()
			d.Day = &day
		}
		return d
	}
	return &PartialDate{Precision: "unknown", RawValue: &raw}
}

// ProposedMetadata is for trusted adapters. It supplies no numeric confidence,
// no candidate confirmation and no raw CV evidence snippets.
func ProposedMetadata(profile ProfileData, source string) map[string]FieldMetadata {
	values := FieldValues(profile)
	out := make(map[string]FieldMetadata, len(values))
	for path, value := range values {
		parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
		out[path] = FieldMetadata{Provenance: Provenance{Source: source, Kind: "explicit", Section: parts[0], Reference: "profile" + path}, Review: Unreviewed, RawValue: append(json.RawMessage(nil), value...)}
	}
	return out
}
