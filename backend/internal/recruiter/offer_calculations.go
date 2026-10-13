package recruiter

import (
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"math/big"
	"regexp"
	stdstrconv "strconv"
	"strings"
)

// Calculations accept decimal strings and a small expression grammar. Neither
// binary floating point nor arbitrary executable code enters compensation.
type OfferCalculationField struct {
	Key      string   `json:"key"`
	Label    string   `json:"label"`
	Kind     string   `json:"kind"`
	Options  []string `json:"options,omitempty"`
	Currency string   `json:"currency,omitempty"`
	Required bool     `json:"required"`
	Locked   bool     `json:"locked"`
	Default  string   `json:"default,omitempty"`
	Formula  string   `json:"formula,omitempty"`
}

var offerFieldKey = regexp.MustCompile(`^[a-z][a-z0-9_]{0,63}$`)
var offerDecimal = regexp.MustCompile(`^-?[0-9]{1,14}(?:\.[0-9]{1,8})?$`)
var ErrOfferCalculation = errors.New("offer calculation is invalid")
var errOfferMissingDraftValue = errors.New("draft value is incomplete")

func offerCurrencyScale(currency string) (int, error) {
	switch currency {
	case "JPY", "KRW", "CLP", "VND":
		return 0, nil
	case "KWD", "BHD", "OMR", "JOD", "TND":
		return 3, nil
	case "INR", "USD", "EUR", "GBP", "AED", "AUD", "CAD", "CHF", "CNY", "HKD", "SGD", "NZD", "ZAR", "BRL", "MXN", "THB", "IDR", "MYR", "PHP", "SAR", "QAR":
		return 2, nil
	}
	return 0, ErrOfferCalculation
}
func roundOfferDecimal(value *big.Rat, scale int) *big.Rat {
	power := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(scale)), nil)
	numerator := new(big.Int).Mul(value.Num(), power)
	negative := numerator.Sign() < 0
	numerator.Abs(numerator)
	quotient, remainder := new(big.Int), new(big.Int)
	quotient.QuoRem(numerator, value.Denom(), remainder)
	if new(big.Int).Lsh(remainder, 1).Cmp(value.Denom()) >= 0 {
		quotient.Add(quotient, big.NewInt(1))
	}
	if negative {
		quotient.Neg(quotient)
	}
	return new(big.Rat).SetFrac(quotient, power)
}
func CalculateOfferFields(currency string, fields []OfferCalculationField, inputs map[string]string) (map[string]string, error) {
	return calculateOfferFields(currency, fields, inputs, false)
}

// Drafts retain valid supplied data. Missing operands leave dependent formulas
// absent; they never become fabricated zero compensation or approval thresholds.
func CalculateOfferDraftFields(currency string, fields []OfferCalculationField, inputs map[string]string) (map[string]string, error) {
	if err := validateOfferCalculationDefinitions(currency, fields); err != nil {
		return nil, err
	}
	return calculateOfferFields(currency, fields, inputs, true)
}

