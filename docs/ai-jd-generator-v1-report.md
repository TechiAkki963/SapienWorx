# SapienWorx AI Job Description Generator V1 Report

Date: 19 October 2026 (UTC). Working tree: `tmp/intelligence-v2-openai-gateway` on `codex/intelligence-v2-openai-gateway`; HEAD remains `b00fab7ee80f7eb4791d64e2e85e95657643129e`.

**READY FOR CONTROLLED REAL GENERATION TEST.** Local implementation and mocked/integration QA passed. Real provider requests: **0**; provider cost: **$0**. Global OpenAI remains disabled. This is not beta activation or approval to publish a job.

## A. Existing job flow inspected

Inspected the five-step recruiter builder (Basics, Description, Application, Hiring workflow, Publish), existing description textarea/competency control, create/update/read/lifecycle/duplicate APIs, publication validation, database columns/migrations and tenant/job ownership rules. Inspected `DetailedJobInput`, the `job.parse` proposal contract, workforce occupations/relationships, private parsing artifact storage/review, gateway authorization, OpenAI adapter, rate/budget/retry/telemetry, configuration and audit infrastructure.

The current typed job data is `recruiter.DetailedJobInput` persisted to the existing `jobs` table. Required skill strings, experience in years converted to months, location, work mode, employment type and role category keep their existing mappings. Existing publication still requires description, responsibilities, at least one skill and at least three hiring stages, plus valid lifecycle/deadline/capacity checks. Compensation is an explicitly private existing field, so it is excluded from generator input and generated prose.

## B. Architecture implemented

Existing builder fields → versioned Intelligence API → optional exact taxonomy suggestions → governed gateway → strict model editorial plan → deterministic source-grounded JD rendering → private draft → existing editor → explicit recruiter review → existing job save/publish APIs.

Extended the earlier private fact-ordering stub into the same generation path; its legacy Go entry now delegates to the versioned implementation. No competing job persistence model, direct job-service SDK call, browser/provider call or generic prompt endpoint was added. The API DTO is a restricted projection of existing fields.

Important V1 product choice: the model chooses a neutral opening and section ordering, while SapienWorx supplies all factual wording. This produces a short factual draft from minimal input, rather than inventing typical responsibilities. It is intentionally more constrained than a free-form copywriter. Full contract and design: [AI JD Generator V1](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/docs/ai-jd-generator-v1.md).

## C. JobProfile source-of-truth behavior

Generation never invokes `job.parse`, creates a job, publishes, updates structured requirements or parses prose back into matching criteria. **Use this draft** replaces only the description after an explicit recruiter action. Fields remain editable throughout.

Reconciliation uses option B: explicit structured editing, with an on-screen explanation that prose does not automatically alter matching requirements. The test that adds “Kubernetes is mandatory” to prose confirms that Kubernetes does not appear in structured skills. The reviewer must check both prose and requirements, including any deliberate post-generation differences.

Approved taxonomy suggestions remain `suggested_skills`, outside the JD and requirements. Only exact active occupation/approved competency relationships are considered. Accept adds a skill to the existing structured control; Remove dismisses it; editing uses the existing competency editor. No credential requirements are inferred. Lookup failure returns no suggestions rather than blocking manual work.

## D. AI Gateway integration

Task: `job.generate_description`; request `v1`; task implementation `v1.1`; prompt `jd-p1`; schema `jd-generation-v1`. The configured route is restricted to `gpt-6-luna`, with Standard service tier pinned. Provider construction remains in the composition root and SDK types remain in the existing adapter.

