# Master Admin account and organization governance — local review checkpoint

Status: implemented and validated locally on 2026-09-28. No commit, push, installation into existing local containers, AWS action or production rollout.

This completes the next bounded slice after the [dashboard](admin-dashboard-foundation.md) and [access foundation](admin-access-foundation.md). The user separately approved local implementation and testing of the related authentication/session fix. That approval does not authorize deploying its all-user behavior change.

## Delivered

- Searchable account directory with user ID, name, email/phone search, role/status filters, current verification state, organization, join date and last login. Desktop table becomes cards below 1024px. Dates are UTC.
- Explicit confirmation and required justification for suspension, restricted reactivation, forced password reset and session revocation. Cancel makes no mutation; stale state produces an honest conflict rather than success.
- All four account operations lock the user, revoke unrevoked refresh sessions and append the audit event in one transaction. Audit failure rolls back both the account change and session revocation.
- Master Admin/self and inactive targets are protected. Disabled accounts cannot be reactivated through this UI. Suspension does not delete profile/recruitment data. Reactivation requires prior suspension, verified email and, for recruiters, verified recruiter/company records. It never clears a required password reset or restores old sessions.
- Organization directory with ID/name/domain search, verification/country filters, associated recruiter, active-job and application counts. Recruiter drill-down retains `company_id` across account filtering and pagination. No CVs, candidate contacts, private messages, comments or registration documents are included in the new organization response.
- Organization verification is explicitly not an operational active/suspended status. No organization-wide suspension, merging, deletion or reassignment is implemented. Supplied website URLs are displayed as untrusted text, not executable links.
- Company verification decisions now require confirmation; rejection requires a reason. Replayed decisions and reassigned recruiter/company records are rejected. Approval only activates eligible pending accounts; it does not lift suspension or disablement. Rejection affects the reviewed recruiter, not every recruiter in the company.
- New routes use the existing server-side capabilities: `organizations.read` and `users.moderate`. SSR page guards run before fetching data. Read-only roles do not get action buttons; direct API denials are independently tested. The scoped admin rollout gate remains disabled by default, unchanged from the prior checkpoint.

## Approved authentication fix

Every protected HTTP request now validates current account/session state against PostgreSQL, in addition to JWT signature/expiry. A revoked, expired, suspended, disabled, inactive, role-mismatched or reset-required session is denied. Candidate/recruiter verification requirements remain in place. Database verification failures return unavailable, never an authorization fallback.

New login rechecks password/account state while locking the account before issuing a session. Refresh checks eligibility and locks the account/session before rotation. Forced reset invalidates existing sessions; successful code-verified password recovery clears the requirement. Invalid codes and the old password remain rejected. No email-verification or OTP bypass is introduced.

WebSocket handshakes use the same current-session guard. Existing sockets check authorization before incoming/outgoing events and each 25-second heartbeat. A revoked socket closes on the next check; an idle socket is not guaranteed to close instantly. Already-authorized in-flight requests are not retroactively cancelled. The additional indexed lookup per protected request/event should be monitored for database load before production rollout.

No authentication tokens, passwords, OTPs or TOTP codes were added to logs or audit metadata. Synthetic verification codes are used only inside the isolated backend tests; no test email is sent.

## Migration 000033

Real-database testing exposed an existing trigger defect: a shared recruiter activation trigger referenced `NEW.id` on a `recruiter_profiles` row. Migration `000033_recruiter_activation_trigger` branches on the trigger table before accessing its fields. It has no backfill, automatic role grant or eligibility relaxation.

The migration was exercised only in a disposable test database, including down/up with no automatic activation. Its down migration restores the prior definition, including the prior bug. Production recovery must review that explicitly; this is not a recommendation to downgrade the function blindly. Existing local/application databases were not migrated.

## Count definitions

- Recruiters: associated recruiter accounts across all account statuses/activity flags.
- Active jobs: stored `active` status, including past deadlines; not a guarantee that applications remain open.
- Applications: stored application records across all stages, including withdrawn/rejected; not unique candidates.
- Revoked-session audit count: all previously unrevoked rows, including already-expired sessions.

Organization count/items use a bounded read-only repeatable-read transaction. Lists are paginated; database errors remain errors, not fabricated empty success.

## Validation

