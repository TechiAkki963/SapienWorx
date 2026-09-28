# Master Admin phased implementation

Branch: `MasterAdmin`  
Review PR: #32  
Rule: no merge, migration application, production role activation, or deployment without separate rollout approval.

## Phase 1 — Live operations integration boundary

Implemented:
- Runtime PostgreSQL/Go process snapshot.
- Privacy-safe telemetry for InMail, SES, notifications, WebSockets and CV parsing.
- Signed collector ingestion endpoint: `POST /api/v1/admin/collector/events`.
- Collector endpoint is disabled unless `ADMIN_COLLECTOR_HMAC_SECRET` is configured.
- Replay resistance through timestamp validation plus a durable `source + event_id` idempotency ledger.
- Supported collector event types: `telemetry`, `operation_evidence`, `cost_snapshot`.
- Sensitive content fields are stripped/rejected by the existing telemetry/evidence schema controls.
- The application process does not require broad CloudWatch, Cost Explorer, SES or Backup read privileges.

Collector authentication:
- `X-SWX-Timestamp`: Unix seconds.
- `X-SWX-Signature`: `sha256=<hex HMAC>`.
- Signature input: `timestamp + "\n" + raw request body`.
- Algorithm: HMAC-SHA256 using `ADMIN_COLLECTOR_HMAC_SECRET`.
- Default accepted clock skew: 5 minutes, configurable through `ADMIN_COLLECTOR_MAX_CLOCK_SKEW` between 1 and 15 minutes.

Recommended production collectors:
- CloudWatch/RDS collector -> service/database operational evidence.
- SES event destination -> SES delivery/bounce/complaint metadata.
- Queue/worker collector -> notification backlog and retry telemetry.
- Application telemetry -> WebSocket and CV parser metadata.
- Cost Explorer/CUR collector -> actual cost snapshots.
- AWS Backup/restore validation job -> backup and restore-test evidence.
- CI/CD collector -> deployed commit, migration and release evidence.

## Phase 2 — Dual approval

Implemented:
- Governed approval requests.
- Two or more required approvals.
- Requester cannot approve their own request.
- One decision per reviewer.
- Approval, rejection, expiration and audit trail.
- High-risk settings require an approved request bound to the exact setting key.
- Release rollout requires dual approval.

## Phase 3 — User and organization governance

Implemented:
- Organization/country-scoped admin list filtering.
- Candidate/recruiter account summaries from existing Master Admin work.
- Restriction, invitation, recruiter reassignment and duplicate/merge review queues.
- Governed organization reviews create a dual-approval request.
- No silent organization merge or reassignment mutation is performed from a review request.

## Phase 4 — Moderation and privacy casework

Implemented:
- Assigned moderation/privacy/security/organization/operations cases.
- Investigation statuses, priority, reviewer assignment and immutable event history.
- Escalation, reviewed, legal-hold-added and legal-hold-released events.
- Existing DPDP/GDPR request, incident, ROPA and subprocessor registers remain integrated.
- Private message bodies and CV content are not copied into the casework telemetry model.

## Phase 5 — Release control centre

Implemented:
- Dedicated `/swx-command-centre/releases` workspace.
- Release reference, environment, commit SHA and migration reference.
- Dual-approval rollout gate.
- Deployment/acceptance/rejection/rollback states.
- Production acceptance requires passing backup evidence and passing restore-test evidence.
- Release acceptance remains evidence-driven; local/CI passing tests alone do not mark production accepted.

## Phase 6 — Alerts and incident ownership

Implemented:
- Rules for parser failures/latency, InMail failures, SES failures, notification backlog and WebSocket failures.
- Alert severity, owner, acknowledgement and resolution.
- Manual evaluation endpoint for controlled review.
- Alerts consume privacy-safe telemetry only.

## Phase 7 — Costs, content and settings

Implemented:
- Dedicated `/swx-command-centre/content-settings` workspace.
- Versioned Knowledge Hub revisions with draft/review/published/archived lifecycle.
- Controlled operational settings.
- High-risk exact-key dual-approval requirement.
- Actual cost snapshot records with currency, period, actual, forecast, budget and evidence reference.
- No fabricated AWS cost estimate when a real collector is not connected.

## Phase 8 — SapienWorx advisory intelligence

Implemented:
- Separate `internal/intelligence` analysis package.
- Aggregate-only platform snapshots.
- Conservative rule-based first engine.
- Recruitment, CV parser quality, operations, privacy and governance insights.
- Evidence and confidence stored per insight.
- Human review feedback.
- Advisory-only contract: the engine cannot suspend accounts, modify jobs, rank/reject candidates, approve privacy requests, alter configuration or deploy releases.

## Production activation still requires

1. Configure approved administrators and MFA.
2. Store the runtime admin encryption key and collector HMAC secret in the production secret manager.
3. Deploy collectors with least-privilege AWS roles.
4. Apply reviewed migrations in the release workflow.
5. Ingest real backup and restore-test evidence.
6. Verify live SES, CloudWatch/RDS, queue, parser, WebSocket and cost events.
7. Complete production smoke tests.
8. Obtain the independent release approval and production acceptance.

