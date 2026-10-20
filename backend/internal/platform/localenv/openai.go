// Package localenv provides explicit, backend-only local credential loading.
// It never mutates the process environment or evaluates shell expressions.
package localenv

import (
	"bufio"
	"errors"
	"io"
	"os"
	"strings"
)

var errLocalEnv = errors.New("local OpenAI configuration could not be loaded; values withheld")

var allowed = map[string]bool{
	"OPENAI_API_KEY": true, "OPENAI_ENABLED": true, "OPENAI_DEFAULT_MODEL": true,
	"OPENAI_PARSER_MODEL": true, "OPENAI_GENERATION_MODEL": true,
	"AI_MODEL_PRICING_JSON": true,
}

// Lookup optionally reads only OpenAI settings from an explicitly named file.
// No implicit working-directory search, production loading, interpolation,
// command substitution, global Setenv, or frontend configuration is performed.
// Runtime environment wins, except a file's disabled switch is a safety veto.
func Lookup(getenv func(string) string, path string) (func(string) string, error) {
	if path == "" {
		return getenv, nil
	}
	if env := getenv("APP_ENV"); env != "" && env != "development" {
		return nil, errLocalEnv
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, errLocalEnv
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Size() > 1<<20 {
		return nil, errLocalEnv
	}
	values, err := read(io.LimitReader(f, (1<<20)+1))
	if err != nil {
		return nil, err
	}
	return func(key string) string {
		if key == "OPENAI_ENABLED" && values[key] == "false" {
			return "false"
		}
		if value := getenv(key); value != "" {
			return value
		}
		return values[key]
	}, nil
}

func read(r io.Reader) (map[string]string, error) {
	values := make(map[string]string)
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 4096), 65536)
	for scanner.Scan() {
		line := strings.TrimSpace(strings.TrimPrefix(scanner.Text(), "\ufeff"))
		line = strings.TrimPrefix(line, "export ")
		key, value, found := strings.Cut(line, "=")
		key = strings.TrimSpace(key)
		if !found || !allowed[key] {
			continue
		}
		if _, duplicate := values[key]; duplicate {
			return nil, errLocalEnv
		}
		value = strings.TrimSpace(value)
		if strings.HasPrefix(value, "\"") || strings.HasPrefix(value, "'") {
			quote := value[0]
			end := strings.IndexByte(value[1:], quote)
			if end < 0 {
				return nil, errLocalEnv
			}
			end++
			tail := strings.TrimSpace(value[end+1:])
			if tail != "" && !strings.HasPrefix(tail, "#") {
				return nil, errLocalEnv
			}
			value = value[1:end]
		} else if i := strings.Index(value, " #"); i >= 0 {
			value = strings.TrimSpace(value[:i])
		}
		if strings.ContainsAny(value, "\x00\r\n") {
			return nil, errLocalEnv
		}
		values[key] = value
	}
	if scanner.Err() != nil {
		return nil, errLocalEnv
	}
	return values, nil
}
