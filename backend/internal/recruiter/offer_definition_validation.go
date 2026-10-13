package recruiter

import (
	"go/ast"
	"go/parser"
	"go/token"
	"strings"
)

// Definition validation checks syntax and dependency graphs without inventing
// numeric values for applicant inputs. Runtime calculation validates actual data.
func validateOfferCalculationDefinitions(currency string, fields []OfferCalculationField) error {
	if len(fields) > 100 {
		return ErrOfferCalculation
	}
	if _, err := offerCurrencyScale(currency); err != nil {
		return err
	}
	defs := map[string]OfferCalculationField{}
	for _, f := range fields {
		if !offerFieldKey.MatchString(f.Key) || len(f.Label) == 0 || len(f.Label) > 120 || len(f.Formula) > 1024 || len(f.Default) > 4000 || !validEnum(f.Kind, "money", "number", "percent", "text", "date", "boolean", "select", "section") || f.Currency != "" && f.Currency != currency {
			return ErrOfferCalculation
		}
		if _, exists := defs[f.Key]; exists {
			return ErrOfferCalculation
		}
		if f.Kind == "select" {
			if len(f.Options) < 1 || len(f.Options) > 30 {
				return ErrOfferCalculation
			}
			seen := map[string]bool{}
			for _, v := range f.Options {
				if strings.TrimSpace(v) == "" || len(v) > 120 || seen[v] {
					return ErrOfferCalculation
				}
				seen[v] = true
			}
		}
		if f.Kind == "section" && (f.Formula != "" || f.Required || f.Default != "") {
			return ErrOfferCalculation
		}
		if f.Formula != "" && !validEnum(f.Kind, "money", "number", "percent") {
			return ErrOfferCalculation
		}
		defs[f.Key] = f
	}
	visiting, checked := map[string]bool{}, map[string]bool{}
	var visit func(string) error
	var expression func(ast.Expr, int) error
	expression = func(expr ast.Expr, depth int) error {
		if depth > 32 {
			return ErrOfferCalculation
		}
		switch n := expr.(type) {
		case *ast.BasicLit:
			if (n.Kind != token.INT && n.Kind != token.FLOAT) || !offerDecimal.MatchString(n.Value) {
				return ErrOfferCalculation
			}
			return nil
		case *ast.Ident:
			f, ok := defs[n.Name]
			if !ok || !validEnum(f.Kind, "money", "number", "percent") {
				return ErrOfferCalculation
			}
			return visit(n.Name)
		case *ast.ParenExpr:
			return expression(n.X, depth+1)
		case *ast.UnaryExpr:
			if n.Op != token.ADD && n.Op != token.SUB {
				return ErrOfferCalculation
			}
			return expression(n.X, depth+1)
		case *ast.BinaryExpr:
			if n.Op != token.ADD && n.Op != token.SUB && n.Op != token.MUL && n.Op != token.QUO {
				return ErrOfferCalculation
			}
			if err := expression(n.X, depth+1); err != nil {
				return err
			}
			return expression(n.Y, depth+1)
		case *ast.CallExpr:
			fn, ok := n.Fun.(*ast.Ident)
			if !ok || n.Ellipsis.IsValid() || !validEnum(fn.Name, "sum", "min", "max", "round", "percent") || len(n.Args) < 1 || len(n.Args) > 100 || (fn.Name == "round" || fn.Name == "percent") && len(n.Args) != 2 {
				return ErrOfferCalculation
			}
			for _, a := range n.Args {
				if err := expression(a, depth+1); err != nil {
					return err
				}
			}
			return nil
		}
		return ErrOfferCalculation
	}
	visit = func(key string) error {
		if checked[key] {
			return nil
		}
		if visiting[key] {
			return ErrOfferCalculation
		}
		visiting[key] = true
		defer delete(visiting, key)
		f := defs[key]
		if f.Formula != "" {
			expr, err := parser.ParseExpr(f.Formula)
			if err != nil {
				return ErrOfferCalculation
			}
			if err = expression(expr, 0); err != nil {
				return err
			}
			// Entirely constant formulas can be evaluated without fabricated
			// applicant values. Reject known-zero divisors and invalid rounding
			// before a template is published, using the authoritative engine.
			constant := true
			ast.Inspect(expr, func(n ast.Node) bool {
				if id, ok := n.(*ast.Ident); ok {
					if _, field := defs[id.Name]; field {
						constant = false
					}
				}
				return true
			})
			if constant {
				if _, err = CalculateOfferFields(currency, []OfferCalculationField{f}, nil); err != nil {
					return err
				}
			}
		}
		checked[key] = true
		return nil
	}
	for key := range defs {
		if err := visit(key); err != nil {
			return err
		}
	}
	// Validate stored defaults and locked inputs using the same typed engine.
	base := []OfferCalculationField{}
	inputs := map[string]string{}
	for _, f := range fields {
		if f.Formula != "" || f.Kind == "section" {
			continue
		}
		base = append(base, f)
		value := f.Default
		if value == "" && !f.Locked {
			switch f.Kind {
			case "money", "number", "percent":
				value = "1"
			case "date":
				value = "2027-01-01"
			case "boolean":
				value = "true"
			case "select":
				value = f.Options[0]
			default:
				value = "Validation"
			}
		}
		inputs[f.Key] = value
	}
	_, err := CalculateOfferFields(currency, base, inputs)
	return err
}
