# SapienWorx JD Generator V1.1 — Real Provider Quality Report

20 October 2026 · Asia/Calcutta  
Unchanged HEAD: `b00fab7ee80f7eb4791d64e2e85e95657643129e`

**BETA JD GENERATOR CANDIDATE**

Eight synthetic cases completed under the approved cap. All eight pass the frozen contract/concept checks and rubric-based Codex review. This is an evaluation result for a review-required drafting feature, not independent human recruiter certification or production readiness. Global AI/OpenAI remain disabled; no jobs were created or published and no commit, push, merge or deployment occurred.

## A. EXECUTION

| Measure | Result |
|---|---|
| Logical cases | 8 — original V1 titles/cities/experience ranges |
| Provider attempts / retries / failures | 8 / 0 / 0 |
| Model / tier | Exact gpt-6-luna / default (Standard); no fallback |
| Prompt / schema / blueprint | jd-p2 / jd-generation-v1.1 / rb-1.1 |
| Internal task / public request | v1.2 / v1.1 |
| OPENAI_ENABLED / AI_ENABLED | false / false; explicit process-local evaluation override only |
| Attempt timeout | 30 seconds, unchanged hardened policy |
| Frozen files | 1633 unchanged; no prompt, blueprint, schema or evaluator edits during evaluation |

The existing restricted testing credential was loaded only by the backend evaluator. No key, credential fragment or private company/customer data was printed or sent as content. The existing gateway, SQL admission/reservations, provider adapter, schema validation and telemetry were used. A one-shot marker and exclusive journal prevent repeating this execution. No paid request was made after the eighth case.

## B. COST

| Measure | Result |
|---|---|
| Input tokens | 22308 |
| Cached input tokens | 0 |
| Cache-write input tokens (subset of input) | 22284 |
| Output / total tokens | 2470 / 24778 |
| Actual estimated cost | $0.0040229 |
| Hard cap / remaining estimated | $0.03 / $0.0259771 |
| SQL-accounted spend / reservations | $0.004028 / $0 |
| Remaining SQL-accounted allowance | $0.025972 |
| Frozen preflight expected / conservative | $0.0034638 / $0.020025 |

