package candidate

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/jackc/pgx/v5"
)

var ErrInvalidCVReview = errors.New("invalid reviewed CV profile update")

// CVProfilePreview separates representable updates from suggestions requiring
// the existing editors. No contact verification, compensation or privacy field
// can be changed by this adapter. Values are private owner responses only.
type CVProfilePreview struct {
	Core           ProfileUpdate  `json:"core"`
	Details        map[string]any `json:"details"`
	AppliedPaths   []string       `json:"applied_paths"`
	ManualPaths    []string       `json:"manual_paths"`
	AlreadyApplied bool           `json:"already_applied"`
	Saved          bool           `json:"saved"`
}

// ProjectReviewedCV is pure. Collections append new reviewed records; matching
// records are retained rather than overwritten. Insufficient date precision is
// left for manual entry, never converted to an invented month.
func ProjectReviewedCV(core ProfileUpdate, previous map[string]any, changes []contract.ReviewedChange, now time.Time) (CVProfilePreview, error) {
	raw, err := json.Marshal(previous)
	if err != nil {
		return CVProfilePreview{}, ErrInvalidCVReview
	}
	details := map[string]any{}
	if json.Unmarshal(raw, &details) != nil {
		return CVProfilePreview{}, ErrInvalidCVReview
	}
	out := CVProfilePreview{Core: core, Details: details, AppliedPaths: []string{}, ManualPaths: []string{}}
	values := map[string]json.RawMessage{}
	handled := map[string]bool{}
	for _, c := range changes {
		if c.Status != contract.ReviewConfirmed && c.Status != contract.Edited {
			return out, ErrInvalidCVReview
		}
		if bytes.Equal(bytes.TrimSpace(c.Value), []byte("null")) {
			out.ManualPaths = append(out.ManualPaths, c.Path)
			continue // unknown is not an instruction to clear an existing field
		}
		values[c.Path] = c.Value
	}
	text := func(path string) string {
		var s string
		_ = json.Unmarshal(values[path], &s)
		return strings.TrimSpace(s)
	}
	coreText := map[string]*string{"/identity/display_name": &out.Core.FullName, "/professional/headline": &out.Core.Headline, "/location/current/city": &out.Core.CurrentCity, "/location/current/state": &out.Core.CurrentState, "/location/current/country_code": &out.Core.CountryCode}
	for path, target := range coreText {
		if raw, ok := values[path]; ok {
			if json.Unmarshal(raw, target) != nil {
				return out, ErrInvalidCVReview
			}
			handled[path] = true
		}
	}
	if v, ok := values["/professional/total_experience_months"]; ok {
		if json.Unmarshal(v, &out.Core.TotalExperienceMonths) != nil {
			return out, ErrInvalidCVReview
		}
		handled["/professional/total_experience_months"] = true
	}
	if v, ok := values["/availability/notice_period_days"]; ok {
		var n int
		if json.Unmarshal(v, &n) != nil {
			return out, ErrInvalidCVReview
		}
		out.Core.NoticePeriodDays = &n
		handled["/availability/notice_period_days"] = true
	}
	for path, key := range map[string]string{"/professional/summary": "professional_summary", "/professional/current_designation/name": "current_designation"} {
		if _, ok := values[path]; ok {
			details[key] = text(path)
			handled[path] = true
		}
	}
	// The authoritative name is preferred over its raw extraction alias.
	if handled["/professional/current_designation/name"] {
		handled["/professional/current_designation/raw_value"] = true
	}
	groups := map[string][]string{}
	for path := range values {
		parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
		if len(parts) > 2 {
			if _, err := strconv.Atoi(parts[1]); err == nil {
				key := "/" + parts[0] + "/" + parts[1]
				groups[key] = append(groups[key], path)
			}
		}
	}
	keys := make([]string, 0, len(groups))
	for k := range groups {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, prefix := range keys {
		paths := groups[prefix]
		section := strings.Split(prefix, "/")[1]
		local := map[string]bool{}
		read := func(suffix string) string {
			p := prefix + "/" + suffix
			if _, ok := values[p]; ok {
				local[p] = true
			}
			return text(p)
		}
		entity := func(suffix string) string {
			name := read(suffix + "/name")
			raw := read(suffix + "/raw_value")
			if name != "" {
				return name
			}
			return raw
		}
		integer := func(suffix string) int {
			p := prefix + "/" + suffix
			var n int
			if v, ok := values[p]; ok && json.Unmarshal(v, &n) == nil {
				local[p] = true
			}
			return n
		}
		row := map[string]any{}
		key := ""
		valid := true
		switch section {
		case "skills":
			name := entity("entity")
			if name == "" {
				continue
			}
			existing := []string{}
			switch v := details["key_skills"].(type) {
			case string:
				existing = strings.Split(v, ",")
			case []any:
				for _, x := range v {
					if s, ok := x.(string); ok {
						existing = append(existing, s)
					}
				}
			}
			found := false
			for _, s := range existing {
				if contract.ComparisonKey(s) == contract.ComparisonKey(name) {
					found = true
				}
			}
			if !found {
				existing = append(existing, name)
			}
			items := make([]any, 0, len(existing))
			for _, s := range existing {
				if strings.TrimSpace(s) != "" {
					items = append(items, strings.TrimSpace(s))
				}
			}
			details["key_skills"] = items
		case "employment":
			key = "employment"
			row["company"] = entity("company")
			row["job_title"] = entity("designation")
			row["job_profile"] = read("description")
			year, month := integer("start_date/year"), integer("start_date/month")
			current := false
			v, ok := values[prefix+"/is_current"]
			if ok && json.Unmarshal(v, &current) == nil {
				local[prefix+"/is_current"] = true
			} else {
				valid = false
			}
			valid = valid && year >= 1900 && month >= 1 && month <= 12
			row["joining_year"] = strconv.Itoa(year)
			if month >= 1 && month <= 12 {
				row["joining_month"] = time.Month(month).String()
			}
			row["current_company"] = "No"
			if current {
				row["current_company"] = "Yes"
			} else {
				ey, em := integer("end_date/year"), integer("end_date/month")
				valid = valid && ey >= 1900 && em >= 1 && em <= 12
				row["end_year"] = strconv.Itoa(ey)
				if em >= 1 && em <= 12 {
					row["end_month"] = time.Month(em).String()
				}
			}
			valid = valid && row["company"] != "" && row["job_title"] != ""
		case "education":
			key = "education"
			row["level"] = entity("qualification")
			row["university"] = entity("institution")
			row["education"] = read("degree")
			row["specialization"] = read("specialization")
			for _, item := range []struct{ suffix, key string }{{"start_date/year", "start_year"}, {"end_date/year", "end_year"}, {"graduation_year", "end_year"}} {
				if n := integer(item.suffix); n > 0 {
					row[item.key] = strconv.Itoa(n)
				}
			}
			valid = row["level"] != "" && row["university"] != ""
		case "certifications":
			key = "certifications"
			row["title"] = entity("entity")
			row["issuer"] = read("issuing_organization")
			row["url"] = read("credential_url")
			valid = row["title"] != ""
		case "projects":
			key = "projects"
			row["title"] = read("name")
			row["role"] = read("role")
			row["description"] = read("description")
			row["url"] = read("url")
			valid = row["title"] != ""
		case "languages":
			key = "languages"
			row["language"] = entity("entity")
			row["proficiency"] = read("proficiency")
			for _, k := range []string{"read", "write", "speak"} {
				p := prefix + "/" + k
				var b bool
				if v, ok := values[p]; ok && json.Unmarshal(v, &b) == nil {
					row[k] = b
					local[p] = true
				}
			}
			valid = row["language"] != ""
		case "links":
			key = "professional_links"
			row["url"] = read("url")
			row["label"] = read("label")
			valid = row["url"] != ""
		default:
			continue
		}
		if !valid {
			continue
		}
		if key != "" {
			existing, ok := details[key].([]any)
			if details[key] != nil && !ok {
				continue
			} // preserve unstructured legacy data
			same := false
			for _, x := range existing {
				r, ok := x.(map[string]any)
				if !ok {
					continue
				}
				switch key {
				case "employment":
					same = contract.ComparisonKey(recordString(r, "company")) == contract.ComparisonKey(recordString(row, "company")) && contract.ComparisonKey(recordString(r, "job_title")) == contract.ComparisonKey(recordString(row, "job_title")) && recordString(r, "joining_year") == recordString(row, "joining_year")
				case "education":
					same = contract.ComparisonKey(recordString(r, "university")) == contract.ComparisonKey(recordString(row, "university")) && contract.ComparisonKey(recordString(r, "level")) == contract.ComparisonKey(recordString(row, "level"))
				case "languages":
					same = strings.EqualFold(recordString(r, "language"), recordString(row, "language"))
				case "professional_links":
					same = recordString(r, "url") == recordString(row, "url")
				default:
					same = strings.EqualFold(recordString(r, "title"), recordString(row, "title"))
				}
				if same {
					break
				}
			}
			if same {
				continue
			} // duplicate stays manual: no silent replacement
			next := append(append([]any{}, existing...), row)
			old := details[key]
			details[key] = next
			check := ProfileDetailsUpdate{Details: details}
			if ValidateProfileDetails(&check, previous, now) != nil {
				details[key] = old
				continue
			}
		}
		for _, p := range paths {
			if local[p] {
				handled[p] = true
			}
		}
	}
	if err := ValidateProfile(&out.Core); err != nil {
		return out, err
	}
	check := ProfileDetailsUpdate{Details: details}
	if err := ValidateProfileDetails(&check, previous, now); err != nil {
		return out, err
	}
	if derived := EmploymentExperience(details, now); derived != nil {
		out.Core.TotalExperienceMonths = *derived
		delete(handled, "/professional/total_experience_months")
	}
	for path := range values {
		if handled[path] {
			out.AppliedPaths = append(out.AppliedPaths, path)
		} else {
			out.ManualPaths = append(out.ManualPaths, path)
		}
	}
	sort.Strings(out.AppliedPaths)
	sort.Strings(out.ManualPaths)
	return out, nil
}

// ReviewedCVInTransaction locks and validates the candidate's existing profile.
// The parsing store owns the transaction and atomically records the private
// applied marker and audit event alongside this ordinary profile update.
func ReviewedCVInTransaction(ctx context.Context, tx pgx.Tx, userID string, plan contract.ConfirmationPlan, expected time.Time, confirm bool) (CVProfilePreview, error) {
	if plan.CandidateID != userID || plan.ExpectedProfileUpdatedAt == nil {
		return CVProfilePreview{}, ErrInvalidCVReview
	}
	var core ProfileUpdate
	var raw []byte
	var stamp time.Time
	err := tx.QueryRow(ctx, `SELECT full_name,COALESCE(headline,''),COALESCE(current_city,''),COALESCE(current_state,''),country_code,total_experience_months,notice_period_days,profile_details,updated_at FROM candidate_profiles WHERE user_id=$1 FOR UPDATE`, userID).Scan(&core.FullName, &core.Headline, &core.CurrentCity, &core.CurrentState, &core.CountryCode, &core.TotalExperienceMonths, &core.NoticePeriodDays, &raw, &stamp)
	if err != nil {
		return CVProfilePreview{}, err
	}
	if !expected.Equal(stamp) || !plan.ExpectedProfileUpdatedAt.Equal(stamp) {
		return CVProfilePreview{}, ErrProfileConflict
	}
	previous := map[string]any{}
	if json.Unmarshal(raw, &previous) != nil {
		return CVProfilePreview{}, ErrInvalidCVReview
	}
	out, err := ProjectReviewedCV(core, previous, plan.Changes, time.Now().UTC())
	if err != nil {
		return out, err
	}
	for _, c := range plan.ContactSuggestions {
		out.ManualPaths = append(out.ManualPaths, c.Path)
	}
	if !confirm {
		return out, nil
	}
	if len(out.AppliedPaths) == 0 {
		return out, ErrInvalidCVReview
	}
	if reflect.DeepEqual(previous, out.Details) {
		out.Details = previous
	}
	raw, err = json.Marshal(out.Details)
	if err != nil {
		return out, err
	}
	_, err = tx.Exec(ctx, `UPDATE candidate_profiles SET full_name=$2,headline=NULLIF($3,''),current_city=NULLIF($4,''),current_state=NULLIF($5,''),country_code=$6,total_experience_months=$7,notice_period_days=$8,profile_details=$9,updated_at=now() WHERE user_id=$1`, userID, out.Core.FullName, out.Core.Headline, out.Core.CurrentCity, out.Core.CurrentState, out.Core.CountryCode, out.Core.TotalExperienceMonths, out.Core.NoticePeriodDays, raw)
	if err != nil {
		return out, err
	}
	out.Saved = true
	if _, err = tx.Exec(ctx, `INSERT INTO privacy_audit_events(actor_user_id,subject_user_id,event_type,resource_type,outcome) VALUES($1,$1,'candidate.cv.review_applied','candidate_profile','success')`, userID); err != nil {
		return out, fmt.Errorf("record reviewed profile audit: %w", err)
	}
	return out, nil
}
