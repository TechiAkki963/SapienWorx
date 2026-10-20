package parsing

import (
	"reflect"
	"regexp"
	"strings"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

// This task version invalidates only old CV proposals; prompt, wire schema and
// CandidateProfile versions are unchanged. A cached raw omission is not a fix.
const CVTaskVersion = "v1.1"

var currentEmployeeLine = regexp.MustCompile(`(?i)^employer:[ \t]*([^;\r\n]{1,300});[ \t]*title:[ \t]*[^;\r\n]{1,500};[ \t]*from[ \t]+([0-9]{4}-[0-9]{2}(?:-[0-9]{2})?)[ \t]+to[ \t]+present;[ \t]*full-time(?:[.;]|$)`)
var competingStatus = regexp.MustCompile(`(?i)\b(?:unemployed|self[ _-]employed|freelanc[a-z]*|student|fresher|career[ _-]break|retired|not[ \t]+(?:currently[ \t]+)?(?:employed|working)|no[ \t]+longer[ \t]+(?:employed|working)|between[ \t]+jobs|without[ \t]+(?:a[ \t]+)?job|no[ \t]+current[ \t]+employment|no[ \t]+employment[ \t]+experience|employment[ _-]status)\b`)

// sourceBackedEmployeeStatus is deliberately a limited source-supported
// projection, not status inference from gaps, an employer name or notice days.
// Only an unambiguous current employee record corroborated by a matching source
// employer/date/full-time line may fill a missing status. Other formats stay
// unknown for review. Explicit provider statuses are never overwritten here.
func sourceBackedEmployeeStatus(text string, current *contract.Employment, asOf time.Time) bool {
	if current == nil || current.Company.Name == nil || strings.TrimSpace(*current.Company.Name) == "" || current.EmploymentType == nil || *current.EmploymentType != "full_time" || current.StartDate == nil || current.EndDate != nil || current.IsCurrent == nil || !*current.IsCurrent {
		return false
	}
	if current.Engagement != nil && *current.Engagement != "employee" || competingStatus.MatchString(text) {
		return false
	}
	if contract.CalculateExperience([]contract.Employment{*current}, asOf).Months == nil {
		return false
	}
	matches := 0
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if instructionLike(line) {
			continue
		}
		m := currentEmployeeLine.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		// More than one current source line is ambiguous even if the provider
		// discarded a second role. Never let provider omission resolve it.
		matches++
		if matches > 1 || contract.ComparisonKey(m[1]) != contract.ComparisonKey(*current.Company.Name) {
			return false
		}
		sourceDate := contract.ParsePartialDate(m[2])
		actualDate := *current.StartDate
		sourceDate.RawValue, actualDate.RawValue = nil, nil
		if !reflect.DeepEqual(*sourceDate, actualDate) {
			return false
		}
	}
	return matches == 1
}
