> Historical local report/plan: its original release status and test counts describe the dated work below. For the reconciled source scope, forward migration numbers and activation boundaries, see [the 22 October release note](UI_UX_BETA_RECONCILIATION_20261022.md).

# Recruiter job sharing — implementation and QA report

15 October 2026 · **PASS locally; uncommitted for review.**

Branch: `codex/recruiter-job-sharing-access`.
Base: `b00fab7ee80f7eb4791d64e2e85e95657643129e`.
No commit, push, PR, merge, deployment, production configuration or AWS action.

## 1. Root cause

`JobActions` rendered sharing only for active/public jobs. Other jobs received a
generic sentence with no discoverable Share control and no explicit visibility
change path. The old recruiter share popover also constructed a UUID URL locally,
without checking anonymous job availability; the candidate experience already
had safer public-reference URL and clipboard handling.

## 2. Architecture discovered and reused

Next.js client components use the existing `RecruiterModal`, workspace styles,
theme tokens and icon set. Job statuses already include draft/active/paused/
closed/expired/archived; visibility supports public/private. Company-only job
visibility is not currently supported and was not added.

The Go API already has current-session, recruiter-role, CSRF and scoped-company
guards. `company.MemberTx`, `JobAllowedTx`, company/job locks and
`job_change_audit` provide governed writes. The existing full-job PATCH changes
many fields at once; using a read/modify/write copy of it for visibility could
overwrite unrelated concurrent edits. A narrow visibility operation was therefore
added within the same service/authorization/audit architecture. No migration,
parallel permission model or external integration was introduced.

The anonymous job endpoint currently excludes private, draft, closed, archived,
paused and expired/deadline-passed jobs. This behavior remains intact; closed
public jobs do not gain a new public sharing or application path.

## 3. Files changed

| File/module | Purpose |
| --- | --- |
| `frontend/components/recruiter/job-actions.tsx` | State/visibility badges, grouped actions, permission/read states, explicit confirmation, success/error feedback, compact assignment and grouped lifecycle controls |
| `frontend/components/recruiter/job-share-menu.tsx` | Retains the existing entry point, now opens a focused Share dialog |
| `frontend/components/recruiter/job-share-panel.tsx` | Public context, canonical link, clipboard and five share destinations |
| `frontend/components/recruiter/job-context.tsx` | Keeps Share discoverable consistently in the job workspace |
| `frontend/components/recruiter/workspace-ui.tsx` | Stops nested Escape cancellation bubbling; wraps long titles and preserves close-button size |
| `frontend/lib/use-public-job-share.ts` | Shared public availability, canonical URL, clipboard cleanup/error handling and encoded destination links |
| `frontend/components/candidate/job-share-button.tsx` | Reuses shared logic; preserves candidate appearance and its existing three destinations |
| `backend/internal/recruiter/job_visibility.go` | Scoped read capability, confirmation preconditions, narrow write and atomic audit |
| `backend/internal/platform/httpserver/{server,recruiter_handlers}.go` | Protected visibility routes and controlled stale/unavailable errors |
| `backend/internal/platform/httpserver/company_security_integration_test.go` | Live local PostgreSQL authorization, stale-write, audit and deadline assertions |
| `frontend/tests/e2e/recruiter-job-sharing.spec.ts` | Functional, negative, keyboard, theme, contrast and responsive acceptance |
| Existing recruiter/accessibility/visual specs and mock API | Updated approved behavior and deterministic synthetic fixtures |

No product stylesheet, dependency, database migration, AI or extraction file was
changed. Next-generated environment declarations were restored after testing.

## 4. UI/UX changes

* Job title is followed by separate textual **Status** and **Visibility** badges,
  then business job ID, owner and IST updated timestamp.
* Edit, analytics and duplicate remain available as compact common actions.
  Share is visually grouped and always present in Job Actions.
