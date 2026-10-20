package parsing

import (
	"encoding/json"
	"math"
	"regexp"
	"strconv"
	"strings"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

// This intentionally conservative source check accepts explicit annual INR
// figures only. Ambiguous formats remain unknown/reviewable; no FX or inferred
// monthly-to-annual conversion is performed. It is not a salary estimator.
var annualINR = regexp.MustCompile(`(?i)(?:\bINR|₹)\s*([0-9]+(?:\.[0-9]+)?)\s*(lakhs?|lacs?)?(?:\s*(?:to|[-–—])\s*(INR|₹)?\s*([0-9]+(?:\.[0-9]+)?)\s*(lakhs?|lacs?)?)?\s*(?:per\s+(?:year|annum)|annually|annual)\b`)

func JobSalarySourceMatches(job recruiter.DetailedJobInput, text string) bool {
	if job.MinSalaryLakhs == nil && job.MaxSalaryLakhs == nil {
		return true
	}
	if len(text) > 128000 {
		return false
	}
	matches := annualINR.FindAllStringSubmatch(strings.ReplaceAll(text, ",", ""), -1)
	var low, high float64
	found := false
	for _, m := range matches {
		lo, err := strconv.ParseFloat(m[1], 64)
		if err != nil {
			return false
		}
		hi := lo
		if m[4] != "" {
			hi, err = strconv.ParseFloat(m[4], 64)
			if err != nil {
				return false
			}
		}
		lowLakhs, highLakhs := m[2] != "", m[5] != ""
		if m[4] == "" {
			highLakhs = lowLakhs
		} else if m[3] != "" && lowLakhs != highLakhs {
			// Repeated currency with inconsistent units is ambiguous; do not guess.
			return false
		} else if m[3] == "" && (lowLakhs || highLakhs) {
			// A shared unit applies to both ends: INR 18 to 24 lakhs per year.
			lowLakhs, highLakhs = true, true
		}
		if !lowLakhs {
			lo /= 100000
		}
		if !highLakhs {
			hi /= 100000
		}
		if math.IsInf(lo, 0) || math.IsInf(hi, 0) || hi < lo || found && (lo != low || hi != high) {
			return false
		}
		low, high, found = lo, hi, true
	}
	return found && (job.MinSalaryLakhs == nil || math.Abs(*job.MinSalaryLakhs-low) < 1e-9) && (job.MaxSalaryLakhs == nil || math.Abs(*job.MaxSalaryLakhs-high) < 1e-9)
}

func jobMetadata(fields map[string]json.RawMessage, hash string) map[string]contract.FieldMetadata {
	out := map[string]contract.FieldMetadata{}
	for _, key := range jobFields {
		raw := fields[key]
		if len(raw) == 0 || string(raw) == "null" {
			continue
		}
		out["/"+key] = contract.FieldMetadata{Provenance: contract.Provenance{Source: "ai_derived", Kind: "inferred", Section: key, Reference: "document:" + hash[:16]}, Confidence: nil, Review: contract.Unreviewed}
	}
	return out
}
