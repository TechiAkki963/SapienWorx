package profilecontract_test

import (
	"testing"

	c "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
)

func employment(start, end string, current bool) c.Employment {
	e := c.Employment{Company: ref("Example"), Designation: ref("Consultant"), StartDate: c.ParsePartialDate(start), IsCurrent: ptr(current)}
	if end != "" {
		e.EndDate = c.ParsePartialDate(end)
	}
	return e
}

func TestCalendarExperienceUnionAndPrecision(t *testing.T) {
	for _, tc := range []struct {
		name   string
		items  []c.Employment
		months *int
	}{
		{"contiguous", []c.Employment{employment("2023-01", "2024-01", false), employment("2024-01", "2025-01", false)}, ptr(24)},
		{"concurrent consultancy", []c.Employment{employment("2023-01", "2025-01", false), employment("2024-01", "2025-06", false)}, ptr(29)},
		{"career gap", []c.Employment{employment("2020-01", "2021-01", false), employment("2024-01", "2025-01", false)}, ptr(24)},
		{"current", []c.Employment{employment("2025-01", "", true)}, ptr(21)},
		{"day precision", []c.Employment{employment("2024-01-15", "2024-03-15", false)}, ptr(2)},
		{"year unknown", []c.Employment{employment("2021", "2023", false)}, nil},
		{"unknown not dropped", []c.Employment{employment("2021-01", "2022-01", false), employment("2023", "2024", false)}, nil},
		{"missing end", []c.Employment{employment("2021-01", "", false)}, nil},
		{"future", []c.Employment{employment("2028-01", "", true)}, nil},
		{"reversed", []c.Employment{employment("2025-01", "2024-01", false)}, nil},
		{"empty", nil, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := c.CalculateExperience(tc.items, asOf)
			if tc.months == nil {
				if got.Months != nil {
					t.Fatal("invented precise total")
				}
			} else if got.Months == nil || *got.Months != *tc.months {
				t.Fatal("incorrect interval union")
			}
		})
	}
}

func TestPartialDatesValidateLeapYearsAndKeepRawPrecision(t *testing.T) {
	v := validator(t)
	for _, tc := range []struct {
		raw, precision string
		valid          bool
	}{{"2024-02-29", "day", true}, {"2023-02-29", "unknown", true}, {"2021", "year", true}, {"Jan 2021", "month", true}, {"January 2021", "month", true}, {"not stated", "unknown", true}} {
		t.Run(tc.raw, func(t *testing.T) {
			d := c.ParsePartialDate(tc.raw)
			if d.Precision != tc.precision || d.RawValue == nil || *d.RawValue != tc.raw {
				t.Fatal("date precision/raw lost")
			}
			if d.Precision == "year" && (d.Month != nil || d.Day != nil) {
				t.Fatal("invented January")
			}
		})
	}
	for _, d := range []c.PartialDate{{Precision: "day", Year: ptr(2023), Month: ptr(2), Day: ptr(29)}, {Precision: "month", Year: ptr(2024), Month: ptr(13)}, {Precision: "year", Year: ptr(2024), Month: ptr(1)}} {
		p := c.ProfileData{Employment: []c.Employment{{StartDate: &d}}}
		if !hasCode(v.ValidateData(p, asOf), "INVALID_DATE") {
			t.Fatal("invalid typed date accepted")
		}
	}
}

func TestCurrentEmployerNeverUsesResumeOrdering(t *testing.T) {
	jobs := []c.Employment{employment("2018-01", "2020-01", false), employment("2024-01", "", true)}
	jobs[0].Company = ref("Former")
	jobs[1].Company = ref("Current")
	got, issues := c.CurrentEmployment(jobs, asOf)
	if got == nil || *got.Company.Name != "Current" || len(issues) != 0 {
		t.Fatal("first record assumed current")
	}
	jobs = append(jobs, employment("2024-06", "", true))
	if got, issues := c.CurrentEmployment(jobs, asOf); got != nil || len(issues) != 1 {
		t.Fatal("ambiguous current employer guessed")
	}
	jobs = []c.Employment{employment("2024-01", "", false)}
	if got, _ := c.CurrentEmployment(jobs, asOf); got != nil {
		t.Fatal("missing end assumed current")
	}
}

func TestLifecycleAndConfigurableConfidencePresentation(t *testing.T) {
	path := []c.ParseStatus{c.Uploaded, c.Validating, c.Extracting, c.Parsing, c.ValidatingResult, c.ReadyForReview, c.Confirmed}
	for i := 0; i < len(path)-1; i++ {
		if !c.CanTransition(path[i], path[i+1]) {
			t.Fatal("valid lifecycle edge missing")
		}
	}
	for _, edge := range [][2]c.ParseStatus{{c.Uploaded, c.Confirmed}, {c.Parsing, c.Confirmed}, {c.Confirmed, c.Parsing}, {c.ParsingFailed, c.Parsing}, {c.ReadyForReview, c.Uploaded}} {
		if c.CanTransition(edge[0], edge[1]) {
			t.Fatal("unsafe lifecycle jump")
		}
	}
	for _, tc := range []struct {
		confidence *float64
		want       string
	}{{nil, "unknown"}, {ptr(0.95), "high"}, {ptr(0.75), "medium"}, {ptr(0.5), "low"}} {
		got, e := c.ConfidenceBand(tc.confidence, .9, .7)
		if e != nil || got != tc.want {
			t.Fatal("wrong presentation bucket")
		}
	}
	if _, e := c.ConfidenceBand(ptr(.95), .7, .9); e == nil {
		t.Fatal("invalid thresholds accepted")
	}
}
