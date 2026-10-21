> Historical local report/plan: its original release status and test counts describe the dated work below. For the reconciled source scope, forward migration numbers and activation boundaries, see [the 22 October release note](UI_UX_BETA_RECONCILIATION_20261022.md).

# Recruiter professional profile

Status: implemented and verified locally. Release scope: local source commit only; no push, merge or deployment.

## Result

Replaced the decorative cover card with a circular photo/initials avatar and a compact professional identity header. The name wraps instead of truncating. Designation, company, location and active-role count sit together. Edit photo is attached to the avatar; the cross-workspace photo explanation sits immediately below the header. The native centered dialog uses a two-column details layout on desktop/tablet and a single-column, full-screen layout on mobile, with a persistent footer and independently scrolling content.

The details view shows work email and its actual verification state, work phone, designation, company, location, expertise and bio. Missing optional values display `Not added`. Editing supports full name, designation, work phone, location, expertise and bio. Cancel, save progress, success, failed-save recovery, unsaved-change confirmation, conflict protection, keyboard containment, Escape and focus return are covered.

Work phone is an optional professional contact field. It does not replace or change the account's verified authentication number. Company and work email remain read-only and account/organization-managed. No LinkedIn field or external integration was added.

## Persistence and security

- Added authenticated, recruiter-only `GET` and `PATCH /api/v1/recruiter/profile`. Ownership comes from the active session; the client cannot supply another user's identity or company.
- Added migration `000068_recruiter_professional_profile`: four optional fields on existing recruiter profiles, with empty defaults. Existing full name/designation/company data is retained. Work phone has an E.164 constraint; expertise is capped at 12 entries.
- Partial PATCH preserves omitted values. Server validation trims values, bounds lengths, rejects control characters and invalid phones, and deduplicates expertise. Client validation provides earlier feedback. Free text renders as escaped text.
- PATCH requires the exact last-read timestamp. A concurrent edit returns HTTP 409 and retains the local draft for recovery.
- Updates use a transaction and record an audit action without copying profile/contact data into audit metadata. Profile responses use `Cache-Control: no-store`.
- Every active recruiter, including a scoped collaborator, can manage their own identity. Existing job permissions and inactive-membership restrictions remain enforced.
- The photo control reuses the existing authenticated image upload and compression flow. It validates file type/size and reports errors or successful completion.

## Verification

44 distinct Chromium checks passed across focused runs:

- 15 new profile checks: saved editing and reload, permitted PATCH fields, account-menu/sidebar focus return, missing values, failed reads and retry, failed saves retaining drafts, stale-save conflicts, validation, literal HTML-like bio, photo failure/success and eight responsive appearance cases.
- 14 existing candidate dashboard/recruiter profile responsive checks and six existing recruiter sidebar checks.
- Four mobile Messages header checks and five existing inbox/notification checks.

The eight appearance cases cover 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 428×926, 390×844 and 360×800. Each captures view/edit states in Light, Dark and System modes: 48 screenshots. Representative desktop Light, tablet edit and mobile Dark screenshots were visually inspected. The matrix checks overflow, full-name visibility, persistent actions, initial edit focus and page exceptions.

Backend: 79 top-level tests passed (150 passing results including subtests) across `internal/recruiter` and `internal/platform/httpserver`, with the Go race detector. Twelve unrelated database/environment-gated tests were skipped. The new profile test ran against a disposable local PostgreSQL 17 database, not a mock: all 68 migrations, migration 68 down/up rehearsal, persistence/reload, partial updates, CSRF, anonymous/candidate/admin denial, tenant isolation, mass-assignment rejection, stale-write conflict, authentication-phone preservation, scoped-recruiter access, continued job authorization and audit recording passed.

Production Next.js build, TypeScript and `git diff --check` passed. No new dependency was added.

Evidence:

- `frontend/visual-artifacts/recruiter-profile/index.html` — screenshot gallery (ignored local artifacts).
- `tmp/recruiter-profile-browser.log` — 34/34 initial browser checks.
- `tmp/recruiter-profile-final-browser.log` — 24/24 final profile/Messages checks.
- `tmp/recruiter-profile-backend.json` — race-enabled backend results.
- `tmp/recruiter-profile-production-build.log` — successful production build.

## Release notes and limits

This is local verification using synthetic browser fixtures and a disposable database. It does not claim beta acceptance, physical-device keyboard testing, manual screen-reader certification or Safari/Firefox coverage. The disposable database was stopped after verification.

Migration 68 must run through the reviewed release process before this profile API/UI is deployed. Its down migration drops the four newly added fields; rollback after real users edit them would require preserving those values first. No live migration, beta/production data change, AWS, Caddy, TLS or DNS action was performed.

The verified Messages layout, emoji and mobile-header changes are included in the same source commit. Other pending AI, parser-contract and recruiter-sharing worktrees were not changed.