func calculateOfferFields(currency string, fields []OfferCalculationField, inputs map[string]string, incomplete bool) (map[string]string, error) {
	scale, err := offerCurrencyScale(currency)
	if err != nil {
		return nil, err
	}
	if len(fields) > 100 || len(inputs) > 100 {
		return nil, ErrOfferCalculation
	}
	definitions := map[string]OfferCalculationField{}
	values := map[string]*big.Rat{}
	visiting := map[string]bool{}
	output := map[string]string{}
	for _, field := range fields {
		if !offerFieldKey.MatchString(field.Key) || len(field.Label) > 120 || len(field.Formula) > 1024 || len(field.Default) > 4000 || !validEnum(field.Kind, "money", "number", "percent", "text", "date", "boolean", "select", "section") {
			return nil, ErrOfferCalculation
		}
		if _, exists := definitions[field.Key]; exists {
			return nil, ErrOfferCalculation
		}
		if field.Currency != "" && field.Currency != currency {
			return nil, fmt.Errorf("%w: %s has a different currency", ErrOfferCalculation, field.Key)
		}
		if field.Formula != "" && !validEnum(field.Kind, "money", "number", "percent") {
			return nil, ErrOfferCalculation
		}
		definitions[field.Key] = field
	}
	for key := range inputs {
		if _, exists := definitions[key]; !exists {
			return nil, fmt.Errorf("%w: unknown field %s", ErrOfferCalculation, key)
		}
	}
	var resolve func(string) (*big.Rat, error)
	var evaluate func(ast.Expr, int) (*big.Rat, error)
	safe := func(value *big.Rat) (*big.Rat, error) {
		if value.Num().BitLen() > 256 || value.Denom().BitLen() > 256 {
			return nil, ErrOfferCalculation
		}
		return value, nil
	}
	resolve = func(key string) (*big.Rat, error) {
		if value, ok := values[key]; ok {
			return new(big.Rat).Set(value), nil
		}
		field, ok := definitions[key]
		if !ok || !validEnum(field.Kind, "money", "number", "percent") {
			return nil, fmt.Errorf("%w: missing numeric field %s", ErrOfferCalculation, key)
		}
		if visiting[key] {
			return nil, fmt.Errorf("%w: circular reference at %s", ErrOfferCalculation, key)
		}
		visiting[key] = true
		defer delete(visiting, key)
		raw := field.Default
		if !field.Locked {
			if value, exists := inputs[key]; exists {
				raw = value
			}
		}
		var value *big.Rat
		var err error
		if field.Formula != "" {
			expr, e := parser.ParseExpr(field.Formula)
			if e != nil {
				return nil, fmt.Errorf("%w: %s", ErrOfferCalculation, key)
			}
			value, err = evaluate(expr, 0)
		} else {
			if incomplete && raw == "" {
				return nil, errOfferMissingDraftValue
			}
			if !offerDecimal.MatchString(raw) {
				return nil, fmt.Errorf("%w: enter a decimal value for %s", ErrOfferCalculation, key)
			}
			value, _ = new(big.Rat).SetString(raw)
		}
		if err != nil {
			return nil, err
		}
		if value == nil || value.Sign() < 0 {
			return nil, fmt.Errorf("%w: %s cannot be negative", ErrOfferCalculation, key)
		}
		if _, err = safe(value); err != nil {
			return nil, err
		}
		precision := 6
		if field.Kind == "money" {
			precision = scale
		}
		value = roundOfferDecimal(value, precision)
		formatted := value.FloatString(precision)
		if !offerDecimal.MatchString(formatted) {
			return nil, fmt.Errorf("%w: computed value for %s exceeds supported precision", ErrOfferCalculation, key)
		}
		values[key] = new(big.Rat).Set(value)
		output[key] = formatted
		return new(big.Rat).Set(value), nil
	}
	evaluate = func(expr ast.Expr, depth int) (*big.Rat, error) {
		if depth > 32 {
			return nil, ErrOfferCalculation
		}
		switch node := expr.(type) {
		case *ast.BasicLit:
			if node.Kind != token.INT && node.Kind != token.FLOAT || !offerDecimal.MatchString(node.Value) {
				return nil, ErrOfferCalculation
			}
			value, ok := new(big.Rat).SetString(node.Value)
			if !ok {
				return nil, ErrOfferCalculation
			}
			return safe(value)
		case *ast.Ident:
			return resolve(node.Name)
		case *ast.ParenExpr:
			return evaluate(node.X, depth+1)
		case *ast.UnaryExpr:
			value, err := evaluate(node.X, depth+1)
			if err != nil {
				return nil, err
			}
			switch node.Op {
			case token.ADD:
				return value, nil
			case token.SUB:
				return new(big.Rat).Neg(value), nil
			}
			return nil, ErrOfferCalculation
		case *ast.BinaryExpr:
			left, err := evaluate(node.X, depth+1)
			if err != nil {
				return nil, err
			}
			right, err := evaluate(node.Y, depth+1)
			if err != nil {
				return nil, err
			}
			result := new(big.Rat)
			switch node.Op {
			case token.ADD:
				result.Add(left, right)
			case token.SUB:
				result.Sub(left, right)
			case token.MUL:
				result.Mul(left, right)
			case token.QUO:
				if right.Sign() == 0 {
					return nil, fmt.Errorf("%w: division by zero", ErrOfferCalculation)
				}
				result.Quo(left, right)
			default:
				return nil, ErrOfferCalculation
			}
			return safe(result)
		case *ast.CallExpr:
			fn, ok := node.Fun.(*ast.Ident)
			if !ok || node.Ellipsis.IsValid() || len(node.Args) < 1 || len(node.Args) > 100 {
				return nil, ErrOfferCalculation
			}
			if !validEnum(fn.Name, "sum", "min", "max", "round", "percent") {
				return nil, ErrOfferCalculation
			}
			args := make([]*big.Rat, len(node.Args))
			for i, arg := range node.Args {
				value, err := evaluate(arg, depth+1)
				if err != nil {
					return nil, err
				}
				args[i] = value
			}
			value := new(big.Rat).Set(args[0])
			switch fn.Name {
			case "sum":
				for _, arg := range args[1:] {
					value.Add(value, arg)
				}
			case "min":
				for _, arg := range args[1:] {
					if arg.Cmp(value) < 0 {
						value.Set(arg)
					}
				}
			case "max":
				for _, arg := range args[1:] {
					if arg.Cmp(value) > 0 {
						value.Set(arg)
					}
				}
			case "percent":
				if len(args) != 2 {
					return nil, ErrOfferCalculation
				}
				value.Mul(value, args[1])
				value.Quo(value, big.NewRat(100, 1))
			case "round":
				if len(args) != 2 || !args[1].IsInt() {
					return nil, ErrOfferCalculation
				}
				digits, err := stdstrconv.Atoi(args[1].Num().String())
				if err != nil || digits < 0 || digits > 6 {
					return nil, ErrOfferCalculation
				}
				value = roundOfferDecimal(value, digits)
			}
			return safe(value)
		}
		return nil, ErrOfferCalculation
	}
	for _, field := range fields {
		if field.Kind == "section" {
			continue
		}
		if validEnum(field.Kind, "money", "number", "percent") {
			if field.Formula == "" && field.Default == "" && inputs[field.Key] == "" && !field.Required {
				continue
			}
			if _, err := resolve(field.Key); err != nil {
				if incomplete && errors.Is(err, errOfferMissingDraftValue) {
					continue
				}
				return nil, err
			}
			continue
		}
		value := field.Default
		if !field.Locked {
			if input, exists := inputs[field.Key]; exists {
				value = input
			}
		}
		value = strings.TrimSpace(value)
		if len(value) > 4000 || field.Required && value == "" && !incomplete {
			return nil, ErrOfferCalculation
		}
		if field.Kind == "date" && value != "" {
			if _, err := parseOptionalDate(value); err != nil {
				return nil, ErrOfferCalculation
			}
		}
		if field.Kind == "boolean" && value != "" && !validEnum(value, "true", "false") {
			return nil, ErrOfferCalculation
		}
		if field.Kind == "select" && value != "" && !validEnum(value, field.Options...) {
			return nil, ErrOfferCalculation
		}
		output[field.Key] = value
	}
	return output, nil
}