* Private jobs display the reason directly under disabled Share. Only a successful
  server permission read can reveal **Make job public**. Drafts offer the existing
  editor's **Review & publish** path to authorized recruiters. Archived and other
  non-active statuses explain why sharing is unavailable.
* Make public requires a separate confirmation. Cancel/Escape produces no write.
  Successful confirmation updates the badge/action without a full-page reload,
  announces success and focuses the newly enabled Share control. Failure keeps
  Private and exposes a recoverable error.
* Assignment uses one compact desktop row and stacks on mobile. Status transitions
  retain existing legal-transition/reason/confirmation semantics, under a clear
  current-status heading. No backend lifecycle semantics were changed.
* Share opens a centered dialog, full screen below the existing mobile breakpoint.
  It first checks the anonymous endpoint, then displays only the canonical public
  job-reference URL. Copy is explicit, changes to **Copied ✓** for 1.8 seconds and
  keeps the panel open. Clipboard failure selects the URL for manual copying.
* LinkedIn, WhatsApp and Email are first; Facebook and X follow. Links are encoded,
  social tabs use `noopener noreferrer`, and the referral explanation remains
  separate. Tests inspect destination URLs; no social post or email was sent.

Local screenshots necessarily show localhost. The same existing allowlist uses
`https://beta.sapienworx.com/jobs/SWX-JOB-…` on beta and the public SapienWorx
origin in production. No internal recruiter URL, auth/session/candidate token,
referral parameter or UUID is used as a share link.

## 5. Backend behavior

`GET /api/v1/recruiter/jobs/{jobID}/visibility` returns current status, visibility,
timestamp and the server-derived visibility permission, only for an authorized
company/job reader.

`PATCH` at the same path accepts:

```json
{
  "visibility": "public",
  "expected_visibility": "private",
  "expected_status": "active",
  "expected_updated_at": "<timestamp returned by GET>"
}
```

The service rechecks active membership, `jobs.manage` and job scope under the
company lock, locks the job, and checks all confirmation preconditions. It only
updates visibility; it cannot publish, reactivate, replace a job payload or change
ownership. A passed deadline is rejected with a controlled explanation. Stale
confirmations return 409. The existing audit records `visibility_changed` with
actor/job/company, previous/new visibility and the existing timestamp in the same
transaction. Rejected or replayed writes create no audit entry.

## 6. Authorization/security verification

Fresh PostgreSQL HTTP tests verified:

* Anonymous 401; candidate role 403; collaborator and out-of-scope recruiter 403.
* Cross-company owner mutation 404; readable collaborator capability is false.
* Authorized in-scope recruiter can make the job public.
* State remains active and audit changes exactly once from private to public,
  attributed to the actual recruiter.
* Stale timestamp/visibility/status, missing preconditions, draft/closed/archived
  transitions and expired deadline cannot publish/expose the job.
* Existing job access/public-field filtering and governed workspace tests pass.

Existing session/CSRF/company guards remain on both routes. Frontend hiding is
not treated as authorization. No secrets, account changes or production data.

## 7–8. Tests and results

Counts distinguish top-level gates from subtests; overlapping counts are not
summed as independent tests.

| Verification | Actual result | Evidence under `tmp/` |
| --- | --- | --- |
| New sharing acceptance | **41 passed**: 17 functional/negative/keyboard/utility checks and 24 viewport/theme cases | `sharing-final-acceptance.json` |
| Existing affected browser regression | **51 passed, 1 existing intentional Kanban skip**, zero failures/flaky | `sharing-regression.json` |
| Final responsive screenshot/console rerun | **24 cases** across all requested sizes/themes | `sharing-final-visual.json` |
| Complete Go race suite | **182 top-level / 335 tests-subtests passed**, zero failures; 24 DB-only gates correctly skipped without DSNs | `sharing-race.jsonl` |
| Relevant PostgreSQL/race integration | **4 distinct top-level / 48 tests-subtests passed**; latest company/visibility rerun passed | Referenced `sharing-db-Test*.jsonl`, `sharing-database*.json` |
| Existing migration compatibility | **67 forward migrations** applied in disposable local DB templates; **0 new migrations** | `sharing-*-database-progress.log` |
| Static/build | Go vet, TypeScript and local production Next.js build passed | `sharing-vet.log`, `sharing-typecheck.log`, `sharing-production-build.log` |

