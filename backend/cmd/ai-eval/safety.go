package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/evaluation"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
)

// evaluationSafety is command-local. It has no database, feature switch or
// persistent conversation access. It discards unsafe output before journaling.
type evaluationSafety struct {
	provider    gateway.Provider
	cases       []evaluation.Case
	all         []evaluation.Case
	key         gateway.Secret
	cursor      int
	lastAttempt int
	stop        string
}

var unexpectedEmail = regexp.MustCompile(`[A-Za-z0-9_.+%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`)
var keyLike = regexp.MustCompile(`\bsk-[A-Za-z0-9_-]{20,}`)

func (s *evaluationSafety) String() string {
	return "Synthetic evaluation guard [private state withheld]"
}
func (s *evaluationSafety) GoString() string { return s.String() }

func (s *evaluationSafety) Generate(ctx context.Context, req gateway.ProviderRequest) (gateway.ProviderResult, error) {
	attempt := gateway.AttemptNumberFromContext(ctx)
	index := s.cursor
	if attempt > 1 {
		index--
	}
	if s.stop != "" || index < 0 || index >= len(s.cases) || attempt > 2 || (attempt > 1 && attempt != s.lastAttempt+1) {
		return gateway.ProviderResult{}, &gateway.Error{Code: gateway.InvalidRequest}
	}
	c := s.cases[index]
	want, _ := c.Request()
	if !c.Synthetic || req.Input != c.Text || req.Instructions != evaluation.Instructions || req.Model != "gpt-6-luna" || req.ServiceTier != "default" || req.Feature != c.Feature() || req.Schema == nil || req.Schema.Name != want.Schema.Name || string(req.Schema.JSON) != string(want.Schema.JSON) || req.MaxOutputTokens != c.OutputLimit() {
		s.stop = "SYNTHETIC_INPUT_BOUNDARY"
		return gateway.ProviderResult{}, &gateway.Error{Code: gateway.InvalidRequest}
	}
	if id := gateway.LogicalCaseFromContext(ctx); id != "" && id != c.ID {
		s.stop = "SYNTHETIC_INPUT_BOUNDARY"
		return gateway.ProviderResult{}, &gateway.Error{Code: gateway.InvalidRequest, Reason: gateway.ProviderSecurityRejected}
	}
	if attempt <= 1 {
		s.cursor++
	}
	s.lastAttempt = attempt
	r, err := s.provider.Generate(ctx, req)
	if err != nil {
		return r, err
	}
	unsafe := func(reason string) (gateway.ProviderResult, error) {
		s.stop = reason
		r.Output = ""
		return r, &gateway.Error{Code: gateway.InvalidResponse}
	}
	if s.key != "" && (strings.Contains(r.Output, string(s.key)) || strings.Contains(r.Model, string(s.key)) || strings.Contains(r.RequestID, string(s.key))) {
		r.Model = ""
		r.RequestID = ""
		return unsafe("SECRET_EXPOSURE")
	}
	if keyLike.MatchString(r.Output) {
		return unsafe("SECRET_EXPOSURE")
	}
	for _, email := range unexpectedEmail.FindAllString(r.Output, -1) {
		if !strings.Contains(c.Text, email) {
			return unsafe("UNEXPECTED_CONTACT_DATA")
		}
	}
	if c.Task == "cv.parse" {
		var p contract.ProfileData
		_ = json.Unmarshal([]byte(r.Output), &p)
		for _, phone := range []*string{p.Contact.PrimaryPhone, p.Contact.AlternatePhone} {
			if phone != nil && *phone != "" && !strings.Contains(c.Text, *phone) {
				return unsafe("UNEXPECTED_CONTACT_DATA")
			}
		}
	}
	if r.Model != "gpt-6-luna" {
		return unsafe("MODEL_CHANGED")
	}
	if r.Usage.InputTokens > int64(evaluation.InputBytes(c)) || r.Usage.OutputTokens > c.OutputLimit() {
		return unsafe("TOKEN_LIMIT_VIOLATION")
	}
	if strings.Contains(strings.ToLower(r.Output), "extract recruitment facts only from the untrusted document") {
		return unsafe("INSTRUCTION_LEAKAGE")
	}
	// Detect unique synthetic identities/employers from another case. Common
	// occupational facts are intentionally not treated as contamination.
	for _, other := range s.all {
		if other.ID == c.ID || other.Task != "cv.parse" {
			continue
		}
		var p contract.ProfileData
		_ = json.Unmarshal(other.ExpectedProfile, &p)
		markers := []*string{p.Identity.DisplayName, p.Contact.PrimaryEmail}
		for _, e := range p.Employment {
			markers = append(markers, e.Company.Name)
		}
		for _, marker := range markers {
			if marker == nil || len(*marker) < 8 || strings.Contains(c.Text, *marker) {
				continue
			}
			if strings.Contains(r.Output, *marker) {
				return unsafe("CROSS_CASE_CONTAMINATION")
			}
		}
	}
	return r, nil
}

type jdCheckpoint struct {
	Status         string               `json:"status"`
	PlanSHA256     string               `json:"plan_sha256"`
	Cases          int                  `json:"logical_cases_completed"`
	Attempts       int                  `json:"provider_attempts"`
	Spent          float64              `json:"estimated_spend_usd"`
	RemainingWorst float64              `json:"remaining_cv_worst_usd"`
	Cap            float64              `json:"hard_cap_usd"`
	Metrics        evaluation.Aggregate `json:"jd_metrics"`
}

func waitForCheckpoint(ctx context.Context, path string, checkpoint jdCheckpoint) error {
	f, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return fmt.Errorf("checkpoint cannot be created")
	}
	err = json.NewEncoder(f).Encode(checkpoint)
	if err == nil {
		err = f.Sync()
	}
	_ = f.Close()
	if err != nil {
		return fmt.Errorf("checkpoint cannot be persisted")
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()
	for {
		info, e := os.Stat(path + ".continue")
		if e == nil {
			if !info.Mode().IsRegular() || info.Size() > 128 {
				return fmt.Errorf("invalid checkpoint continuation")
			}
			raw, e := os.ReadFile(path + ".continue")
			if e != nil || strings.TrimSpace(string(raw)) != checkpoint.PlanSHA256 {
				return fmt.Errorf("checkpoint plan mismatch")
			}
			return nil
		}
		if !os.IsNotExist(e) {
			return fmt.Errorf("checkpoint unavailable")
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("checkpoint review timed out")
		case <-ticker.C:
		}
	}
}
