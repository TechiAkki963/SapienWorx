# Administrative access foundation — review checkpoint

Status: local-only scoped-access and authenticator integration implemented and validated on 2026-09-28. **Disabled by default. Not activated in existing local containers or production.**

The sections below retain the previous preview checkpoint as history. The current implementation and activation gates are recorded in the appended checkpoint.

Start with [Current implementation and activation gates](#current-checkpoint--local-scoped-rbac-and-mfa-integration) for the latest result.

## Delivered

- Restricted, read-only `/swx-command-centre/access` role-policy preview.
- Eight proposed administrative roles with explicit capabilities and deny-by-default unknown roles.
- No permission to browse private messages, delete accounts in bulk, assign roles, or deploy production.
- Unit-tested, unconnected TOTP and account-bound AES-GCM primitives. They do not enroll users, validate login requests, persist credentials, or grant sessions.

## Approval gate

The authentication integration was stopped by safety review because a fail-closed rollout without reviewed assignments and recovery can lock administrators out. No migration, login modification, API permission enforcement, or MFA enrollment endpoint is included in this checkpoint.

## Next isolated implementation, after explicit approval

1. Preserve the existing directly provisioned administrator through a recorded, reviewed role assignment. Do not automatically grant every `master_admin` super-admin access.
2. Add explicit assignments and encrypted authenticator credentials through a new transactional migration. Maintain stable encryption keys through runtime secret storage; define rotation and recovery before use.
3. Require recent password confirmation and an authenticator code for admin operations. Use account-wide attempt limits, enrollment expiry, single-use time steps, session binding and append-only audit events. Never log codes, seeds or tokens.
4. Bind MFA proof to a valid, non-revoked session with a bounded lifetime. Refresh must carry the original proof timestamp rather than extend it. Validate logout and role revocation immediately deny access.
5. Enforce each module/action permission in Go. Hide unauthorized UI controls and prevent server-rendered data fetching without permission. UI hiding is not authorization.
6. Supply reviewed lost-authenticator recovery and test it with disposable accounts. Do not introduce a silent reset or self-promotion endpoint.
7. Test migration, enrollment, invalid/replayed codes, account throttling, revoked sessions, refresh rotation, each role's direct API denials, and safe failure on audit/database errors.
8. Obtain separate production rollout approval. Confirm operator access, migration backup/rollback, runtime keys and enrollment instructions first.

## Phase boundaries

Full operational KPIs, lifecycle management, platform-wide audits, moderation, SES/parser monitoring, costs, release information and backup restore status remain later reviewable slices. This prototype neither certifies production security nor verifies live AWS state.

TOTP reference: [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238). The current primitive is prepared against its SHA-1 vectors; it is not a complete authentication feature.

## Local validation — 2026-09-28

- Frontend production build: passed; `/swx-command-centre/access` is server-rendered under the existing restricted layout.
- TypeScript check: passed.
- Full Go backend regression suite: passed in a temporary memory-limited container without any database connection.
- Seven new unit tests: passed, including policy/preview parity, default denial, role separation, RFC vectors, replay rejection and encrypted-credential tamper/account binding.
- Three isolated Chromium journeys: passed with synthetic accounts on separate ports. Anonymous visitors returned to the gateway; candidate/recruiter sessions could not open the preview; selection made no API mutations.
- Screenshots inspected at desktop 1440px and mobile 375px; tablet 768px was also captured and checked for horizontal overflow. The existing admin login dog loaded correctly.
- All temporary preview helpers were stopped afterward. Existing Docker stacks, credentials and databases were not modified. No commit, push or deployment occurred.

These results validate the read-only preview and unconnected primitives, not scoped API enforcement, MFA enrollment, production health or lost-authenticator recovery.

## Changed files in this checkpoint

- `backend/internal/admin/permissions.go`, `permissions_test.go`, `totp.go`, `totp_test.go`
- `frontend/app/swx-command-centre/(workspace)/access/page.tsx`
- `frontend/components/admin/admin-access-preview.tsx`, `admin-nav.tsx`
- `frontend/lib/admin-permission-catalog.json`
- `frontend/playwright.admin-access.config.ts`
- `frontend/tests/e2e/admin-access-preview.spec.ts`
- `frontend/tests/e2e/mock-api.mjs`: two environment-configurable test ports/origin lines only; earlier work was preserved.
- This review document.

Draft migration files created during the preview exploration were removed before execution. The new, explicitly approved isolated checkpoint below introduces migration 000032; it was exercised only in a disposable database.

## Current checkpoint — local scoped RBAC and MFA integration

The user approved proceeding with the previously proposed isolated implementation. No commit, push, production rollout, AWS change or existing-account mutation is included.

### Implemented

- Additive `000032_admin_access_security` migration: explicit role assignments, encrypted authenticator credentials and session-bound MFA proofs. No account is automatically assigned a role. No existing user or recruitment table is rewritten.
- Eight administrative roles and 13 named capabilities. Every existing operational admin route checks the current role/session when enforcement is enabled. Unknown roles/permissions deny access. Finance has read-only usage access; Content Admin has no content capability until that module exists. No private InMail browsing or bulk destructive operation is introduced.
- Self-status endpoint `/api/v1/admin/access`; password-confirmed enrollment and verification under `/api/v1/admin/security/mfa`. Candidate/recruiter sessions remain prohibited. No public admin signup or role-assignment API.
- Manual authenticator setup at `/swx-command-centre/security`, separate from candidate email OTP. No email, SMS, external QR service, SaaS integration or paid service is introduced.
- AES-GCM encrypted, account-bound 20-byte random seeds, using a dedicated runtime key. Pending enrollment expires in ten minutes and is tied to its initiating session. Enrolled authenticators cannot be silently overwritten.
- Six-digit, 30-second TOTP with single-use time steps and a one-step clock tolerance; password recheck; eight persisted verification attempts per five-minute account window, plus the existing IP limiter. The enrollment request also consumes an account attempt.
- MFA confirmation lasts up to 30 minutes; non-read administrative actions require confirmation within five minutes. Logout, refresh-session revocation, role revocation, account disablement and forced password reset invalidate operational access. Refresh inherits the exact original MFA deadline rather than extending it.
- Successful enrollment/verification/recovery and their grants are transactionally audited. An audit write failure rolls back the grant. Denials are audited; audit/database outages do not grant access. Passwords, TOTP codes, setup keys and tokens are not included in new audit/log metadata. Security responses use `Cache-Control: no-store`.
- Operator-only `RecoverMFA` store method: rejects self-recovery and unauthorized operators, requires an approval reference/reason, revokes the target's sessions, removes the authenticator and writes an audit event atomically. It never grants a role or issues a session. **No HTTP reset endpoint or operator CLI is supplied in this checkpoint.** Calling this method is reserved for a separately reviewed identity-checked operational procedure, not an ordinary admin browser session.
- Permission-filtered navigation and mutation/document controls; per-page server guards run before data fetching. The Auditor overview does not fetch the company-verification queue. A permission preview does not alter the assigned role or session.
- Responsive setup/confirmation and fail-closed error screens. Confirmation appears first on mobile. Existing admin login dog and gateway implementation remain unchanged.

### Validation

- Real PostgreSQL integration: nine store journeys passed, covering enrollment encryption/replay/session binding, expiry, persisted throttling, refresh/logout/revocation, unauthorized/self recovery denial, operator recovery, transactional audit failure at enrollment/verification/recovery, and migration down/up with no automatic grants. In particular, an audit failure left no new MFA proof and a failed recovery did not partially revoke the existing session/credential.
- Real Go HTTP router and database: eleven journeys passed. All eight roles exercised all 18 operational admin endpoints, including direct denied mutations. Allowed mutation cases use invalid/no-op inputs to test the gate without modifying real records. Disabled enforcement retained legacy access while disallowing enrollment. HTTP refresh-cookie rotation preserved the original proof; logout immediately denied the still-valid access token.
- Full Go backend regression suite passed after clearing the isolated database environment variable. DB-backed suites ran explicitly first, not as silently skipped tests.
- Frontend production build and TypeScript validation passed.
- Nine isolated Chromium journeys passed with synthetic responses: existing-role exclusions, enrollment/invalid-code/confirmation, unassigned denial before SSR data fetch, read-only controls, Auditor queue isolation, Finance read-only settings, expired confirmation and service failure/sign-out.
- Browser UI visually inspected; responsive screenshots at 1440, 768 and 375 pixels inspected for the security screens and gateway dog. No horizontal overflow. Screenshot setup keys and credentials are deliberately synthetic, not usable app credentials.
- Browser UI scenarios use the test mock; real-API authorization is validated separately by the Go/DB suite. This does not claim a complete production end-to-end rollout, independent penetration test or platform compliance certification.

### Isolation and repeatability

Database name must be `sapienworx_admin_security_test`; the tests also reject nonlocal/non-test hostnames. The disposable PostgreSQL container has no published ports and uses only synthetic `example.invalid` accounts. The image's anonymous data volume is automatically removed with the `--rm` container; no retained database volume is configured. Existing local app/test containers and databases are not changed.

The temporary preview helpers were stopped after inspection. The disposable database, its anonymous volume and private network were removed after the final tests; synthetic test data is not retained. The browser blocked closing the temporary preview tab after its server stopped, so that tab may need manual closing. Screenshots remain available under `output/admin-*`.

For backend validation, use a dedicated disposable database and set `ADMIN_SECURITY_TEST_DATABASE_URL` for these commands **in order**:

```text
go test -count=1 ./internal/admin
go test -count=1 ./internal/platform/httpserver
```

Unset that variable before `go test ./...`; do not run the migration rollback journey concurrently with the real-router suite. Browser validation uses `npx playwright test --config playwright.admin-access.config.ts` on 3010/18090 and does not reuse the ordinary application ports. The mock controller exists only in the test file, never in the Go server.

### Production activation — approval still required

1. Review the exact release and migration; back up the database and confirm operator access independently of this UI.
2. Approve each administrator's role and record the actor, approval reference and assignment audit transaction. Review the existing owner's assignment explicitly; do not backfill every `master_admin` as Super Admin. Establish a separate authorized recovery operator and verify the identity-check/approval process.
3. Supply a stable, independently random `ADMIN_MFA_ENCRYPTION_KEY` of at least 32 bytes through existing runtime secret management. It must differ from JWT/OTP secrets. Do not generate it on each restart, commit it, expose it in logs or replace it without an encrypted-seed migration plan.
4. Complete the reviewed operator invocation/runbook for the tested recovery method. Test lost-authenticator/key-loss recovery with disposable accounts before enabling the gate for the owner. This prototype is not yet an executable production recovery tool.
5. Apply the additive migration first with `ADMIN_ACCESS_ENABLED=false`. Verify it and the approved assignments. Only then explicitly approve enabling `ADMIN_ACCESS_ENABLED=true` in the target environment, enroll the approved administrators and verify direct API access/denials on the deployed release.
6. Keep key backup/restore and coordinated rollback instructions. Disabling enforcement restores the legacy master-admin guard and **reduces protection**; it requires a reviewed emergency decision, not an automatic fallback. Do not run the down migration while enforcement is active. The down migration deletes the three new security tables, so enrolled seeds/assignments/proofs would need recovery from a protected backup or approved re-enrollment.

The frontend treats a 404 from the self-status endpoint as an older-API compatibility mode, clearly labeled not enforced. A 403/503 or malformed response never falls back to legacy access. Deployment must verify the new status endpoint returns `enabled:true` before claiming scoped MFA protection is active.

### Files touched in this security integration

- Backend: `internal/admin/mfa.go`, `scoped_access.go`, `mfa_integration_test.go`, policy comment; `internal/platform/config/config.go`, `config_test.go`; `internal/platform/httpserver/admin_scoped_middleware.go`, its tests, `admin_security_handlers.go`, `admin_security_integration_test.go`, admin route registrations in `server.go`, MFA inheritance in `auth_handlers.go`.
- Database: migration `000032_admin_access_security.up.sql` and `.down.sql`.
- Frontend: `lib/admin-access.ts`, `admin-access-server.ts`; security page and admin error boundary; admin workspace layout and all eight page guards; admin shell, nav, access provider/preview, security form and permission-aware action controls.
- Tests: isolated admin Playwright config, preview/security suites, credential redaction and synthetic admin scenarios in the existing mock API.
- This document and visual evidence under `output/admin-*`.

Pre-existing candidate/recruiter/backend/Terraform/deployment changes remain intact and are not part of this checkpoint's release authorization.

### Next independently reviewable slice

The local dashboard slice is now implemented and validated: see [Dashboard review checkpoint](admin-dashboard-foundation.md). It adds database-backed operational counts, UTC reporting windows and permission-aware queue links, while labelling unintegrated AWS/SES/parser/release/backup evidence explicitly. Next: account/organization lifecycle and scoped recruitment/application audit drill-downs. Broader moderation, communications monitoring, costs, content and dual approval remain later slices. The full Master Admin checklist is not yet complete.

The subsequent local [Governance review checkpoint](admin-governance-foundation.md) now covers bounded account lifecycle, organization directory/filtering and separately approved current-session enforcement for candidate/recruiter HTTP and WebSockets. It does not enable scoped MFA, migrate the existing application database or deploy any release. Recruitment/application audit drill-downs remain the next slice.