Functional coverage includes public/private/draft/archived/closed/paused/expired
states, delayed/failed permission reads, API 403/409/503 failures, unavailable
public lookup, clipboard success/failure, encoded destinations, confirmation
cancellation, immutable preconditions, focus return and nested Escape behavior.
Existing edit/duplicate/assignment, lifecycle, interview/offer and candidate
sharing/referral flows were regression-checked. No blanket claim of full WCAG
certification or real screen-reader/browser-engine coverage is made.

## 9. Visual QA by viewport/theme

| Viewport | Light | Dark | System |
| --- | --- | --- | --- |
| 1920×1080 | PASS | PASS | PASS |
| 1440×900 | PASS | PASS | PASS |
| 1366×768 | PASS | PASS | PASS |
| 1024×768 | PASS | PASS | PASS |
| 768×1024 | PASS | PASS | PASS |
| 428×926 | PASS | PASS | PASS |
| 390×844 | PASS | PASS | PASS |
| 360×800 | PASS | PASS | PASS |

Each case captures private actions, make-public confirmation, public actions and
Share. System also switches live from dark OS appearance to light and captures
the updated Share state. Automated checks cover dialog/viewport geometry, no
horizontal overflow, reachable lower actions, minimum close touch target,
selected normal-text contrast ≥4.5:1, keyboard behavior and page errors. The final
visual pass additionally checks browser console errors. Manual screenshot
inspection covered representative states across every viewport, Light/Dark and
System; automated assertions cover the complete matrix.

Review found and fixed a narrow-screen Copy-label wrap, low-contrast disabled
Share appearance, unwanted initial focus/scroll to assignment, and nested Escape
closing two dialogs. Desktop assignment was compacted to reduce scrolling.
Short mobile screens intentionally scroll the modal body; lower status actions
remain reachable and the header stays available. Screenshot capture waits for
the requested server refresh to avoid clipping a dialog mid-resize.

## 10. Screenshots

**104 PNGs**, retained locally under:
`frontend/visual-artifacts/recruiter-job-sharing/<width>x<height>/`.

The local `index.html` gallery groups screenshots by size/state/theme. Examples:

* [Desktop private / Dark](../frontend/visual-artifacts/recruiter-job-sharing/1366x768/private-actions-dark.png)
* [Desktop Share / Light](../frontend/visual-artifacts/recruiter-job-sharing/1440x900/share-light.png)
* [Mobile Share / Dark](../frontend/visual-artifacts/recruiter-job-sharing/360x800/share-dark.png)
* [System switched to Light](../frontend/visual-artifacts/recruiter-job-sharing/768x1024/share-system-light-system.png)

## 11. Remaining risks and recommendations

No known failing local gate for this scope. GitHub-hosted CI and deployment have
not run because the user explicitly reserved commit/push/merge/deployment for
separate approval. Public sharing availability remains subject to the existing
anonymous endpoint and current job state; closing/privatizing a previously public
job can invalidate a link already copied elsewhere. No external share-cache
invalidation or social posting is attempted.

Chromium is the measured browser engine; no claim of Safari/Firefox or actual
assistive-technology certification. The screenshot gallery uses synthetic local
data. Existing production/beta infrastructure, TLS, Caddy, DNS, www/apex, SES and
application data were untouched.

**Task 3 is separately blocked by the unmerged Task 2 prerequisite.** See
[Task 3 prerequisite status](task-3-prerequisite-status.md). No extraction, OCR,
semantic parsing, AI Gateway activation or real API key call was performed.
