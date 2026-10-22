> Historical local report/plan: its original release status and test counts describe the dated work below. For the reconciled source scope, forward migration numbers and activation boundaries, see [the 22 October release note](UI_UX_BETA_RECONCILIATION_20261022.md).

# Live beta AI internal activation plan — approval pending

21 October 2026. Deployed release `711efb1160515f95d28827e8e153ecb595c50bc2` is healthy, but its AI foundation is disabled. No OpenAI request has been admitted. This plan is not authorization to activate.

## First approval: artifact key created; owner OpenAI key pending

The initial audit found both exact parameters missing. Existing beta runtime IAM simulation permits the beta paths and KMS/SSM context; no IAM expansion is proposed. Actual runtime secret decryption has not been performed.

**Subsequent authorized result:** the user approved artifact-key creation only and will provision the OpenAI key. The helper's three local scope/no-overwrite/account tests passed. `/sapienworx/beta/AI_ARTIFACT_ENCRYPTION_KEY` was then created as SecureString version 1 with `alias/aws/ssm`, without exposing or retrieving its value. Fresh metadata confirms it exists; the OpenAI parameter remains missing. No runtime loader, model, budget or switch was changed.

1. The owner/accounts team creates a **dedicated restricted beta OpenAI project key**, separate from the local testing key and production. Do not send it in chat, Git, a command argument or a log. Do not reuse `.env` or recover any existing key from files/logs.
2. The owner enters that new key directly in AWS Console → Systems Manager → Parameter Store → Create parameter, region `ap-south-1`, account `327301848391`: name `/sapienworx/beta/OPENAI_API_KEY`, type **SecureString**, KMS alias `alias/aws/ssm`. Do not overwrite an existing value. This manual secure-entry process avoids command-history/process-argument disclosure.
3. Separately approve creating `/sapienworx/beta/AI_ARTIFACT_ENCRYPTION_KEY` as a **SecureString** with a fresh independent base64 AES-256 key and the same KMS alias, overwrite forbidden. The prepared helper generates 32 random bytes in process memory and submits them through the AWS SDK. It never handles an OpenAI key, retrieves an existing secret, prints values, or changes any runtime/model/switch.

Review-only command (stdlib, no network or write):

```powershell
python tmp/live-beta-ai-repair/provision_artifact_key.py
```

Exact command proposed **only after explicit artifact-key approval**, with the AWS SDK available:

```powershell
python tmp/live-beta-ai-repair/provision_artifact_key.py --apply-artifact-only --confirm sapienworx-beta
```

Alternatively the owner may provision both SecureStrings manually. The artifact key must be independent cryptographic randomness, not an OpenAI key or password. Fresh verification afterward reads metadata only; any later runtime loading uses the prepared private backend-only loader after its own activation approval.

**This first approval excludes model promotion, switch enablement, runtime activation, paid provider calls and deployment.** The request's section 10 explicitly requires “STOP BEFORE CREATING IT.”

## Subsequent Stage 0 proposal — not yet approved

Start with JD generation only. Proposed actor: synthetic recruiter `20000000-0000-4000-8000-000000000001`, verified company `10000000-0000-4000-8000-000000000001`. Candidate parsing and job parsing remain OFF until their browser integrations and safety prerequisites pass.

Proposed runtime model config:

```json
{
  "evaluation_baseline": "jd-generation-v1.1",
  "approved_tasks": ["job.generate_description"],
  "model_routes": {"job.generate_description": "gpt-6-luna"},
  "beta_rollout": {
    "stage": "internal",
    "actor_ids": ["20000000-0000-4000-8000-000000000001"]
  }
}
```

Use existing governance, preserve the V1.1 baseline, and retain two reviewers distinct from requester: existing beta Master Admin requester; `admin_2@example.test` (`90000000-0000-4000-8000-000000000002`) and `admin_3@example.test` (`90000000-0000-4000-8000-000000000003`) as reviewers. Do not directly update the registry status or fabricate an evaluation PASS. The deployed evaluation worker processes matching models only. The local repair adds a pinned, audited historical baseline evaluation for this exact JD-only configuration; promotion rejects a different dataset, evidence digest or configuration digest. It does not run a new provider evaluation or replace independent human acceptance.

Proposed runtime settings after separate approval: HTTP write timeout ≥75s, output cap 4096, concurrency 1; daily warning/hard $0.20/$0.25, monthly $4/$5, tenant day/month $0.10/$1; conservative rates from the reviewed readiness package. Only JD-generation runtime flag and its required DB switches may be enabled; unrelated matching, learning, embeddings, recommendations and parser switches remain OFF. Model deployment switch is needed only for governed promotion and must be separately included in that approval.

After separately approved activation, perform the exact approved synthetic browser canary and kill-switch verification. No broad cohort or production enablement is implied. The CV scanner is absent; no CV provider activation or scan bypass is proposed.

## Exact proposed Stage 0 operation — approval required; not executed

Prerequisites: owner provisions the new restricted beta OpenAI SecureString; fresh existence/type checks pass; local repair is reviewed, merged through CI and delivered with AI still OFF. This document grants no push, merge or deployment approval by itself. No application image or runtime configuration has changed during this repair task.

