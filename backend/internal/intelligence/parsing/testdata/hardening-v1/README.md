# Captured provider regression corpus

These are author-created synthetic CV/JD examples, with the structured responses
captured in the approved 40-call baseline. They contain no customer records,
credentials, document attachments or private account contact information.

`cases.json` holds 40 immutable source/raw-response envelopes and source hashes.
`errors.json` defines 185 individually identified field regressions, each linked
to its source/raw envelope by `source_fixture`. That reference is part of the
fixture, not an external or future provider dependency. Each regression specifies
the normalized value, review-required validation status, expected provenance (or
absence for unknown/removed values), category, root cause and remedy. The shared
envelopes prevent duplicating the same CV up to a dozen times.

`TestCapturedProviderHardeningReplay` resolves all references, checks the hashes,
validates the current strict schema, executes the production normalization and
postprocessing functions, validates the canonical result/profile, and checks all
185 expected field/provenance outcomes. No provider is constructed. It does not
silently replace any frozen golden labels. A passing fixture can deliberately
retain a strict-score mismatch where the correct policy is to preserve a
representation or reject an unsupported golden assumption.

The frozen V1 score remains in `evaluation/testdata/*.v1.json` and
`docs/benchmarks/openai-parsing-baseline-v1.json`. The separate representation
metric tolerates only documented unknown-null/empty collection shapes, equivalent
degree/study decomposition, and duplicate duties/work-preference projections.
It does not excuse conflicting headlines or infer preferred-location countries.
Proposed golden errata remain errors under both published score variants.

From the backend directory:

```powershell
go test ./internal/intelligence/evaluation -run TestCapturedProviderHardeningReplay -count=1
go test ./internal/intelligence/parsing -count=1
go run ./cmd/ai-replay
```

The replay command emits private synthetic replay evidence and arithmetic cost
planning only. Its six-case retest proposal is not an authorization or an
executable live evaluation manifest. A future live run needs explicit approval,
a reviewed exact-case selector, fresh price/budget checks and a new journal.
Never overwrite the original V1 benchmark with an offline replay or call it V1.1.
