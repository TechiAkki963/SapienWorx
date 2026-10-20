package parsing

import (
	"bytes"
	"context"
	"encoding/json"
	"time"

	contract "github.com/TechiAkki963/SapienWorx/backend/internal/candidate/profilecontract"
	"github.com/TechiAkki963/SapienWorx/backend/internal/intelligence/gateway"
	"github.com/TechiAkki963/SapienWorx/backend/internal/recruiter"
)

func reviewCounts(raw json.RawMessage) (int, int) {
	var history cvHistory
	if json.Unmarshal(raw, &history) == nil && len(history.Events) > 0 {
		latest := map[string]contract.ReviewStatus{}
		for _, event := range history.Events {
			for _, decision := range event.Patch.Decisions {
				latest[decision.Path] = decision.Status
			}
		}
		edits := 0
		for _, status := range latest {
			if status == contract.Edited {
				edits++
			}
		}
		return len(latest), edits
	}
	var job jobReviewArtifact
	if json.Unmarshal(raw, &job) != nil {
		return 0, 0
	}
	var original, corrected map[string]json.RawMessage
	_ = json.Unmarshal(job.Original, &original)
	encoded, _ := json.Marshal(job.Corrected)
	_ = json.Unmarshal(encoded, &corrected)
	edits := 0
	for _, key := range jobFields {
		if !bytes.Equal(original[key], corrected[key]) {
			edits++
		}
	}
	return len(jobFields), edits
}

type reviewEvent struct {
	Signals []CorrectionSignal   `json:"correction_signals,omitempty"`
	Patch   contract.ReviewPatch `json:"patch"`
	At      time.Time            `json:"at"`
}
type cvHistory struct {
	Events   []reviewEvent              `json:"events"`
	Accepted *contract.ConfirmationPlan `json:"accepted,omitempty"`
}
type profileStampStore interface {
	ProfileStamp(context.Context, gateway.Scope) (time.Time, error)
}

func (s SQLStore) ProfileStamp(ctx context.Context, scope gateway.Scope) (time.Time, error) {
	var stamp time.Time
	err := s.DB.QueryRow(ctx, `SELECT updated_at FROM candidate_profiles WHERE user_id=$1`, scope.UserID).Scan(&stamp)
	if err != nil {
		return time.Time{}, ErrUnavailable
	}
	return stamp, nil
}

func (s *Service) Get(ctx context.Context, id string) (Artifact, error) {
	if s == nil || s.Store == nil {
		return Artifact{}, ErrUnavailable
	}
	scope := gateway.ScopeFromContext(ctx)
	if scope.Role != "candidate" && scope.Role != "recruiter" {
		return Artifact{}, ErrForbidden
	}
	return s.Store.Get(ctx, scope, id)
}
func (s *Service) loadCVDraft(ctx context.Context, id string) (Artifact, *contract.ReviewDraft, cvHistory, error) {
	a, err := s.Get(ctx, id)
	if err != nil {
		return Artifact{}, nil, cvHistory{}, err
	}
	scope := gateway.ScopeFromContext(ctx)
	if a.Task != "cv.parse" || scope.Role != "candidate" || (a.Status != "requires_review" && a.Status != "owner_reviewed") {
		return a, nil, cvHistory{}, ErrInvalid
	}
	var out Outcome
	if json.Unmarshal(a.Result, &out) != nil {
		return a, nil, cvHistory{}, ErrInvalid
	}
	proposal, err := contract.DecodeResult(out.Value)
	if err != nil {
		return a, nil, cvHistory{}, ErrInvalid
	}
	draft, err := s.Validator.NewReviewDraft(contract.Actor{UserID: scope.UserID, Role: scope.Role}, proposal, time.Now().UTC())
	if err != nil {
		return a, nil, cvHistory{}, ErrInvalid
	}
	var history cvHistory
	if len(a.Review) > 0 && json.Unmarshal(a.Review, &history) != nil {
		return a, nil, cvHistory{}, ErrInvalid
	}
	if len(history.Events) > 64 {
		return a, nil, history, ErrInvalid
	}
	for _, event := range history.Events {
		for i := range event.Patch.Decisions {
			decision := &event.Patch.Decisions[i]
			if decision.Status != contract.Edited && string(decision.Value) == "null" {
				decision.Value = nil
			}
		}
		if draft.Apply(contract.Actor{UserID: scope.UserID, Role: scope.Role}, event.Patch, event.At) != nil {
			return a, nil, history, ErrInvalid
		}
	}
	// Confirming without another patch also advances the persisted revision.
	// Canonical draft revisions count patches only; never trust storage revision as a draft revision.
	return a, draft, history, nil
}
func (s *Service) CVReview(ctx context.Context, id string) (contract.ReviewView, error) {
	a, draft, _, err := s.loadCVDraft(ctx, id)
	if err != nil {
		return contract.ReviewView{}, err
	}
	scope := gateway.ScopeFromContext(ctx)
	view, err := s.Validator.ReadReview(draft, contract.Actor{UserID: scope.UserID, Role: scope.Role}, time.Now().UTC())
	view.Revision = a.Revision
	return view, err
}

