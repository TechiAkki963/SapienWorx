# Governed AI beta activation package

Prepared 20 October 2026. **Code delivery is authorized; activation and secret provisioning are not.**
The disabled release reuses EC2 `i-0356b55e3d7eaf72a`, RDS and `sapienworx_beta`.
No edge, DNS, TLS, production, Rust or infrastructure change is required.

## Before a separately approved activation

1. Approve the selected tasks, actors/tenants, budget and rate configuration, privacy/subprocessor review and short capacity canary. Dedicated CV/JD parsing browser integration is a separate outstanding gate; their new APIs must not be described as complete end-user flows.
2. Provision **distinct beta-only** restricted OpenAI and random AES-256 proposal keys through the existing SecureString mechanism. Never reuse the developer `.env` or future production credentials. The prepared loader expects exactly `/sapienworx/beta/OPENAI_API_KEY` and `/sapienworx/beta/AI_ARTIFACT_ENCRYPTION_KEY`. No parameters have been created by this task.
3. Existing runtime IAM permits SSM reads and KMS decryption only in the beta parameter namespace. Preserve that boundary. A dedicated secret-loader policy should name only those two parameter ARNs, without `GetParametersByPath`; do not broaden GitHub deployment or frontend permissions. Operator/root and Docker administrators remain privileged. Default SSM encryption uses the existing AWS-managed key; a new paid KMS key is unnecessary for this package.
4. Prepare the private file **only after approval**, in a root operator session with shell tracing disabled:

   ```sh
   set +x
   umask 077
   aws ssm get-parameters --region ap-south-1 --with-decryption --names \
     /sapienworx/beta/OPENAI_API_KEY \
     /sapienworx/beta/AI_ARTIFACT_ENCRYPTION_KEY --output json \
     | python3 /opt/sapienworx-beta/prepare-ai-secret.py
   ```

   The loader reads stdin, validates both SecureStrings, writes `runtime/ai.env` mode 0600 exclusively, never prints values and leaves both master environment flags false. It refuses an existing file. Pricing comes from the versioned catalog shipped beside the loader. No developer or GitHub secret is involved.
5. Review `runtime/ai-controls.env` privately. It is installed OFF on first deployment and takes precedence over the secret file. Enable only approved tasks, with `HTTP_WRITE_TIMEOUT=75s` or larger for the maximum 65-second operation plus HTTP margin. The default 30-second HTTP deadline must **not** be used with enabled parsing. Recommend `AI_MAX_OUTPUT_TOKENS=4096` for parsing evaluation parity, max concurrency 1 initially; 1024 default tokens do not reproduce longer evaluated CV outputs. These proposed values have not been applied.
6. Register/evaluate/promote an approved model through existing governance with two independent reviewers distinct from the requester. The model config must contain `approved_tasks`, exact model routes and a reviewed `beta_rollout` object. Missing or malformed policy denies beta access. A candidate model is not a production-environment deployment; registry `production` means the approved runtime version inside this beta database.

   ```json
   {
     "approved_tasks": ["job.generate_description"],
     "model_routes": {"job.generate_description": "gpt-6-luna"},
     "beta_rollout": {"stage": "internal", "actor_ids": ["<approved-actor-uuid>"]}
   }
   ```

   Replace the illustrative UUID before governance submission. No record is promoted by this document.
7. In Command Centre → Intelligence, approve the required switches: `ai_gateway`, `openai_provider`, the individual task switch, `global_intelligence`, and the existing `cv_intelligence` or `job_intelligence` capability. Enabling still requires an approved governance request. Command Centre users monitor/configure; candidate/recruiter actors exercise features under their own role and tenant.
8. An approved operator can recreate **only the beta backend at the same immutable image** to load reviewed environment changes. Do not run Stage B, Caddy reload/restart, production deploy or DNS changes. Confirm database `sapienworx_beta` before any administrative query.

## Stages and exit conditions

| Stage | Reviewed model configuration | Exit gate |
| --- | --- | --- |
| 0 internal | `stage: internal`, explicit `actor_ids` | Synthetic owned data; consent; review/publish checks; budget; resource measurements; immediate kill verified |
| 1 selected tenants | `stage: tenants`, explicit `tenant_ids` and candidate `actor_ids` | Tenant isolation, correction review and no matching changes without explicit acceptance |
| 2 small cohort | `stage: percentage`, integer 1–10 | Stable company bucket (candidate personal bucket), controlled spend/latency, no unacceptable errors |
| 3 all beta | `stage: all_beta`, `percentage: 100` | Separate approval, sustained capacity evidence and completed parser UI gates |

Re-register/evaluate/promote reviewed policy changes through existing governance; do not edit active registry rows with ad hoc SQL. Production remains OFF. Models, task switches, environment flags, consent and role/tenant checks must all agree.

## Immediate disable, no deployment

Command Centre → Intelligence → **Disable** `ai_gateway` (all external AI), `openai_provider` (OpenAI), or one of `cv_ai_parse`, `job_ai_parse`, `jd_ai_generation`. Existing audited endpoint:

```http
PATCH /api/v1/admin/intelligence/switches/openai_provider
Content-Type: application/json

{"enabled":false}
```

Use an authenticated, MFA-verified administrator with the existing kill-switch permission and normal CSRF handling. Do not paste a session token into a shell, report or Git. The UI records `intelligence.switch.changed` in the existing audit pipeline. Confirm the switch reads false and a synthetic new request is denied before provider transport. Already admitted/in-flight provider work may finish within the bounded operation deadline; a switch does not cancel an HTTP request already sent. Manual profile/job workflows stay available.

For persistent environment disable, set `AI_ENABLED=false`, `OPENAI_ENABLED=false` and task flags false in the private controls file, then recreate only the backend at its current image in an approved operator session. This is an operational config change, not a new application deployment. Never print `docker compose config` or container environment values.

## Code rollback

First disable AI through the audited switch. Dispatch Beta Stage A rollback with `action=rollback`, `release_sha=<previous-known-good-main-SHA>`, `confirm_beta=BETA`. Keep the current additive schema; the rollback path skips reverse migrations. Migrations 68–71 were rehearsed down/up only on disposable data; their down scripts remove AI artifacts and are **not** a data-preserving live rollback. No database restoration is needed just to disable AI.

## Watch during a separately approved canary

Observe the Command Centre OpenAI panel: provider health, switches, requests/retries, timeouts, token/cost totals, p50/p95, daily/monthly available budget, review/correction and schema/domain failure signals. Review rates cover retained 24-hour proposals, not accuracy. Cache avoidance is separate from provider calls. Compare EC2 memory/CPU/disk and RDS free memory/connections/CPU against the recorded preflight. Stop if memory/latency degrades, accounting or isolation fails, review can be bypassed, or spend approaches the approved cap. No automatic budget increase or infrastructure resize.

Privacy: AES-GCM owner/tenant-scoped proposals expire after 24 hours, purged every 10 minutes; erasure and FK cleanup remove owned artifacts. Anonymous usage retention is 90 days. `store=false` on provider requests does not certify provider-side zero retention or data residency; verify project policy and notices before real personal data.