- Frontend TypeScript and optimized production build passed.
- Isolated admin browser suite: 20 passed, none skipped. Includes all four account actions, no-write cancellation, required reasons, stale conflicts, protected accounts, permission boundaries, organization drill-down and responsive layouts, plus prior admin/MFA/dashboard/dog regressions.
- Desktop 1440px, tablet 768px and mobile 375px inspected. No document-width overflow. The existing small-screen navigation remains stacked above the workspace; redesigning that shell is outside this slice.
- The built frontend was also inspected in the in-app browser against synthetic data, including account confirmation, organization directory and scoped recruiter cards. Browser mocks are not represented as real production integration evidence.
- Disposable PostgreSQL: nine governance journeys passed, including transactional audit rollback for all four actions, concurrent conflict handling, verification restrictions, preservation of suspended/disabled accounts during approval, reassignment protection, privacy/count/filter boundaries and migration round-trip.
- Real Go HTTP router and PostgreSQL: all eight admin roles checked against 22 operational endpoints. Candidate and recruiter login, refresh, logout, revoke, suspend/reactivate and code-verified forced recovery passed. A revoked WebSocket could not send/persist content or reconnect. Existing dashboard/MFA/security tests also passed.
- Existing isolated dashboard and MFA suites passed. Full `go test ./...` passed after explicitly running DB-backed tests and then unsetting the isolated database variable. Those DB-backed results are not inferred from a skipped full-suite run.
- Session middleware unit cases cover valid, revoked, missing claims, missing authorizer and database failure.
- Scoped whitespace check passed. Existing unrelated changes and line-ending conventions are preserved.

The temporary preview processes/tab were closed after inspection. The identity-checked disposable database, its anonymous volume and empty private network were removed; synthetic database records are not recoverable from that discarded test instance. Test screenshots and source remain. All eight pre-existing local application/test containers were still healthy after cleanup. No app data was removed. The final screenshot is saved at `C:/Users/Admin/.codex/visualizations/2026/09/08/01a07fd4-ff45-7882-bab0-e3b52b083273/admin-governance-final.png`.

## Files in this slice

Backend:
- `internal/admin/account_lifecycle.go`, `organizations.go`, `governance_integration_test.go`; account directory, moderation delegation and verification-review sections of `service.go`.
- `internal/auth/session_access.go`; eligibility and issuance/refresh sections of `service.go`, verified-reset flag in `password_reset.go`, eligibility test.
- `internal/platform/httpserver/admin_lifecycle_handlers.go`, `session_middleware.go`, `session_middleware_test.go`; new routes/guard in `server.go`, account filtering/conflict handling in `admin_handlers.go`, reset error handling in `auth_handlers.go`, WebSocket session checks in `messaging_handlers.go`, expanded `admin_security_integration_test.go`.

Database:
- `database/migrations/000033_recruiter_activation_trigger.up.sql` and `.down.sql`.

Frontend:
- `app/swx-command-centre/(workspace)/users/page.tsx`, new `organizations/page.tsx`.
- `components/admin/account-lifecycle-actions.tsx`; verification confirmation in `admin-actions.tsx`; Organizations navigation in `admin-nav.tsx`; response types in `lib/admin.ts`.
- `tests/e2e/admin-governance.spec.ts`, bounded synthetic fixtures in `mock-api.mjs`, suite registration in `playwright.admin-access.config.ts`.

Documentation:
- This checkpoint and links from the two prior foundation reports.

These files may also contain earlier uncommitted work. This list is not authorization to commit their entire diffs or unrelated changes.

## Safe release requirements — not executed

1. Review the exact combined migration/release diff and backup/recovery procedure. The active checkout contains substantial unrelated work; do not publish the whole working tree without scope review.
2. Separately approve installation/deployment of the authentication behavior affecting all signed-in users. Verify issued JWT session IDs correspond to persisted refresh sessions, refresh-cookie behavior, authorized recovery recipients and database capacity on the target release.
3. Apply reviewed migrations before deploying code that depends on them. Verify candidate/recruiter/admin login and recovery against authorized disposable target accounts; no bypass of SES restrictions.
4. Keep the previous immutable release available, but remember rollback to its authentication code restores the old session-revocation weakness. Migration rollback and security rollback are separate decisions.
5. Scoped MFA activation still needs approved assignments, a stable runtime encryption key and an identity-checked executable recovery runbook. This checkpoint does not turn that gate on or assign real administrators.

## Remaining Master Admin scope

- Scoped recruitment/application/interview/outcome drill-downs and historical audit views.
- Organization-wide lifecycle, reassignment/merge policy, moderation cases and dual approval.
- Live release, AWS cost/budget, SES delivery, parser performance, WebSocket telemetry and backup/restore evidence. These remain unconnected rather than inferred from database aggregates.
- Broader privacy/security/content operations and independent production acceptance.

Next independently reviewable implementation slice: permission-filtered recruitment/application audit drill-downs. The complete Master Admin checklist is not finished.
