# Master Admin security activation — reviewed operational procedure

Status: prepared locally; **not activated** in the running local application or AWS. This is not evidence of production readiness. No real identities were assigned automatically.

## Recommended separation

| Responsibility | Recommended existing-account role | Current assignment |
| --- | --- | --- |
| Confirmed product/account owner | Super Admin | Identity not yet confirmed |
| Day-to-day platform/recruitment operations | Platform Admin | Only if a distinct operator exists |
| Security operations and separate recovery operator | Security Admin | Identity not yet confirmed; must not be the recovery target |
| Privacy casework | Privacy Admin | Only when staffed |
| Read-only account support | Support Admin | Only when staffed |
| Cost reporting | Finance Admin | Only when staffed |
| Independent review | Auditor | Only when staffed |
| Content publishing | Content Admin | No content-management permission granted yet |

Do not fill missing staffing with dummy accounts or grant all administrators Super Admin. The recovery operator needs independently protected operator access; merely naming an account is not proof of identity. Product-owner confirmation of the exact account IDs, actor and approval reference is required before real assignments. No passwords or keys should be sent in chat.

## Activation gates

1. Review the complete release and additive migrations, preserve a protected database backup and verify the previous release for rollback. Rehearse on disposable accounts first.
2. Review exact active, email-verified administrator identities and least-privilege assignments. Assignment installation must be transactional and audited; this checkpoint does not implement an assignment-management UI or automatic grant script.
3. Store a stable, independently random `ADMIN_MFA_ENCRYPTION_KEY` of at least 32 bytes through approved runtime secret storage. Keep it separate from JWT/OTP keys. Never regenerate on restart, expose it in logs or change it without a protected key/seed migration and backup procedure.
4. Build the offline recovery tool from `backend/cmd/admin-recovery`. Do not place it behind an HTTP route. The tool is only useful to a trusted database operator and does not establish the caller's human identity itself.
5. Verify the operator identity and authorization out of band; obtain independent case review; rehearse inspection, denied/self recovery, failed-audit rollback, completed recovery, fresh enrollment and revoked-session denial. Application-enforced dual approval is still pending: this human procedure must not be represented as an implemented two-person workflow.
6. Keep `ADMIN_ACCESS_ENABLED=false` until assignments, runtime key and recovery rehearsal are verified. Existing legacy admin access remains broader while this flag is false. Enabling it is a separate reviewed rollout, not an automatic effect of this change.
7. After approved activation, enroll each administrator, confirm `/api/v1/admin/access` returns `enabled:true`, test allowed and denied direct API routes and both portals, and retain evidence tied to the deployed release. Local mock/browser tests do not satisfy this gate.

## Offline recovery tool

Supply `DATABASE_URL` through the approved runtime environment, with least necessary database permissions and verified encrypted connectivity in production. Do not pass a database password or connection URL as a command-line argument. Never print the environment. Tool diagnostics intentionally omit raw database errors/credentials.

Inspection is the default, even when application MFA is enabled:

```text
admin-recovery -target TARGET_ADMIN_UUID -operator APPROVED_SEPARATE_OPERATOR_UUID
```

The output contains only IDs, account status, presence of a credential, session count and snapshot time. It does not read or decrypt the authenticator seed, return tokens, assign roles or change security state.

For an independently approved recovery only, the trusted operator must explicitly enable `ADMIN_RECOVERY_APPLY_ENABLED=true` in that operator process and supply all apply gates:

```text
admin-recovery -target TARGET_ADMIN_UUID -operator APPROVED_SEPARATE_OPERATOR_UUID -apply -confirm-target TARGET_ADMIN_UUID -approval-ref REVIEWED_CASE_REFERENCE -reason "Non-sensitive identity-checked recovery justification"
```

This invocation is a template, not authorization to execute it. It rechecks existing operator eligibility (`security_admin` or `super_admin`), rejects self recovery and missing credentials, revokes target refresh sessions, deletes the target authenticator/MFA proofs and appends audit evidence atomically. Failure to append audit evidence rolls back the changes. Roles, passwords, account status and runtime encryption key are not changed, and no usable session/OTP is issued. A suspended account remains suspended. The target must log in and enroll/confirm a fresh authenticator through the existing secure flow. Verify old sessions are denied, then remove process-level recovery enablement.

Reason/case reference are audit evidence: include no codes, keys, passwords, CV text or private message content. The inspection is not a saved approval or an immutable execution plan; apply rechecks current authorization and state. Do not retry blindly after an ambiguous connection failure—inspect persisted audit/session/credential state first.

## Key loss and rollback

Restore the same protected runtime key when available. If it is irretrievable, follow a separately approved multi-account re-enrollment plan with independent identity checks; do not silently disable MFA or swap keys. Check key backup/restore evidence before claiming readiness. Disabling enforcement reduces protection and requires an explicit emergency decision. Never run security down migrations while enforcement is active; deleting assignments/seeds/proofs is destructive and requires a protected recovery plan.

## Local test boundary

Use a fresh disposable `sapienworx_admin_security_test` database on the test-only network. Run admin store tests, HTTP tests and then the operator test sequentially; migration rollback tests must not overlap them. The tests reject non-test databases and create only synthetic `example.invalid` identities. No real recovery, assignment, key installation or MFA activation is performed by this checkpoint.
