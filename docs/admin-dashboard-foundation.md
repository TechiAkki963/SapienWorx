# Master Admin dashboard — local review checkpoint

Status: implemented and validated locally on 2026-09-28. Not committed, pushed, installed in existing local containers, or deployed to production.

This is the operational overview slice after the scoped RBAC/MFA foundation, not completion of the full Master Admin specification. Existing app containers and accounts were preserved.

## Delivered

- Read-only `GET /api/v1/admin/dashboard`, behind Master Admin authentication and the existing `overview.read` scoped gate when enabled.
- One PostgreSQL statement provides a consistent aggregate snapshot, with a five-second query deadline and no metrics-ledger writes.
- No candidate CVs, contacts, company documents or message bodies are returned.
- Current totals are separate from period activity. Today, last 7 / 30 calendar days including today, current month, current quarter and custom inclusive date ranges are supported.
- UTC boundaries: start inclusive, end exclusive; custom end is the following midnight, capped at the snapshot time. Future dates, reversed dates, unsupported periods and spans over 366 days are rejected.
- Database errors produce an unavailable state, never fabricated zero counts or an “all systems healthy” badge.
- Page-local profile layout fixes prevent initials/photo-button overlap without altering shared candidate/recruiter profile components.
- Admin login dog preserved.

## Count definitions

| Figure | Definition |
| --- | --- |
| Registered users / candidates / recruiters | All stored users, or the matching role; all account statuses and activity flags. |
| Verified recruiters | Recruiter profiles marked verified, including suspended users; not permission to recruit. |
| Organizations | All company records. No active-organization lifecycle status is inferred. |
| Published jobs | Current `active` job status, including past application deadlines. Not a historical publication total or a guarantee that applications remain open. |
| Draft jobs | Current `draft` status. |
| Applications | Application rows, including rejected/withdrawn; distinct candidate–job records, not unique candidates. |
| Upcoming interviews | `scheduled` status at or after snapshot time. |
| Offer / hired stage | Current application stages only. These are not historical offer issuance or hire ledgers. |
| Open privacy requests | Received, in progress or awaiting review. |
| Open privacy incidents | Incident register excluding closed cases, including contained cases. Not automated threat detection. |
| New accounts / publications / applications | Stored creation / publication / application timestamp in the chosen window. |
| Active InMail conversations | Distinct threads with a persisted message in the window. Includes closed threads with activity; not WebSocket presence or email delivery. |
| Admin access denials (API metadata) | Exact `admin.access_denied` audit events in the window; no private audit rows returned. Dedicated security UI is deferred. |

Counts may change before a drill-down page is opened; the displayed snapshot timestamp makes this explicit.

## Actionable queues

- Company reviews → `/swx-command-centre/tenants?status=pending`.
- Pending accounts → `/swx-command-centre/users?status=pending_verification`.
- Draft jobs → `/swx-command-centre/jobs?status=draft`.
- User totals link to all users or the candidate/recruiter role filter.
- Published-job total links to the active-status filter.

Queue links depend on the destination permission, independently of permission to view overview aggregates. Auditor sees counts but no user/company/job queues; the overview makes no private list requests. The Go endpoint independently enforces the existing scoped gate. Current rollout gate is still disabled by default; enabling it remains a separate approved security rollout.

Unimplemented drill-downs stay unlinked. There are no links pretending to filter a general recruiter workspace on behalf of an administrator.

## Validation

- Frontend type check and production build: passed.
- Isolated browser suite: 14 passed, none skipped. Includes gateway dog, security foundation regressions, reporting forms, precise queue URLs, invalid dates, unavailable vs empty snapshots, auditor scopes and responsive dashboard.
- Desktop 1440px, tablet 768px and mobile 375px screenshots inspected; no horizontal document overflow. The existing navigation stacks above the content on small screens.
- Final built frontend inspected in the in-app browser with a synthetic API. Changing Last 7 days to Today updated activity figures while totals stayed unchanged.
- Disposable PostgreSQL dashboard integration: four journeys passed; covers all 20 aggregate fields, distinct conversation counting, UTC/start/end boundaries, current-status definitions, matching management counts, read-only connection and cancellation failure.
- Date-window unit cases: seven supported windows plus malformed/reversed/future/oversized ranges and year boundary passed.
- Real HTTP + PostgreSQL admin authorization: all eight roles checked against the new endpoint, including denial for finance/support/content/security/privacy roles without overview scope. Cache policy, private response boundary and invalid range response passed.
- Existing MFA/session/security integration tests passed; full `go test ./...` passed after isolated database tests.
- Scoped diff whitespace check passed; existing line-ending warnings are not new functional defects.

The two early validation failures were corrected: a period-selector accessible-name problem, and synthetic database fixture typing/email-verification state. A handler receiver compile issue was also fixed before the successful final backend run.

## Files in this slice

Backend:
- `backend/internal/admin/dashboard.go`
- `backend/internal/admin/dashboard_test.go`
- `backend/internal/admin/dashboard_integration_test.go`
- `backend/internal/platform/httpserver/admin_dashboard_handler.go`
- Only the new dashboard route in `backend/internal/platform/httpserver/server.go`.
- Dashboard cases added to `backend/internal/platform/httpserver/admin_security_integration_test.go`.

Frontend:
- `frontend/app/swx-command-centre/(workspace)/overview/page.tsx`
- `frontend/lib/admin.ts`
- `frontend/playwright.admin-access.config.ts`
- `frontend/tests/e2e/admin-dashboard.spec.ts`
- Dashboard-only fixtures in the existing `frontend/tests/e2e/mock-api.mjs`.

Documentation:
- This report and a checkpoint link in `docs/admin-access-foundation.md`.

Unrelated candidate/recruiter, messaging, parser, database, Terraform and deployment changes remain intact. No additional migration, dependency, SaaS or AWS resource was introduced.

## Remaining scope

- Organization/country filters and scoped application/interview/outcome management drill-downs.
- Full account/organization lifecycle actions, historical recruitment audits, moderation cases and dual approval.
- Live AWS billing, SES delivery events, parser performance, WebSocket telemetry, running release metadata and backup/restore evidence. These are explicitly labelled not connected, not inferred from database counts.
- Security rollout still needs approved assignments, encryption key and reviewed recovery invocation/runbook.
- No public registration, SES mode, DNS, cloud budget or production release changes.

Next independently reviewable slice: account and organization lifecycle governance plus recruitment/application audit drill-downs, preserving authorization and privacy boundaries.

### Subsequent local checkpoint

The bounded account/organization governance and separately approved authentication fix are now implemented and tested locally: see [Governance review checkpoint](admin-governance-foundation.md). Recruitment/application audit drill-downs and organization-wide operations remain pending. No rollout is implied by either local checkpoint.
