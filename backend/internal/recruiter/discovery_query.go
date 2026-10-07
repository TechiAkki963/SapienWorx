package recruiter

import (
	"fmt"
	"strings"
)

type discoveryToken struct{ kind, value string }
type discoveryExpr struct {
	op, value   string
	left, right *discoveryExpr
}

func tokenizeDiscovery(input string) ([]discoveryToken, error) {
	if len(input) > 300 {
		return nil, ErrInvalid
	}
	tokens := make([]discoveryToken, 0, 16)
	for i := 0; i < len(input); {
		switch input[i] {
		case ' ', '\t', '\n':
			i++
			continue
		case '(':
			tokens = append(tokens, discoveryToken{kind: "("})
			i++
		case ')':
			tokens = append(tokens, discoveryToken{kind: ")"})
			i++
		case '"':
			i++
			start := i
			for i < len(input) && input[i] != '"' {
				i++
			}
			if i == len(input) || strings.TrimSpace(input[start:i]) == "" {
				return nil, ErrInvalid
			}
			tokens = append(tokens, discoveryToken{kind: "term", value: input[start:i]})
			i++
		default:
			start := i
			for i < len(input) && !strings.ContainsRune(" \t\n()\"", rune(input[i])) {
				i++
			}
			word := input[start:i]
			upper := strings.ToUpper(word)
			if upper == "AND" || upper == "OR" || upper == "NOT" {
				tokens = append(tokens, discoveryToken{kind: upper})
			} else {
				tokens = append(tokens, discoveryToken{kind: "term", value: word})
			}
		}
		if len(tokens) > 50 {
			return nil, ErrInvalid
		}
	}
	return tokens, nil
}

type discoveryParser struct {
	tokens     []discoveryToken
	pos, depth int
}

func (p *discoveryParser) peek() string {
	if p.pos >= len(p.tokens) {
		return "end"
	}
	return p.tokens[p.pos].kind
}
func (p *discoveryParser) primary() (*discoveryExpr, error) {
	if p.depth > 12 {
		return nil, ErrInvalid
	}
	if p.peek() == "NOT" {
		p.pos++
		p.depth++
		child, err := p.primary()
		p.depth--
		if err != nil {
			return nil, err
		}
		return &discoveryExpr{op: "NOT", left: child}, nil
	}
	if p.peek() == "(" {
		p.pos++
		p.depth++
		expr, err := p.or()
		p.depth--
		if err != nil || p.peek() != ")" {
			return nil, ErrInvalid
		}
		p.pos++
		return expr, nil
	}
	if p.peek() != "term" {
		return nil, ErrInvalid
	}
	term := p.tokens[p.pos].value
	p.pos++
	return &discoveryExpr{op: "term", value: term}, nil
}
func (p *discoveryParser) and() (*discoveryExpr, error) {
	left, err := p.primary()
	if err != nil {
		return nil, err
	}
	for p.peek() == "AND" || p.peek() == "NOT" || p.peek() == "term" || p.peek() == "(" {
		if p.peek() == "AND" {
			p.pos++
		}
		right, err := p.primary()
		if err != nil {
			return nil, err
		}
		left = &discoveryExpr{op: "AND", left: left, right: right}
	}
	return left, nil
}
func (p *discoveryParser) or() (*discoveryExpr, error) {
	left, err := p.and()
	if err != nil {
		return nil, err
	}
	for p.peek() == "OR" {
		p.pos++
		right, err := p.and()
		if err != nil {
			return nil, err
		}
		left = &discoveryExpr{op: "OR", left: left, right: right}
	}
	return left, nil
}
func parseDiscoveryQuery(input string) (*discoveryExpr, error) {
	tokens, err := tokenizeDiscovery(strings.TrimSpace(input))
	if err != nil {
		return nil, err
	}
	if len(tokens) == 0 {
		return nil, nil
	}
	p := discoveryParser{tokens: tokens}
	expr, err := p.or()
	if err != nil || p.pos != len(tokens) {
		return nil, ErrInvalid
	}
	return expr, nil
}
func discoveryPattern(value string) string {
	return "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(strings.TrimSpace(value)) + "%"
}
func (e *discoveryExpr) sql(args *[]any) string {
	return e.sqlScope(args, "candidate_discovery_search_text(cp.headline,cp.profile_details)")
}
func (e *discoveryExpr) sqlScope(args *[]any, scope string) string {
	if e.op == "term" {
		*args = append(*args, discoveryPattern(e.value))
		return fmt.Sprintf(scope+" ILIKE $%d ESCAPE '\\'", len(*args))
	}
	if e.op == "NOT" {
		return "(NOT " + e.left.sqlScope(args, scope) + ")"
	}
	return "(" + e.left.sqlScope(args, scope) + " " + e.op + " " + e.right.sqlScope(args, scope) + ")"
}