// ReviewCV persists owner decisions and a validated confirmation plan. Applying
// that plan to authoritative sections still uses the existing profile APIs.
func (s *Service) ReviewCV(ctx context.Context, id string, expected uint64, patch contract.ReviewPatch, confirm bool) (contract.ReviewView, error) {
	a, draft, history, err := s.loadCVDraft(ctx, id)
	if err != nil {
		return contract.ReviewView{}, err
	}
	if expected != a.Revision || len(history.Events) >= 64 {
		return contract.ReviewView{}, ErrConflict
	}
	scope := gateway.ScopeFromContext(ctx)
	actor := contract.Actor{UserID: scope.UserID, Role: scope.Role}
	now := time.Now().UTC()
	patch.ExpectedRevision = draft.Revision()
	for i := range patch.Decisions {
		decision := &patch.Decisions[i]
		if decision.Status != contract.Edited && string(decision.Value) == "null" {
			decision.Value = nil
		}
	}
	if len(patch.Decisions) > 0 {
		if err = draft.Apply(actor, patch, now); err != nil {
			return contract.ReviewView{}, ErrInvalid
		}
		var out Outcome
		if json.Unmarshal(a.Result, &out) != nil {
			return contract.ReviewView{}, ErrInvalid
		}
		signals := make([]CorrectionSignal, 0, len(patch.Decisions))
		for _, decision := range patch.Decisions {
			value := decision.Value
			if decision.Status != contract.Edited {
				value = jsonAt(out.ProcessingValue(), decision.Path)
			}
			signals = append(signals, correction(out, decision.Path, value, decision.Status))
		}
		history.Events = append(history.Events, reviewEvent{Patch: patch, At: now, Signals: signals})
	}
	history.Accepted = nil
	if confirm {
		stamps, ok := s.Store.(profileStampStore)
		if !ok {
			return contract.ReviewView{}, ErrUnavailable
		}
		stamp, e := stamps.ProfileStamp(ctx, scope)
		if e != nil {
			return contract.ReviewView{}, ErrUnavailable
		}
		plan, e := s.Validator.PrepareConfirmation(draft, actor, draft.Revision(), &stamp, now)
		if e != nil {
			return contract.ReviewView{}, ErrInvalid
		}
		history.Accepted = &plan
	}
	raw, _ := json.Marshal(history)
	if err = s.Store.SaveReview(ctx, scope, id, expected, raw, confirm); err != nil {
		return contract.ReviewView{}, err
	}
	return s.CVReview(ctx, id)
}

type JobReview struct {
	ExpectedRevision uint64                     `json:"expected_revision"`
	Fields           recruiter.DetailedJobInput `json:"fields"`
	Confirm          bool                       `json:"confirm"`
}
type jobReviewArtifact struct {
	Signals    []CorrectionSignal         `json:"correction_signals,omitempty"`
	Original   json.RawMessage            `json:"original"`
	Corrected  recruiter.DetailedJobInput `json:"corrected"`
	ReviewedBy string                     `json:"reviewed_by"`
	ReviewedAt time.Time                  `json:"reviewed_at"`
	Confirmed  bool                       `json:"confirmed"`
}

func (s *Service) ReviewJob(ctx context.Context, id string, input JobReview) (Artifact, error) {
	a, err := s.Get(ctx, id)
	if err != nil {
		return Artifact{}, err
	}
	scope := gateway.ScopeFromContext(ctx)
	if scope.Role != "recruiter" || a.Task != "job.parse" || a.Status != "requires_review" && a.Status != "owner_reviewed" {
		return Artifact{}, ErrForbidden
	}
	if input.ExpectedRevision != a.Revision {
		return Artifact{}, ErrConflict
	}
	if recruiter.ValidateAIJobParseProposal(input.Fields) != nil {
		return Artifact{}, ErrInvalid
	}
	if input.Confirm && (input.Fields.Title == "" || input.Fields.EmploymentType == "" || input.Fields.WorkMode == "" || input.Fields.Openings < 1) {
		return Artifact{}, ErrInvalid
	}
	var out Outcome
	if json.Unmarshal(a.Result, &out) != nil {
		return Artifact{}, ErrInvalid
	}
	review := jobReviewArtifact{Original: out.Value, Corrected: input.Fields, ReviewedBy: scope.UserID, ReviewedAt: time.Now().UTC(), Confirmed: input.Confirm}
	corrected, _ := json.Marshal(input.Fields)
	for _, key := range jobFields {
		path := "/" + key
		status := contract.ReviewConfirmed
		value := jsonAt(corrected, path)
		if !bytes.Equal(jsonAt(out.Value, path), value) {
			status = contract.Edited
		}
		review.Signals = append(review.Signals, correction(out, path, value, status))
	}
	raw, _ := json.Marshal(review)
	if err = s.Store.SaveReview(ctx, scope, id, a.Revision, raw, input.Confirm); err != nil {
		return Artifact{}, err
	}
	return s.Get(ctx, id)
}