1. In a private operator session, run the existing two-parameter stdin loader described in `ai-beta-activation-runbook.md`. It exclusively creates `/opt/sapienworx-beta/runtime/ai.env` mode 0600 and refuses overwrite. No secret goes into a command argument or output. Confirm the database is `sapienworx_beta` before every administrative session.
2. Register one candidate model using authenticated/MFA-protected `POST /api/v1/admin/intelligence/models` with `engine_type=ai_gateway`, `version=beta-jd-generator-v11-internal-1`, `provider=openai`, `model_ref=gpt-6-luna`, and the exact JSON above. Record the server-generated model ID.
3. Request `POST /api/v1/admin/intelligence/models/{modelID}/evaluate`. Check the returned model remains evaluation-approved, not active. Verify the bundled V1.1 evidence and exact policy SHA are recorded. No caller-supplied quality metrics or direct SQL updates are permitted.
4. For each switch below, create an existing control-plane request: action `intelligence.switch.enable`, target type `intelligence_switch`, approval reference `switch:<key>`, required approvals 2. The requester cannot review; the two named reviewers each approve once. Enable `model_deployment` only to perform the governed promotion, then disable it again. Required persistent task switches are exactly `global_intelligence`, `ai_gateway`, `openai_provider`, `job_intelligence`, `jd_ai_generation`. Other switches remain OFF. A global-intelligence enable can release pending internal events; verify unrelated engine switches are OFF before enabling it.
5. Create a distinct promotion request: action `intelligence.model.promote`, target type `intelligence_model`, target ID the registered model ID, required approvals 2, reason naming this Stage 0 JD-only cohort and preserved baseline. Obtain the same two distinct reviewers through normal `POST /api/v1/admin/control-plane/approvals/{approvalID}/decisions`. Promote with `POST /api/v1/admin/intelligence/models/{modelID}/promote` and that approved request ID. Registry status `production` means the active version **inside beta**, not a production-environment release.
6. After explicit runtime approval, atomically replace only the private beta controls file with the following reviewed metadata, mode 0600. Preserve any unrelated existing runtime values. No key belongs in this file or report.

```dotenv
AI_ENABLED=true
OPENAI_ENABLED=true
AI_JD_GENERATOR_ENABLED=true
AI_JOB_PARSER_ENABLED=false
AI_CV_PARSER_ENABLED=false
AI_PROMPT_SEARCH_ENABLED=false
AI_MATCH_EXPLANATION_ENABLED=false
OPENAI_DEFAULT_MODEL=gpt-6-luna
OPENAI_GENERATION_MODEL=gpt-6-luna
HTTP_WRITE_TIMEOUT=75s
AI_MAX_OUTPUT_TOKENS=4096
AI_MAX_CONCURRENT_REQUESTS=1
AI_MAX_RETRIES=0
AI_JD_GENERATE_TIMEOUT_SECONDS=60
AI_DAILY_BUDGET_USD=0.25
AI_MONTHLY_BUDGET_USD=5
AI_TENANT_DAILY_BUDGET_USD=0.10
AI_TENANT_MONTHLY_BUDGET_USD=1
AI_BUDGET_ALERT_FRACTION=0.8
AI_GLOBAL_REQUESTS_PER_MINUTE=2
AI_FEATURE_REQUESTS_PER_MINUTE=2
AI_TENANT_REQUESTS_PER_MINUTE=2
AI_USER_REQUESTS_PER_MINUTE=1
AI_GLOBAL_DAILY_REQUEST_LIMIT=5
AI_USER_DAILY_REQUEST_LIMIT=3
```

Daily/monthly warning thresholds are $0.20/$4.00. Rates above are deliberately bounded Stage 0 proposals, not previously applied values. Keep the reviewed versioned pricing catalog; unknown pricing or failed durable reservation must deny a paid request. The one-call canary also requires an explicit **$0.01 maximum** and zero retries; if worst-case pricing exceeds that bound, stop before dispatch. Do not increase limits automatically.

7. Recreate only `backend` at its deployed immutable beta image using existing `compose.beta.yml` and private operator env files. Do not recreate the edge, restart/reload Caddy, dispatch Stage B or change infrastructure. Check the backend is healthy, effective config matches, database TLS/isolation pass, and only the approved actor has JD-generation availability. Configuration presence is not proof of provider success.
8. Only after explicit paid-call approval, sign in as the approved synthetic recruiter and generate **exactly one** Java Backend Developer / Bengaluru / 3–5 years draft through the genuine beta UI. Confirm consent, private proposal, manual edit and review. Keep it an unpublished draft; do not alter matching requirements without an explicit accepted field. Record safe request ID, model/version, tokens, actual/estimated-or-unknown cost and latency; never prompt/response text, cookies or keys in operational logs.
9. Use the audited task and provider disable endpoints to verify new requests are denied and manual writing remains usable. Restore only the approved internal state. Existing in-flight work may finish; do not make an extra paid call to prove a negative. Proving that a *different* allowed AI task still runs is blocked in a JD-only stage and must not be claimed. JD/CV parser calls require their own later approval, model evaluation routes and safety prerequisites.

Rollback: disable `jd_ai_generation` and/or `openai_provider` immediately through existing audited controls. Restore master/task environment flags false and recreate only the beta backend if persistent runtime disable is needed. Do not reverse data migrations or overwrite either SecureString. No activation step above has been executed.