Generation requires the existing feature flag, gateway/global/job-intelligence switches, approved task/model registration, active actor/company scope and normal admission controls. No switch/registry entry was activated. OpenAI Structured Outputs constrain the editorial JSON; SapienWorx additionally validates its section permutation and renders fact values itself. [Official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [approved model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna).

The private artifact response includes description, versions, validation, provider/model, usage, latency and estimated-cost/unknown-price metadata. Operational provider request IDs are stripped from the owner response and retained only in operational evidence. No provider-specific failure payload is shown to recruiters.

## E. Inputs supported

Initially required: title, location, integer minimum experience and integer maximum experience. Zero is preserved, and 0–60 with maximum >= minimum is enforced. Unicode locations are supported. Database character limits are respected: title 200, location 120, department 160, role category 120. Total DTO input is bounded to 24 KB; skills to 50; education requirements to 20.

Optional existing fields: employment type, work mode, department, role category, skills, responsibilities, company overview, why join and education requirements. Private salary, assignment and internal notes are excluded. HTTP unknown-field validation rejects salary/notes and client tenant/model/prompt overrides. No large separate AI form was introduced.

## F. JD output structure

Title and About the Role; supplied Responsibilities, Required Skills, Qualifications, About the Company and Why Join where present; Experience; Location / Work Mode; optional supplied Employment Type.

No empty fabricated sections are forced. Missing skills/duties produce clear warnings and still need explicit completion before publishing. There is no typed preferred-skills field in this editor, so an invented Preferred Skills section was not introduced. Unrestricted rewrites and shorter/clearer variants are deferred; controlled regeneration is implemented.

## G. Hallucination prevention

The provider can return only an opening enum and the supplied section IDs. Additional salary, benefits, certification or other free-text output fields are schema-invalid. Duplicate/missing/foreign sections fail domain validation. All displayed facts come from structured recruiter input or fixed neutral wording. Unsupported company claims, technologies, education, policies, visa/travel/shift/notice requirements and employment terms cannot be added through the model plan.

Recruiter text is untrusted data, not executable instructions. No tools, browsing or URL fetching are attached. Output uses text rendering. A small prohibited-phrase filter rejects known discriminatory phrases; it is not claimed as a comprehensive legal/content classifier. Mandatory human review remains part of safety and quality control.

## H. Recruiter review/edit flow

The source form and manual editor remain usable while generation runs. The result appears as a private, scrollable proposal, without overwriting existing text. Recruiters explicitly adopt it, edit in the existing textarea and attest that they reviewed description and structured requirements. The candidate-facing builder preview is locked until review, and edits invalidate approval.

New review evidence is owned by actor/tenant, revision-checked and bound to a SHA-256 fingerprint of current public requirements and description. The job service verifies this evidence through an interface. Migration 69 persists server-owned generation provenance and reviewer/time/version/model metadata on the existing job. Clients cannot provide reviewer timestamps or forge a new-operation receipt.

Unpublished draft saving remains available. Publishing/updating an active job/lifecycle activation reject tracked unreviewed content. Omitting an existing generation ID does not erase provenance. Duplicates preserve AI provenance and require review. Existing saved jobs can be explicitly re-reviewed by an authorized editor after private proposal expiry; reviewer/time are recorded by the server in the existing job audit flow. Pasted external text cannot automatically be identified as AI-generated.

## I. Failure/manual fallback

Disabled/unavailable/slow/timed-out/rate-limited/budget-denied generation never disables manual writing or draft saving. UI errors are controlled and preserve existing text. Review persistence failure keeps preview/publishing locked and preserves the editor. An existing-role test verifies private compensation and notes survive generation and are excluded from generation/review payloads.

Cancel aborts the client fetch and ignores its response, while backend accounting completes in a detached bounded context. An already sent request may remain billable; the UI says so. No automatic page-wide blocking or background regeneration occurs. Ambiguous/failed operations remain idempotent; normal gateway retries are bounded and accounted. Manual entry remains the reliable fallback.

## J. Cost controls

Reuse configurable output ceiling, task timeout, bounded retries, concurrency and global/feature/tenant/user limits, plus durable global/tenant daily/monthly reservation and reconciliation. Pricing stays external to product logic. Unknown pricing fails closed in the production SQL budget path; unreported usage consumes the reserved worst case. Identical input/parent requests reuse the stored operation, and explicit regeneration is limited to three descendants per chain as well as shared limits.

Gateway telemetry records task, provider/model, actor/tenant/request IDs, input/cache/output usage, latency, status and cost-known state. Metadata-only lifecycle events cover requested, completed, failed, regenerated, accepted and edited. Full prompts/JDs and keys are not analytics payloads. Operation results/reviews remain encrypted, with existing 24-hour retention; events retain 90 days with erasure handling; job provenance remains with normal job audit/history.

## K. Security

PASS: backend-only provider boundary, authenticated/CSRF-protected routes, active company/job-management checks, owned review/cache, tenant-scoped job writes, strict DTOs, schema/domain validation, bounded input, diagnostic redaction, secret comparison scan, encryption, erasure and retention checks. Generation cannot activate Intelligence governance or publish.

All **94 protected parser/evaluation/baseline/configuration/private-environment files** retain their pre-task hashes. CV schema, prompts, normalization and baselines are unchanged. No dependency, external integration, Rust implementation, AWS infrastructure, live database or public edge change was added by this task.

## L. Files changed

The following **27 code/contract/fixture/workflow files** describe this task's scope. Some were already uncommitted from the gateway foundation; this is not the entire worktree diff. Pre-existing unrelated changes remain preserved.

- [intelligence-openai-ci.yml](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/.github/workflows/intelligence-openai-ci.yml)
- [main.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/cmd/api/main.go)
- [generate.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/generate.go)
- [job_generation_v1.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/job_generation_v1.go)
- [job_generation_v1_test.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/job_generation_v1_test.go)
- [job_generation_database_test.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/job_generation_database_test.go)
- [service_test.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/service_test.go)
- [store.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/store.go)
- [cases.json](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/testdata/job-generation-v1/cases.json)
- [README.md](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/intelligence/parsing/testdata/job-generation-v1/README.md)
- [intelligence_parsing.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/platform/httpserver/intelligence_parsing.go)
- [intelligence_parsing_test.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/platform/httpserver/intelligence_parsing_test.go)
- [recruiter_handlers.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/platform/httpserver/recruiter_handlers.go)
- [server.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/platform/httpserver/server.go)
- [job_generation.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/recruiter/job_generation.go)
- [job_generation_test.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/recruiter/job_generation_test.go)
- [job_builder.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/recruiter/job_builder.go)
- [job_governance.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/recruiter/job_governance.go)
- [job_lifecycle.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/recruiter/job_lifecycle.go)
- [service.go](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/backend/internal/recruiter/service.go)
- [000069_job_description_generation.up.sql](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/database/migrations/000069_job_description_generation.up.sql)
- [000069_job_description_generation.down.sql](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/database/migrations/000069_job_description_generation.down.sql)
- [jd-generation-assistant.tsx](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/frontend/components/recruiter/jd-generation-assistant.tsx)
- [job-builder.tsx](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/frontend/components/recruiter/job-builder.tsx)
- [recruiter.ts](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/frontend/lib/recruiter.ts)
- [jd-generation.spec.ts](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/frontend/tests/e2e/jd-generation.spec.ts)
- [ai-jd-generator-v1.md](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/docs/ai-jd-generator-v1.md)

New deliverables: this report, [offline validation manifest](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/docs/benchmarks/jd-generator-v1-offline-validation.json) and [unexecuted provider proposal](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/docs/benchmarks/jd-generator-v1-real-provider-proposal.json). Source SHA-256 values are recorded in the validation manifest. Generated screenshots/gallery and test logs remain ignored local QA artifacts. Next's temporary TypeScript configuration changes were restored; both files were clean at task start.

## M. Tests

| Check | Result | Evidence / limits |
|---|---|---|
| Go race suites | PASS | 224 distinct top-level test/fuzz-parent cases across gateway, evaluation, parsing, canonical contract, runner, recruiter and HTTP packages |
| Affected isolated database gates | PASS | 4 additional distinct gates; 228 total top-level cases/gates; disposable PostgreSQL, network-isolated, no beta/RDS |
| Generator goldens | PASS | 14 synthetic industries; source preservation, appropriate headings, no unsupported listed facts |
| Provider boundary | PASS | SDK confined to adapter; no browser calls or generic prompt route |
| Go API build / vet | PASS | Final API binary compiled locally; affected packages vetted |
| Frontend production build | PASS | Next.js optimized build, TypeScript and 41 static pages completed |
| Standalone TypeScript | PASS | Passed again after restoring generated configuration files |
| Browser feature / regressions | PASS | 33 distinct Chromium tests, including 21 viewport/theme cases and 4 existing builder/owned/foreign-editor regressions |
| Secret/protected-input checks | PASS | Exact-key comparison scan emits no key; 94 protected hashes unchanged |
| Real provider writing quality | SKIPPED | Separate explicit approval required; zero provider requests |
| Other browser engines / hosted CI / live load | SKIPPED | No Firefox/Safari, GitHub dispatch or beta load run in this local task |
| Other database gates | SKIPPED | 10 unrelated gates lack their separate fixture DSNs; all 4 affected gates resolved |

Coverage includes minimal/missing/invalid/range/Unicode/length inputs; structured construction; unsupported salary/benefits/certifications; invalid/duplicate editorial plans; unavailable/timeout/429; bounded retry, budget/rate denial; ownership, foreign tenant/review/regeneration; idempotency and regeneration cap; audit; encryption; review revision/content binding; manual fallback; existing private-field preservation; lifecycle activation and duplication; migration down/up; runtime grants and erasure.

The full browser run had 32 passes and one test-only exact-label selector failure. The label includes helper text; correcting that selector and rerunning the case passed. The final 21-case screenshot refresh also passed without unexpected/flaky cases. The first new DB fixture used a direct verified-email change; it was corrected to the existing two-step erasure protocol and passed, including a subsequent final generator gate. No product guard was weakened to make a fixture pass.

The existing unavailable-job regression logged a React script-tag warning while correctly rendering not-found; no generation visual case raised a page error. No provider-quality or independent legal-compliance score is inferred from mocks.

## N. Visual inspection

PASS at 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 428×926 and 360×800, each in Light/Dark/System: **21 combinations, 42 screenshots** of proposal and adopted-editor states. Overflow and page-error assertions pass. System appearance changes Light→Dark and Dark→Light without reload. Keyboard activation, initial step focus, readable text contrast >=4.5:1 in the assistant and >=44px assistant action targets pass.

Representative desktop/tablet/mobile captures were inspected directly. Layout was tightened so the assistant belongs to the existing step, below Basics fields, rather than occupying a separate full-width page region. Capture timing was corrected for the page's smooth scroll before final screenshots. Fixed mobile navigation appears at the viewport edge in full-page captures.

[Browse all screenshots](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/frontend/visual-artifacts/jd-generation-v1/index.html) · [desktop proposal](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/frontend/visual-artifacts/jd-generation-v1/draft-1440x900-light.png) · [mobile dark editor](C:/Users/Admin/Documents/SapienWorx/tmp/intelligence-v2-openai-gateway/frontend/visual-artifacts/jd-generation-v1/editor-360x800-dark.png).

## O. Real-provider validation proposal — NOT EXECUTED

Propose exactly **3 synthetic cases / at most 3 attempts / 0 retries / concurrency 1**: minimal technology role; supplied technology duties/skills; supplied healthcare role. Model `gpt-6-luna`, Standard tier. Expected total input ~3,000 tokens, output ~240; estimated **$0.000420** uncached or **$0.000495** if all input is cache-write charged. These are planning estimates, not measured usage.

Proposed maximum complete input token bound 10,000 per case, maximum output 512 per case, timeout 30 seconds, conservative total worst case **$0.004518**, proposed hard cap **$0.005000**. Budget calculation uses the external catalogue's conservative input/cache-write and output rates. [Official Standard pricing](https://developers.openai.com/api/docs/pricing) was checked on 19 October 2026; the existing catalogue is unchanged. Recheck pricing and enforce reservations/bounds before any eventual request; abort if the cap cannot be guaranteed.

Use only fixed synthetic data and backend-only key storage with a separately approved command-scoped setup. Freeze hashes, retain safe usage/latency/request-ID/cost evidence, manually review all outputs and leave global OpenAI disabled. This proposal does not borrow prior parser-test approval or budgets. No calls, beta data, activation, publication or deployment are authorized by this report.

## P. Readiness

**READY FOR CONTROLLED REAL GENERATION TEST**.

The constrained V1 foundation, recruiter workflow, security controls and local verification are ready. Provider conformance/latency and human assessment of real editorial plans remain unmeasured. The feature does not yet qualify as a live beta generator solely from mocked results.

No commit, push, merge, deployment, global AI activation, beta/production alteration, CV-parser change or Rust migration was performed. Stop after this report.