Costs are estimates from observed usage, not an account invoice. Cache-write tokens are already included in input/total counts and use their catalog rate; this explains why actual cost exceeds the base-input expected estimate. SQL rounds each charge upward to micro-USD. Every reservation recorded current spend plus conservative next-attempt cost within $0.03; no cap increase or automatic retry occurred. The unchanged versioned catalog was reverified against [official OpenAI pricing](https://developers.openai.com/api/docs/pricing).

| Case | Input | Cached | Writes | Output | Total | Cost USD | Latency ms |
|---|---|---|---|---|---|---|---|
| jd-01 | 2850 | 0 | 2847 | 276 | 3126 | 0.000494175 | 5228 |
| jd-02 | 2744 | 0 | 2741 | 284 | 3028 | 0.000484925 | 3903 |
| jd-03 | 2807 | 0 | 2804 | 414 | 3221 | 0.000557800 | 4764 |
| jd-04 | 2787 | 0 | 2784 | 294 | 3081 | 0.000495300 | 4977 |
| jd-05 | 2777 | 0 | 2774 | 306 | 3083 | 0.000500050 | 4809 |
| jd-06 | 2781 | 0 | 2778 | 318 | 3099 | 0.000506550 | 5372 |
| jd-07 | 2809 | 0 | 2806 | 300 | 3109 | 0.000501050 | 4181 |
| jd-08 | 2753 | 0 | 2750 | 278 | 3031 | 0.000483050 | 3725 |

Provider request IDs were safely recorded for all eight attempts in the baseline JSON; operational telemetry contains metadata rather than keys/full prompts.

## C. LATENCY

**p50: 4.7865s · p95: 5.372s · maximum: 5.372s.** Gateway wall-clock per case includes admission/validation; individual attempt metadata is retained. p50 is the median; p95 uses nearest rank, which equals maximum with eight observations. No attempt reached the 30-second timeout.

## D. ROLE BLUEPRINTS

Each actual SQL-loaded blueprint is active, approved, role-specific `rb-1.1`, source `product_authorised_occupation_guidance`, `employer_policy=false`. Taxonomy is occupation guidance, not employer requirements. All eight have six duties, five core recommendations, two optional recommendations and no exact qualification requirement. The baseline stores every source ID/reference and full projection.

### jd-01 — Java Backend Developer

Family: **Software Development** · Functional area: **Engineering** · Industry context: **Technology**.

- Design and implement Java backend services around clear business and data requirements.

- Build and document REST API endpoints with input validation and controlled failure responses.

- Work with relational data models and SQL queries to support service operations.

- Write automated tests and review code changes to keep backend services maintainable.

- Investigate service defects using logs, reproduce issues and implement verified fixes.

- Coordinate API and data changes with engineering colleagues and document technical decisions.

Core: Automated Testing, Git, Java, REST APIs, SQL.

Optional: Container Fundamentals, Spring Boot.

Tools: Git. Competencies: Code Review, Debugging. Qualifications: none supplied/supported as exact requirements.

Quality review: All six duties address Java services, REST validation, relational data, testing, debugging and engineering coordination. Five core themes are useful; Spring Boot and containers remain optional. No cloud/employer stack claim.

Recruiter follow-up: Confirm actual framework/tool use and employer priorities; accept only relevant structured skills.

### jd-02 — Registered Nurse

Family: **Nursing** · Functional area: **Clinical Care** · Industry context: **Healthcare**.

- Assess assigned patients and record observations so changes in care needs are visible.

- Carry out agreed nursing care activities within the role's clinical scope and patient care plan.

- Support prescribed medication administration using verified clinical procedures and accurate records.

- Maintain clear clinical documentation and communicate relevant changes to the care team.

- Apply infection prevention practices when preparing equipment and supporting patient care.

- Prepare structured patient handovers and explain care information respectfully to patients and carers.

Core: Clinical Documentation, Infection Prevention, Medication Administration, Patient Assessment, Patient Handover.

Optional: Emergency Response, Wound Care.

Tools: None. Competencies: Patient Communication. Qualifications: none supplied/supported as exact requirements.

Quality review: Six differentiated nursing duties cover assessment, care within scope, prescribed medication procedures, records, infection prevention and handover. No registration, degree or jurisdiction is asserted.

Recruiter follow-up: Hiring team must confirm nursing registration/jurisdiction and permitted clinical scope before publication.

### jd-03 — Relationship Manager

Family: **Client Relationship Management** · Functional area: **Sales and Service** · Industry context: **Banking and Financial Services**.

- Build and maintain client relationships through clear communication and planned follow-up.

- Understand client needs and document relevant information before discussing suitable service options.

- Coordinate responses to client queries with service and operational colleagues.

- Maintain accurate relationship records and track agreed client actions to completion.

- Review account activity to identify service gaps and prepare practical account plans.

- Prepare relationship updates and communicate client feedback to the appropriate teams.

Core: Account Planning, Client Communication, Needs Assessment, Record Keeping, Relationship Management.

Optional: CRM Systems, Negotiation.

Tools: CRM Systems. Competencies: Service Coordination. Qualifications: none supplied/supported as exact requirements.

Quality review: Client needs, relationship records, query follow-up, account planning and feedback are relevant to a relationship role. No financial product, quota or regulatory credential is fabricated.

Recruiter follow-up: Specify actual industry/services, client segment and employer outcomes after normal recruiter review.

### jd-04 — CNC Machine Operator

Family: **Manufacturing Operations** · Functional area: **Production** · Industry context: **Manufacturing**.

- Read production drawings and identify dimensions, tolerances and machining instructions.

- Prepare machine setups, tooling and workholding arrangements for the assigned production work.

- Operate CNC equipment and monitor the machining process for changes or visible defects.

- Measure finished components and record inspection results against the supplied specifications.

- Report machine faults and coordinate corrective action before affected work continues.

- Maintain orderly work areas and record production progress, tool changes and handover information.

Core: Blueprint Interpretation, CNC Operation, Dimensional Measurement, Machine Setup, Quality Inspection.

Optional: CNC Programming Fundamentals, Tool Maintenance.

Tools: Precision Measuring Tools. Competencies: Production Record Keeping. Qualifications: none supplied/supported as exact requirements.

Quality review: Drawings/tolerances, setup/tooling, CNC monitoring, dimensional inspection, fault reporting and handover are concrete manufacturing duties. No brand, shift or exact certification is assumed.

Recruiter follow-up: Confirm actual machines, control systems, materials and work scope with the hiring team.

### jd-05 — Warehouse Supervisor

Family: **Warehouse Operations** · Functional area: **Supply Chain** · Industry context: **Logistics**.

- Coordinate incoming goods checks and record discrepancies for receiving follow-up.

- Organise storage and replenishment work so goods remain identifiable and accessible.

- Plan picking, packing and dispatch priorities with the warehouse team.

- Review stock counts and investigate inventory differences using warehouse records.

- Brief colleagues on assigned warehouse work and monitor progress against agreed priorities.

- Maintain clear handovers and report damaged goods, equipment issues and workflow delays.

Core: Dispatch Coordination, Inventory Control, Stock Reconciliation, Team Coordination, Warehouse Operations.

Optional: Material Handling Awareness, Warehouse Management Systems.

Tools: Warehouse Management Systems. Competencies: Operational Handover. Qualifications: none supplied/supported as exact requirements.

Quality review: Receiving discrepancies, storage/replenishment, picking/dispatch, inventory reconciliation, priorities and handover form a credible warehouse-supervision draft.

Recruiter follow-up: Confirm site scale, equipment and operational expectations. Do not turn optional material-handling awareness into a licence requirement.

### jd-06 — Primary School Teacher

Family: **Primary Education** · Functional area: **Teaching** · Industry context: **Education**.

- Plan primary-school lessons around the agreed curriculum and pupils' learning needs.

- Prepare learning activities and resources that make lesson objectives understandable.

- Teach and adapt classroom activities to support pupils with different learning needs.

- Assess pupil work and use observations to plan the next learning steps.

- Maintain a supportive classroom environment and communicate expectations clearly.

- Record pupil progress and share relevant learning updates with colleagues and carers.

Core: Classroom Management, Inclusive Teaching, Learning Communication, Lesson Planning, Pupil Assessment.

Optional: Curriculum Adaptation, Digital Learning Tools.

Tools: Digital Learning Tools. Competencies: Learning Resource Preparation. Qualifications: none supplied/supported as exact requirements.

Quality review: Lesson planning, learning resources, differentiated teaching, assessment, supportive classroom practice and progress communication are specific to primary education.

Recruiter follow-up: Confirm curriculum, year group and applicable teaching credentials; none are invented by the draft.

### jd-07 — Hotel Operations Manager

Family: **Hospitality Operations** · Functional area: **Hotel Management** · Industry context: **Hospitality**.

- Coordinate daily hotel operating priorities with the relevant department leads.

- Review guest feedback and organise follow-up on service issues and unresolved requests.

- Support coordination between front office, housekeeping and maintenance activities.

- Review operational records to identify service delays and practical improvements.

- Brief department colleagues on agreed actions and track progress through clear handovers.

- Maintain operational reports and communicate resource or maintenance concerns to the appropriate teams.

Core: Department Coordination, Guest Services, Hotel Operations, Operational Reporting, Service Recovery.

Optional: Property Management Systems, Service Quality Review.

Tools: Property Management Systems. Competencies: Operational Handover. Qualifications: none supplied/supported as exact requirements.

Quality review: Guest follow-up, departmental priorities, front-office/housekeeping coordination, operational records, handovers and reports are useful hospitality content.

Recruiter follow-up: Confirm actual property/department scope and priorities; no star rating, brand, benefits or rota is implied.

### jd-08 — Industrial Electrician

Family: **Electrical Maintenance** · Functional area: **Technical Operations** · Industry context: **Industrial Services**.

- Read electrical drawings to understand equipment connections and the planned work scope.

- Inspect electrical equipment and record visible defects or abnormal operating conditions.

- Coordinate safe isolation with authorised colleagues before inspecting or working on circuits.

- Use suitable electrical test methods to investigate faults and document findings.

- Install or replace assigned electrical components and verify the completed work.

- Maintain service records and communicate unresolved faults and maintenance needs at handover.

Core: Electrical Drawings, Electrical Maintenance, Electrical Testing, Fault Diagnosis, Isolation Awareness.

Optional: Industrial Automation Awareness, PLC Fundamentals.

Tools: Electrical Test Instruments. Competencies: Maintenance Documentation. Qualifications: none supplied/supported as exact requirements.

Quality review: Electrical drawings, inspection, authorised isolation coordination, testing, component work and maintenance records are concrete industrial electrical themes. The V1 article error is absent.

Recruiter follow-up: Confirm local authorisation and permitted voltage/work scope; do not infer a specific licence from occupation guidance.

The rendered job body uses sourced occupation guidance and exact recruiter title/location/range. Every item retains its source class in the structured draft. All eight include a predefined employer-review note selected by the model and tagged `ai_suggested`; no novel optional AI skill compounds were emitted in this run. Duties/skills were selected from the blueprint and rendered server-side. This demonstrates grounded composition, not unrestricted AI authorship or creativity.

## E. CASE RESULTS

Scores use the same nine V1 dimensions and the frozen 0–5 definitions in [the hardening report](ai-jd-generator-v1.1-hardening-report.md#human-quality-rubric). Four means usable after normal recruiter review/editing. This is qualitative agent assessment, as in V1; no independent human panel or extra provider judge was used. G=groundedness, R=role relevance, C=clarity, P=professional quality, S=structure, Co=conciseness, U=recruiter usefulness, N=non-discrimination, E=editability.

| Case | G | R | C | P | S | Co | U | N | E | Unsupported additions | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| jd-01 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 0 observed | PASS |
| jd-02 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 0 observed | PASS |
| jd-03 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 0 observed | PASS |
| jd-04 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 0 observed | PASS |
| jd-05 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 0 observed | PASS |
| jd-06 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 0 observed | PASS |
| jd-07 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 0 observed | PASS |
| jd-08 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 0 observed | PASS |

**Usable: 8/8**. Average groundedness **5.0**, role relevance **4.0**, recruiter usefulness **4.0**, clarity **4.0**. No material contradictions, employer-fact hallucinations or discriminatory additions observed. Each case passes all frozen automated checks, with six non-repeated substantive duties and five core themes. Professional quality/structure/conciseness score 4 because employer prioritisation and review labels still need normal recruiter editing; scores do not imply zero human work.

## F. V1 → V1.1 IMPROVEMENT

| Case / role | Mean score V1→V1.1 | Delta | Responsibilities | Relevance | Usefulness | Grounding | Clarity |
|---|---|---|---|---|---|---|---|
| jd-01 Java Backend Developer | 3.33 → 4.33 | +1.00 | 0 → 6 useful duties | 1 → 4 | 1 → 4 | 5 → 5 | 4 → 4 |
| jd-02 Registered Nurse | 3.33 → 4.33 | +1.00 | 0 → 6 useful duties | 1 → 4 | 1 → 4 | 5 → 5 | 4 → 4 |
| jd-03 Relationship Manager | 3.33 → 4.33 | +1.00 | 0 → 6 useful duties | 1 → 4 | 1 → 4 | 5 → 5 | 4 → 4 |
| jd-04 CNC Machine Operator | 3.33 → 4.33 | +1.00 | 0 → 6 useful duties | 1 → 4 | 1 → 4 | 5 → 5 | 4 → 4 |
| jd-05 Warehouse Supervisor | 3.33 → 4.33 | +1.00 | 0 → 6 useful duties | 1 → 4 | 1 → 4 | 5 → 5 | 4 → 4 |
| jd-06 Primary School Teacher | 3.33 → 4.33 | +1.00 | 0 → 6 useful duties | 1 → 4 | 1 → 4 | 5 → 5 | 4 → 4 |
| jd-07 Hotel Operations Manager | 3.33 → 4.33 | +1.00 | 0 → 6 useful duties | 1 → 4 | 1 → 4 | 5 → 5 | 4 → 4 |
| jd-08 Industrial Electrician | 3.11 → 4.33 | +1.22 | 0 → 6 useful duties | 1 → 4 | 1 → 4 | 5 → 5 | 3 → 4 |

RoleBlueprint + sourced sections materially improved usefulness: V1 contained title/location/experience skeletons with no substantive requirements; V1.1 covers distinct occupational work plus separated core/optional guidance in every case. Per-dimension deltas and both score sets are in the baseline. Grounding/non-discrimination/editability remain 5; structure improves 2→4, professional quality 3→4 (electrician 2→4), and conciseness remains 4.

Trade-off: estimated cost rises $0.0003811 → $0.0040229, about 10.6×, using the same model. Total tokens rise 1991 → 24778; p50 rises 2177.0ms → 4786.5ms and p95/max 3827ms → 5372ms. Richer grounded context and longer useful output have a measurable cost/latency increase, still within the approved cap/timeout. Provider reliability stays 8/8 with zero retries.

## G. HALLUCINATION REVIEW

| Category | Finding |
|---|---|
| Salary / bonus / benefits / insurance | No unsupported additions in any case. |
| Company name / size / culture | No invented employer facts. No company data was supplied. |
| Certifications / education | No degree, exact licence or mandatory certification invented. |
| Work mode / hours / shifts | No invented remote/hybrid policy, hours or shift timing. |
| Regulatory | Nurse/teacher/electrician review notes ask for jurisdiction/scope confirmation; no specific regulatory credential is asserted. |
| Technologies | Java role core/optional tools are blueprint-supported recommendations; no assumed AWS/Kafka/Kubernetes employer stack. |
| Visa / travel / notice / discriminatory restrictions | No unsupported additions observed. |

A role-relevant recommendation is not treated as a confirmed employer requirement. Qualification and regulatory omission is not rewarded by fabricating credentials. These eight cases do not establish safety for all possible role inputs or future blueprint changes.

## H. FACT PRESERVATION

| Case | Title | Location | Experience |
|---|---|---|---|
| jd-01 | PASS — Java Backend Developer | PASS — Bengaluru | PASS — 3–5 years |
| jd-02 | PASS — Registered Nurse | PASS — Mumbai | PASS — 2–4 years |
| jd-03 | PASS — Relationship Manager | PASS — Pune | PASS — 3–6 years |
| jd-04 | PASS — CNC Machine Operator | PASS — Chennai | PASS — 2–5 years |
| jd-05 | PASS — Warehouse Supervisor | PASS — Navi Mumbai | PASS — 4–7 years |
| jd-06 | PASS — Primary School Teacher | PASS — Hyderabad | PASS — 2–5 years |
| jd-07 | PASS — Hotel Operations Manager | PASS — Goa | PASS — 5–8 years |
| jd-08 | PASS — Industrial Electrician | PASS — Ahmedabad | PASS — 3–6 years |

**8/8 exact preservation**. No material contradiction.

## I. SOURCE-OF-TRUTH SAFETY

PASS: authoritative JobProfile input equals returned structured fields for all eight cases. No suggestions were merged automatically; every generated draft remains `requires_review`. The disposable evaluation DB contains 16 private operations (eight offline preflight mocks and eight paid cases), all with V1.1 versions/review-required status, and zero jobs. No paid case was owner-reviewed or published.

Post-run tests exercise actual captured draft replay: edit/accept one core item, remove another, retain an optional skill as prose, edit the description, and save only a private draft. Save payloads contain only the explicitly accepted skill, exclude unaccepted/optional matching requirements and preserve the review gate. Existing generation SQL tests cover persistence, tenant/ownership checks, both publication paths, lifecycle activation and review invalidation after edits. Manual editing/discard and failure fallback remain available without provider requests.

## J. DATABASE SKIPS

The ten historical skips were reviewed by exact test name and source. The earlier blanket “unrelated” description was too broad: two contain job-lifecycle coverage. Relevant paths were run rather than waived.

| Exact historical test | Category / scope | Final beta relevance |
|---|---|---|
| TestCandidateReferralPrivacyAttributionAndAbuse | Referrals — Candidate invitation/consent/attribution and abuse checks; seeded jobs are fixtures, not generated JD writes. | NON-BLOCKING — still skipped |
| TestDiscoveryExactProfessionalSkillsAndLegacyShapes | Candidate discovery — Candidate-profile skill search/legacy-shape semantics; no generated requirement acceptance or JD review writes. | NON-BLOCKING — still skipped |
| TestGovernedWorkspaceEvidenceIsolatedDatabase | Job lifecycle + privacy evidence — Contains SetJobStatus activation/undo/CAS safety. The job_status_compare-and-swap,_undo_and_destructive_reasons subtest was therefore run against isolated PostgreSQL and passed; unrelated privacy evidence children were not rerun. | Relevant job-lifecycle portion PASS; no remaining JD blocker |
| TestRecruiterJobWorkspaceScaleIsolatedDatabase | Job workspace / bulk lifecycle — Contains 10k-job queries and governed bulk pause, so it is lifecycle-relevant. Full isolated test now passes, including performance budgets. | Relevant gate PASS |
| TestOfferGovernanceIsolatedDatabase | Offers — Offer/template approval/publication and offer quotas, not JD generation or job publication. Shared job rows are direct fixtures. | NON-BLOCKING — still skipped |
| TestP26RecruiterProductAreasScaleAndIsolation | Talent/search/product areas — Discovery/pools/search product isolation; no generation review/acceptance or JD publishing path. | NON-BLOCKING — still skipped |
| TestWorkspaceRefinementsIsolationAndReferralConsent | Talent/referrals — Pools, candidate consent, referral rewards and scoped home counts; no generated JD persistence/review. | NON-BLOCKING — still skipped |
| TestAdminSecurityHTTPIsolatedDatabase | Command Centre security — Admin MFA/session/dashboard access; JD generation uses recruiter scope and its separately passed gateway/HTTP/SQL ownership gates. | NON-BLOCKING — still skipped |
| TestCandidateWorkspaceHTTPAuthorizationIsolatedDatabase | Candidate workspace — Candidate-owned workspace HTTP authorization, not recruiter generation/JobProfile writes. | NON-BLOCKING — still skipped |
| TestCompanyHTTPAndInvitationIsolation | Company administration — Company/invitation membership endpoints, not generation/publication. Existing tenant identity is enforced independently in the passed generation/job-security gates. | NON-BLOCKING — still skipped |

No relevant unresolved JD persistence, review-state, suggestion-acceptance or publishing-safety skip remains. Eight unrelated parent gates remain skipped; the non-job privacy/evidence children of the scoped governed-workspace test were not rerun. This is not certification of those unrelated modules.

## K. TESTS

| Status | Result |
|---|---|
| PASS | 80 ordinary Go parent tests: gateway/provider reliability/budget 56; generation 16; blueprint/taxonomy 5; review/source-of-truth 2; generation HTTP boundary 1. |
| PASS | Five isolated DB checks: AI governance; generation persistence/review/publishing; recruiter job security; scoped governed job-status CAS/undo; full 10k-job workspace scale/bulk lifecycle. |
| PASS | 20 affected browser behavior cases plus 8 captured-response replay cases; zero failures/flakes/retries. |
| PASS | Eight-case facts/provenance/goldens, cap/telemetry reconciliation, zero jobs/reservations, frozen-source and V1 preservation audits. |
| FAIL | None in the final executed checks. |
| SKIPPED | Eight unrelated DB gates and remaining unrelated governed-workspace children; no CV suite rerun because no shared application code changed. |
| BLOCKED | No unresolved gate for this controlled beta-candidate classification. Deployment/activation/publication remain outside approval. |

No prompt, model, schema, blueprint, evaluator or application code was patched in response to these results. Prior seven-viewport/Light/Dark/System implementation screenshots remain unchanged; post-run browser scope focuses on affected behavior and the actual eight captured drafts.

Browser execution note: the restricted local launch timed out at 300 seconds before emitting results. Its empty output/logs were preserved. The unchanged offline suites were then run with the permissions required to launch Node/Chromium; no real provider request or application/evaluator patch was involved.

Non-blocking existing UI observation: the builder’s empty Education requirements field uses nursing examples as its placeholder even for other occupations. This is placeholder text, not a generated or saved degree/licence requirement; all eight actual qualification arrays are empty. Record role-neutral placeholder copy as a separate UX follow-up. No UI/application patch was made during this evaluation.

## L. BASELINE

**V1 preserved: YES. V1.1 created: YES.**

V1.1 path: [`docs/benchmarks/jd-generation-baseline-v1.1.json`](benchmarks/jd-generation-baseline-v1.1.json). It records all eight actual drafts, source classes, actual blueprints, model/task/prompt/schema versions, JobProfile contract/version limitation, taxonomy/migration manifest, score sets/deltas, hallucination/fact checks, latency/tokens/cost, provider reliability, skip analysis and post-run tests.

V1 original report/evaluation, byte-identical “JD Generation Baseline V1,” raw results and journal remain unchanged. No V1 record was overwritten. Raw V1.1 results, metadata journal, frozen payloads/binary manifest and rendered replay screenshots remain locally under `tmp/jd-generation-real-v11/`.

## M. READINESS

**BETA JD GENERATOR CANDIDATE**

The approved eight-case quality target is met: 8/8 usable, all four required averages ≥4, zero observed material contradictions/employer-fact/discriminatory additions, and relevant safety checks pass. This is bounded evidence for the eight curated roles, based on agent review. Independent recruiter review remains valuable and every real employer draft still requires human review before publication.

OpenAI remains globally disabled. No additional provider calls, commit, push, merge, deployment, beta activation or production change. STOP.
