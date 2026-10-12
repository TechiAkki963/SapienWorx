package recruiter

import (
	"errors"
	"testing"
)

func TestOfferCalculationsUseExactDecimalsAndServerFormulas(t *testing.T) {
	fields := []OfferCalculationField{{Key: "base", Kind: "money", Required: true}, {Key: "bonus", Kind: "money", Formula: "percent(base, 10)"}, {Key: "total", Kind: "money", Formula: "sum(base, bonus, 0.1 + 0.2)"}, {Key: "rounded", Kind: "money", Formula: "round(2.675, 2)"}}
	result, err := CalculateOfferFields("INR", fields, map[string]string{"base": "1000.00", "bonus": "999999"})
	if err != nil {
		t.Fatal(err)
	}
	if result["bonus"] != "100.00" || result["total"] != "1100.30" || result["rounded"] != "2.68" {
		t.Fatalf("compensation calculation lost decimal precision: %+v", result)
	}
	result, err = CalculateOfferFields("KWD", []OfferCalculationField{{Key: "base", Kind: "money"}}, map[string]string{"base": "1.2345"})
	if err != nil || result["base"] != "1.235" {
		t.Fatal("three-decimal currency precision failed")
	}
	result, err = CalculateOfferFields("JPY", []OfferCalculationField{{Key: "base", Kind: "money"}}, map[string]string{"base": "100.50"})
	if err != nil || result["base"] != "101" {
		t.Fatal("zero-decimal currency precision failed")
	}
}
func TestOfferCalculationsRejectUnsafeAndInvalidRules(t *testing.T) {
	for _, formula := range []string{"1 / 0", "unknown + 1", "base", `eval("secret")`, "math.Pow(2,3)", "1 << 20", "-1", "round(1,9)", "percent(1)", "1e99"} {
		_, err := CalculateOfferFields("INR", []OfferCalculationField{{Key: "base", Kind: "money", Formula: formula}}, nil)
		if !errors.Is(err, ErrOfferCalculation) {
			t.Errorf("formula %q was accepted: %v", formula, err)
		}
	}
	_, err := CalculateOfferFields("INR", []OfferCalculationField{{Key: "a", Kind: "money", Formula: "b"}, {Key: "b", Kind: "money", Formula: "a"}}, nil)
	if !errors.Is(err, ErrOfferCalculation) {
		t.Fatal("cycle accepted")
	}
	_, err = CalculateOfferFields("INR", []OfferCalculationField{{Key: "a", Kind: "money", Currency: "USD", Default: "10"}}, nil)
	if !errors.Is(err, ErrOfferCalculation) {
		t.Fatal("cross-currency formula accepted")
	}
	result, err := CalculateOfferFields("INR", []OfferCalculationField{{Key: "base", Kind: "money", Locked: true, Default: "100"}}, map[string]string{"base": "9999"})
	if err != nil || result["base"] != "100.00" {
		t.Fatal("locked compensation field was overridden")
	}
}

func TestOfferDefinitionsValidateGraphsWithoutInventedCompensation(t *testing.T) {
	fields := []OfferCalculationField{{Key: "annual_compensation", Label: "Annual compensation", Kind: "money", Required: true}, {Key: "deduction", Label: "Deduction", Kind: "money", Required: true}, {Key: "ratio", Label: "Ratio", Kind: "number", Formula: "annual_compensation / (deduction - 1)"}, {Key: "employment", Label: "Employment details", Kind: "section"}, {Key: "work_mode", Label: "Work mode", Kind: "select", Options: []string{"Remote", "Hybrid"}, Required: true}}
	if err := validateOfferCalculationDefinitions("INR", fields); err != nil {
		t.Fatal("valid input-dependent formula was rejected by invented values", err)
	}
	values, err := CalculateOfferFields("INR", fields, map[string]string{"annual_compensation": "1000", "deduction": "11", "work_mode": "Remote"})
	if err != nil || values["ratio"] != "100.000000" {
		t.Fatal(values, err)
	}
	if _, exists := values["employment"]; exists {
		t.Fatal("section became candidate data")
	}
	if _, err = CalculateOfferFields("INR", fields, map[string]string{"annual_compensation": "1000", "deduction": "1", "work_mode": "Remote"}); !errors.Is(err, ErrOfferCalculation) {
		t.Fatal("runtime zero divisor accepted", err)
	}
	if _, err = CalculateOfferFields("INR", fields, map[string]string{"annual_compensation": "1000", "deduction": "11", "work_mode": "Injected"}); !errors.Is(err, ErrOfferCalculation) {
		t.Fatal("unknown choice accepted", err)
	}
	for _, formula := range []string{"missing + 1", "math.Pow(2, 3)", "eval(1)", "annual_compensation", "percent(1)", "1/0", "round(2,9)", "-1"} {
		bad := []OfferCalculationField{{Key: "annual_compensation", Label: "Annual", Kind: "money", Formula: formula}}
		if err = validateOfferCalculationDefinitions("INR", bad); !errors.Is(err, ErrOfferCalculation) {
			t.Fatal("invalid definition accepted", formula, err)
		}
	}
}

func TestOfferDraftCalculationsRetainMissingValuesWithoutInventedMoney(t *testing.T) {
	fields := []OfferCalculationField{{Key: "annual_compensation", Label: "Annual", Kind: "money", Currency: "INR", Required: true}, {Key: "monthly", Label: "Monthly", Kind: "money", Currency: "INR", Formula: "annual_compensation / 12"}, {Key: "employee_type", Label: "Employment type", Kind: "select", Required: true, Options: []string{"Full-time", "Contract"}}}
	values, err := CalculateOfferDraftFields("INR", fields, map[string]string{})
	if err != nil || values["annual_compensation"] != "" || values["monthly"] != "" {
		t.Fatal("draft invented compensation", values, err)
	}
	if _, err = CalculateOfferFields("INR", fields, values); err == nil {
		t.Fatal("incomplete draft passed release calculation")
	}
	values, err = CalculateOfferDraftFields("INR", fields, map[string]string{"annual_compensation": "1200000.30"})
	if err != nil || values["monthly"] != "100000.03" {
		t.Fatal(values, err)
	}
	for _, bad := range []map[string]string{{"annual_compensation": "bad"}, {"unknown": "123"}, {"employee_type": "Invalid"}} {
		if _, err = CalculateOfferDraftFields("INR", fields, bad); err == nil {
			t.Fatal("invalid supplied draft data accepted", bad)
		}
	}
	fields[1].Formula = "percent(annual_compensation)"
	if _, err = CalculateOfferDraftFields("INR", fields, nil); err == nil {
		t.Fatal("incomplete operands hid an invalid formula")
	}
}

func TestOfferFormulaOverflowIsControlledBeforeDatabaseWrite(t *testing.T) {
	fields := []OfferCalculationField{{Key: "base", Label: "Base", Kind: "money", Currency: "INR", Required: true}, {Key: "annual_compensation", Label: "Annual", Kind: "money", Currency: "INR", Formula: "base * base"}}
	if _, err := CalculateOfferFields("INR", fields, map[string]string{"base": "99999999999999"}); !errors.Is(err, ErrOfferCalculation) {
		t.Fatal("formula overflow was not controlled", err)
	}
	values, err := CalculateOfferFields("INR", fields, map[string]string{"base": "1000"})
	if err != nil || values["annual_compensation"] != "1000000.00" {
		t.Fatal(values, err)
	}
}
