package profilecontract

import (
	"sort"
	"time"
)

func (d PartialDate) bounds() (time.Time, time.Time, bool) {
	if d.Precision == "unknown" {
		return time.Time{}, time.Time{}, d.Year == nil && d.Month == nil && d.Day == nil
	}
	if d.Year == nil || *d.Year < 1900 || *d.Year > 2100 {
		return time.Time{}, time.Time{}, false
	}
	y, m, day := *d.Year, 1, 1
	switch d.Precision {
	case "year":
		if d.Month != nil || d.Day != nil {
			return time.Time{}, time.Time{}, false
		}
	case "month", "day":
		if d.Month == nil || *d.Month < 1 || *d.Month > 12 {
			return time.Time{}, time.Time{}, false
		}
		m = *d.Month
		if d.Precision == "month" && d.Day != nil {
			return time.Time{}, time.Time{}, false
		}
		if d.Precision == "day" {
			if d.Day == nil || *d.Day < 1 || *d.Day > 31 {
				return time.Time{}, time.Time{}, false
			}
			day = *d.Day
		}
	default:
		return time.Time{}, time.Time{}, false
	}
	min := time.Date(y, time.Month(m), day, 0, 0, 0, 0, time.UTC)
	if min.Year() != y || int(min.Month()) != m || min.Day() != day {
		return time.Time{}, time.Time{}, false
	}
	max := min
	if d.Precision == "year" {
		max = min.AddDate(1, 0, 0).AddDate(0, 0, -1)
	}
	if d.Precision == "month" {
		max = min.AddDate(0, 1, 0).AddDate(0, 0, -1)
	}
	return min, max, true
}

type ExperienceCalculation struct {
	Months *int    `json:"months"`
	Basis  string  `json:"basis"`
	Issues []Issue `json:"issues"`
}

// CalculateExperience counts the union of elapsed calendar-month intervals.
// End month is exclusive, matching the existing profile editor's convention.
// Year-only, absent and invalid dates make the complete total unknown; they are
// never treated as January. Day precision is retained but totals are month-based.
func CalculateExperience(items []Employment, asOf time.Time) ExperienceCalculation {
	result := ExperienceCalculation{Basis: "calendar_month_union", Issues: []Issue{}}
	if len(items) > 30 {
		result.Issues = append(result.Issues, Issue{"error", "COLLECTION_LIMIT", "/employment"})
		return result
	}
	if len(items) == 0 {
		return result
	}
	type interval struct{ start, end int }
	ranges := make([]interval, 0, len(items))
	for i, item := range items {
		path := indexPath("/employment", i)
		if item.StartDate == nil {
			result.Issues = append(result.Issues, Issue{"info", "EXPERIENCE_UNCERTAIN", path})
			return result
		}
		start, _, valid := item.StartDate.bounds()
		if !valid || item.StartDate.Precision == "unknown" || item.StartDate.Precision == "year" || start.After(asOf) {
			result.Issues = append(result.Issues, Issue{"info", "EXPERIENCE_UNCERTAIN", path})
			return result
		}
		end := asOf
		if item.IsCurrent == nil || !*item.IsCurrent {
			if item.EndDate == nil {
				result.Issues = append(result.Issues, Issue{"info", "EXPERIENCE_UNCERTAIN", path})
				return result
			}
			var ok bool
			end, _, ok = item.EndDate.bounds()
			if !ok || item.EndDate.Precision == "unknown" || item.EndDate.Precision == "year" || end.After(asOf) {
				result.Issues = append(result.Issues, Issue{"info", "EXPERIENCE_UNCERTAIN", path})
				return result
			}
		} else if item.EndDate != nil {
			result.Issues = append(result.Issues, Issue{"error", "CURRENT_ROLE_HAS_END", path})
			return result
		}
		if end.Before(start) {
			result.Issues = append(result.Issues, Issue{"error", "END_BEFORE_START", path})
			return result
		}
		ranges = append(ranges, interval{start.Year()*12 + int(start.Month()) - 1, end.Year()*12 + int(end.Month()) - 1})
	}
	sort.Slice(ranges, func(i, j int) bool { return ranges[i].start < ranges[j].start })
	start, end, total := ranges[0].start, ranges[0].end, 0
	for _, r := range ranges[1:] {
		if r.start < end {
			result.Issues = append(result.Issues, Issue{"warning", "OVERLAPPING_EMPLOYMENT", "/employment"})
		}
		if r.start <= end {
			if r.end > end {
				end = r.end
			}
			continue
		}
		total += end - start
		start, end = r.start, r.end
	}
	total += end - start
	result.Months = &total
	return result
}

// CurrentEmployment never treats resume ordering or a missing end date as proof.
func CurrentEmployment(items []Employment, asOf time.Time) (*Employment, []Issue) {
	var found *Employment
	for _, item := range items {
		if item.IsCurrent == nil || !*item.IsCurrent {
			continue
		}
		if item.EndDate != nil {
			return nil, []Issue{{"error", "CURRENT_ROLE_HAS_END", "/employment"}}
		}
		if item.StartDate != nil {
			date, _, ok := item.StartDate.bounds()
			if !ok || !date.IsZero() && date.After(asOf) {
				continue
			}
		}
		if found != nil {
			return nil, []Issue{{"warning", "MULTIPLE_CURRENT_ROLES", "/employment"}}
		}
		copy := item
		found = &copy
	}
	return found, nil
}
