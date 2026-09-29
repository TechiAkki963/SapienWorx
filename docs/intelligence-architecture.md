# SapienWorx Intelligence Architecture

Branch: `MasterAdmin`  
Status: review-only; not approved for production activation.

## Boundary

- Master Admin is the **control plane**.
- `sapienworx-intelligence` is the **processing / learning plane**.
- Candidate and recruiter browsers never call the Intelligence Engine directly.
- The core SapienWorx API remains the authorization boundary.
- External generative providers remain disabled until a governed provider adapter is configured and approved.

## Event flow

Core database transactions create intelligence events in `intelligence.events` through transactional database triggers for:
- candidate profile creation/update/CV upload
- job creation/update
- application creation/stage transition
- job save/unsave feedback

The standalone Intelligence Engine claims events using `FOR UPDATE SKIP LOCKED`, retries failures with bounded exponential backoff, and records heartbeats.

## Knowledge and candidate intelligence

`intelligence.skills`, `skill_aliases` and `skill_relations` provide the first recruitment knowledge layer.

Candidate features are stored separately from verified core profile data. The engine does not overwrite candidate verified profile fields. Candidate feature records include normalized skills, experience/education/certification/project arrays, seniority, domains, location/availability fields, source event and confidence.

## Matching

Matching is deterministic and decomposed into components:
- skills
- experience
- location
- availability
- role relevance

The production matching version is loaded from the model registry. Match results persist:
- eligibility
- total score
- component scores
- evidence-based explanation
- model version

User-facing recommendations remain behind the `automated_recommendations` kill switch. The existing core matcher remains the fallback while that switch is disabled.

## Learning

Learning collection stores outcome labels separately from production ranking behavior. Signals include application creation/stage changes and candidate save/unsave activity.

Feedback never immediately mutates a production model.

## Evaluation and deployment

Candidate matching versions are evaluated against observed labeled candidate/job outcomes. Evaluation records include the dataset reference, metrics and a quality-gate status.

A model can be promoted only when:
1. the `model_deployment` governance switch has itself been explicitly enabled;
2. an evaluation for that model has passed;
3. a separate admin approval request is in `approved` state;
4. the approval action is `intelligence.model.promote`;
5. the approval target is the exact model version.

Promotion retires the previous production version for the same engine type and records an intelligence audit event.

## AI Gateway

`internal/intelligence/gateway` is the provider boundary. It handles:
- governance switch check
- redaction
- request metadata logging
- latency/cost/redaction telemetry

The gateway intentionally returns provider-unavailable until a provider adapter has explicit secret-manager configuration, privacy/legal approval and test coverage. This prevents services from bypassing the gateway with direct provider calls.

## Prompt and model registries

The Intelligence Centre exposes:
- model versions
- model status
- candidate evaluation
- controlled promotion
- prompt keys and prompt versions
- prompt/model associations

Only the approved active prompt version should be consumed by future provider adapters.

## Kill switches

Current switches:
- global_intelligence
- candidate_intelligence
- cv_intelligence
- matching
- learning_collection
- automated_recommendations
- ai_gateway
- model_deployment

All production capability switches default to OFF at migration time. Disabling does not require approval. Re-enabling governed capabilities requires an approved request bound to the exact switch. Paused candidate/CV events are deferred rather than marked processed, and matching re-enable queues recomputation from stored features.

## Master Admin permissions

Privileges are split across:
- intelligence.read
- intelligence.metrics.read
- intelligence.feedback.read
- intelligence.feedback.review
- intelligence.models.read
- intelligence.models.evaluate
- intelligence.models.approve
- intelligence.config.update
- intelligence.kill_switch
- intelligence.audit.read

Write operations additionally inherit the existing recent MFA/re-authentication requirement.

## Production activation gates

Do not enable production Intelligence until all of the following are independently reviewed:
- migration 000038 approved
- standalone Intelligence image published to its own ECR repository
- separate `sapienworx_intelligence` production DB credential stored as `INTELLIGENCE_DATABASE_URL`; the runtime refuses production start without it
- production DB grants verified for least-privilege Intelligence/public-table access
- engine heartbeat visible
- event backlog drains without failures
- candidate/job feature backfill reviewed
- matching results evaluated
- fairness evaluation methodology approved before protected/cohort analysis
- AI Gateway remains disabled unless a provider contract is separately approved
- kill switches tested
- model promotion dual approval tested
- rollback tested
- full E2E and deployment CI green
