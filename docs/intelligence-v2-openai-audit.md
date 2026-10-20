# Phase 1 pre-implementation audit

16 October 2026. Freshly fetched main: `b00fab7ee80f7eb4791d64e2e85e95657643129e`.
New isolated branch: `codex/intelligence-v2-openai-gateway`.

The root checkout has only its pre-existing untracked `.codex/` directory. Separate local worktrees contain uncommitted Task 1 gateway infrastructure, uncommitted Task 2 canonical contracts and the uncommitted Rust milestone. Recruiter profile work is separately committed. None is reset, rebased, committed or overwritten by this task.

Reusable source is copied into this isolated branch from the gateway and contract worktrees, with a path/SHA-256 input manifest under ignored `tmp/source-inputs.json`. Original worktrees remain authoritative preserved inputs. Historical Task 1/Task 2 reports stay in those worktrees; they are not current Phase 1 completion claims. Rust source is not imported.

Reviewed the Go Intelligence worker/analyzer/engine and gateway, Command Centre admission and registry/switch migrations, existing candidate profile contracts/provenance/review/validation/schema/fuzz tests, local PDF/DOCX/OCR extraction and scanner route, recruiter job-builder contracts, privacy lifecycle and existing secret preparation pattern.

Findings before Phase 1 changes:

- Main's original Gateway is a disabled governed stub. Unmerged Task 1 already supplies a neutral provider boundary, Responses adapter, strict local schema checks, bounded retries/rate/concurrency, safe telemetry and admin-only status. Reuse these rather than create another OpenAI client.
- Task 1 currently rejects enabled startup without a key, lacks a persistent budget/idempotency ledger and lacks a circuit breaker. Phase 1 must close these gaps while keeping default OFF.
- Task 2's ProfileData/ParserResult, owner review, nullable confidence, exact normalization and conservative dates are reusable. They deliberately do not persist a parse proposal or automatically update a profile. Keep their domain contract authoritative.
- Existing CV preview scans before extracting and keeps files/text in memory; legacy upload/preview does not provide a durable owned parser-result UUID. Add a separately versioned, consented preview path with server-owned identities, preserving the old endpoint. Never interpret an arbitrary client `scanned=true` as authorization.
- Recruiter DetailedJobInput is the existing job shape. Parsing must propose a safe subset of these fields and cannot publish a job, change internal notes/ownership, or invent compensation. Reuse its validation through an explicit proposal adapter.
- Existing Intelligence events/evaluations/audit reject raw PII payloads. Learning metadata must reference private, retention-bounded proposals; do not insert full CVs into generic audit/events or build a training pipeline.
- Existing optional beta secret preparation uses an exact SSM SecureString and private backend env file, disabled by default. Source preparation is not provisioning or activation; no AWS secrets are read or modified here.

The new user brief explicitly permits this scoped OpenAI integration despite the repository's general external API ban. It does not authorize a live provider invocation, Git publication, deployment or beta activation. Real smoke remains separately invoked and synthetic-only.

Implementation sequence: preserve/reconcile inputs → provider-neutral controls and Responses compatibility → job.parse and domain/taxonomy validation → synthetic JD evaluation → CV canonical adapter and scan/extraction boundary → private artifacts/corrections/retention → durable budgets/telemetry → mock/failure/security/regression tests → optional smoke command and report. JD generation remains a reviewed draft; no automatic publication.
