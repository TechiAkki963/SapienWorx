# Recruiter governed workspace — pre-deployment audit

Audit date: 13 October 2026, Asia/Calcutta. Repository: `TechiAkki963/SapienWorx`.

## 1. Executive result

**Local implementation and acceptance: PASS. Published CI: pending at this committed checkpoint. Deployment classification: BLOCKED until the exact review head passes applicable CI.**

The recruiter workspace now uses the approved navigation, canonical Candidate Cards, operational job list, centered focused dialogs and governed Offer Studio. Calculations, approval decisions, history, privacy and tenant boundaries are enforced by the backend and PostgreSQL, rather than inferred from UI visibility.

This report covers local source and synthetic acceptance, including actual PostgreSQL isolation tests. It does not represent a live-beta smoke test of this new release, external penetration test, full WCAG certification or production capacity certification. The exact published head, PR and final CI result accompany the release handoff. **No deployment was performed.**

## 2. Changed areas

| Area | Resulting behavior | Main implementation |
|---|---|---|
| Recruiter navigation | Workspace / Recruit Plus+ / Profile; persistent per-user collapse; job context selects Jobs; contextual plan usage; restricted-access explanations; navigation fetches workspaces on demand | `frontend/components/recruiter/recruiter-nav.tsx`, `recruiter-frame.tsx`, `recruiter-shell.tsx` |
| Candidate presentation | One reusable card across Applications, Home, Discover, pools, referrals, interviews, offers and outreach; no candidate table or Application Source; bounded employment/education summaries | `frontend/components/recruiter/candidate-card.tsx` and context adapters |
| Applications | Inline guarded stage actions; company-private notes; authorized CV/contact actions; safe bulk message retries and busy states | `applicant-card-workspace.tsx`, `application-stage-control.tsx`, `bulk-inmail-modal.tsx` |
| Jobs | Selection, title, Job ID, Status, Applications, Views, Posted, actions; real deduplicated views; guarded status changes and Undo; location/department/poster/date filters | `frontend/app/recruiter/jobs/page.tsx`, `job-additional-filters.tsx`, `backend/internal/recruiter/job_workspace.go` |
| Talent | Operational overview from recorded activity; profile-based recommendations identify their source; plan/usage loads on demand | `backend/internal/recruiter/talent_overview.go`, `frontend/components/recruiter/talent-plan.tsx` |
| Focused dialogs | Native modal/inert background; keyboard containment; dirty-close decisions; busy guards; focus restoration including WebKit pointer openers and removed triggers | `frontend/components/recruiter/workspace-ui.tsx` |
| Offer Studio | Versioned templates, typed compensation and formulas, private incomplete drafts, frozen employment facts, configured approvals, separate send, candidate decisions, private PDFs/annexures and immutable audit/history | `backend/internal/recruiter/offer_*.go`, Offer Studio routes/components |
| Company governance | Explicit offer permissions and approval policy; distinct reviewers; review/publication/archive template lifecycle | `frontend/components/company/offer-governance.tsx`, company and offer stores |
| Privacy/data integrity | Submitted-CV provenance, distinct erasure objects, private notes/contact audit, membership rechecks, tenant triggers, append-only evidence and idempotent commands | migrations 65/66; recruiter, messaging and privacy stores |

Obsolete candidate table/card variants and the replaced outreach/interview drawers were removed. Existing candidate/profile APIs and manual meeting URLs remain. No third-party integrations, runtime model services or new AWS resources were added.

## 3. Requirements matrix

The companion [requirements matrix](RECRUITER_GOVERNED_WORKSPACE_MATRIX.md) contains **375 unique specification references** covering the six supplied files. IDs identify specification sections, including repeated older iterations; they are not 375 independent E2E tests. The master prompt's final decisions supersede older candidate-table and Job Health/Deadline layouts.

- **Implemented:** navigation/card/application/job/Talent/modal/offer requirements with source and local evidence.
- **Already compliant:** existing job builder and interview conflict/manual-meeting behavior retained and regression checked.
- **Deferred:** optional activity snapshot, navigation telemetry, pinned-note enhancements, optional KPI strip and future intelligence. Existing recorded operational counts remain; no fabricated analytics or model scores.
- **Blocked:** final published CI and release acceptance classifications at this checkpoint. Local tests for those features have completed; CI is not assumed to pass.

The per-section matrix uses a shared evidence catalog for cross-cutting requirements. The final report below states practical limits rather than treating every section heading as a certification.

Final CI inspection found both browser jobs failing the same candidate-message keyboard assertion while the other 390 tests passed. Three immediate local repeats passed; a separate delayed-JavaScript diagnostic reproduced the failure mechanism: `focus()` on the disabled server-rendered button did not focus it, and Enter before hydration did not open the dialog. Waiting for readiness then using the same keyboard action opened it correctly. The regression now explicitly waits for the button to be enabled and confirms focus before Enter, retaining every dialog, dirty-close, keyboard-containment and focus-return assertion. This is consistent with the CI failure; the original CI trace did not independently establish its timing. Fresh exact-head CI remains the release gate. No runtime UI behavior was changed by this test correction.

## 4. Database migrations

| Migration | Changes | Rehearsal and reversal |
|---|---|---|
| `000065_recruiter_workspace_evidence` | Application submitted-CV snapshot/provenance; contact/stage/interview audit enrichment; opaque deduplicated view records, retention/aggregate indexes; saved-search match observations; explicit outreach-interest evidence | Pristine down/up passed. Populated submitted-CV and view evidence refuse lossy down migration. Historical CVs are labelled with their actual provenance. |
| `000066_governed_offer_versions` | Company offer settings/permissions/policy audit; immutable template and offer versions; exact compensation precision; approval requests; private document/upload records; append-only events and command results; tenant and immutability triggers | Six legacy statuses, compensation, captured identity and letter retained. Legacy-only down/up passed. Governed data/history/precision refuse lossy reversal. |

**Both migrations are unapplied to live beta/production.** Local tests used independently cloned databases on the local fixture. Existing migrations were not rewritten. Any future apply must verify `current_database() = sapienworx_beta` before using the beta migration credential.

## 5. API changes

All APIs remain REST. There is no GraphQL or added external API.

| Contract | Behavior |
|---|---|
| Recruiter offer list/detail/write/commands | Company/job/application authorization; bounded pagination; immutable version/revision checks; exact monetary strings; stable idempotency keys; invalid/stale actions fail in controlled envelopes |
| `/api/v1/recruiter/offer-templates` and template archive | Company-scoped immutable draft/review/published versions; publication distinct from review; history retained |
| `/api/v1/recruiter/offer-settings` | Explicit role/permission checks for reading/updating governance; auditable policy updates |
| Recruiter/candidate offer document endpoints | Reauthorize actor, offer and version before short-lived private document access; no public compensation asset |
| `/api/v1/recruiter/offer-attachments` | Size/type/content validation; existing malware scan fails closed; membership rechecked after slow scan |
| Candidate offer commands | Only the offer's candidate can accept/decline/request clarification; action binds displayed version and acknowledgement |
| Recruiter Talent overview/plan | Bounded recorded summaries; contextual usage; no N+1 plan reads |
| Candidate outreach interest | Explicit candidate-owned interest event; fabricated engagement is not counted |
| Recruiter CV/contact/notes and stage actions | Company/application/consent and privacy scope preserved; actual submitted CV distinguished from later profile CV; company-private notes |
| `DELETE /api/v1/user/account` | Candidate accounts with retained offer records return 202 `awaiting_review`, with an auditable `offer_retention_review` reason. Application locks precede the account lock; an in-flight offer cannot be missed or falsely reported erased. Ordinary candidate erasure and CV deletion orchestration remain available when no retained offer requires review. |
| Recruiter job list/status/public view recording | Added `location`, `department`, `posted_by`, `posted_from`, `posted_to`; strict range/UUID validation; India-time posted boundaries; company scope remains mandatory; status CAS and audited Undo; bot/internal-preview view exclusions |

Offer handlers map invalid data, permissions, not-found and conflicts explicitly. 500-class failures remain errors. This is a targeted API audit and regression suite, not an enumeration claim for every endpoint in the entire repository.

## 6. RBAC changes

Offer view, create, edit, send, approve, compensation visibility and template/policy administration are separate permissions. Company member state, job scope and reviewer identity are checked server-side and inside locked mutations. Requesters cannot approve their own offers. Sequential/parallel/conditional reviewers remain distinct and within the authorized company. Candidate actions cannot mutate recruiter governance or another candidate's offer.

Candidate-card projections exclude private compensation. Users without compensation permission do not gain it through convenience APIs or document routes. Foreign company, job, candidate, template, document and annexure identifiers were exercised against the real PostgreSQL-backed HTTP/store paths.

## 7. Subscription and entitlement changes

New Offer Studio actions require the appropriate offer feature/permission and enforced company usage rules. Historical authorized records remain readable when a subscription lapses; UI locking does not replace server checks. Company Admin has a contextual plan path.

Hiring relationships are treated separately from cold Talent sourcing. An owned applicant does not require a Talent bookmark and does not spend cold-outreach quota. Cold outreach retains consent, Talent entitlement/seat, allocations, cooldown and company anti-spam protections. Concurrent mutations use the same company-first lock order as the campaign worker. No paid plans or prices were changed.

## 8. Security results

**PASS for exercised local application boundaries.** Tests cover unauthorized roles, foreign identifiers, CSRF, revoked membership/consent, payload validation, exact/unsafe formulas, stale revisions, self/duplicate approval, concurrent send/quota transitions, annexure scanning, document access and erasure queues.

Final privacy inspection found that automatic candidate erasure could report completion while immutable offer snapshots retained identity. The existing review gate now explicitly handles candidate offer retention. Real PostgreSQL regression proves review status/reason, request idempotency and preservation of history/profile; a second test holds an in-flight offer application and verifies application-before-account lock order, correct eventual review outcome and preserved captured identity. The complete 24 isolated suites, Go unit/vet and Linux race suite were rerun after this fix. Retention decisions remain explicit reviewed actions, not an automated legal determination.

Production npm dependency audit reports zero findings. `govulncheck` reports no reachable application vulnerability; it reports an unimported `golang.org/x/crypto/openpgp` module advisory, [GO-2026-5932](https://pkg.go.dev/vuln/GO-2026-5932). The application does not import OpenPGP. This is recorded, not treated as a reachable finding or hidden.

Changed text source was scanned for private keys, AWS access-key formats, GitHub tokens and password-bearing database URIs with zero credential findings. This pattern scan supplements review and is not a guarantee that arbitrary secret formats can never exist. Local credentials, logs, generated artifacts, caches and environments are excluded from source publication. OFL font licensing is included.

## 9. Tenant-isolation results

**PASS.** Real PostgreSQL suites verify foreign company/job/application/template/offer/document/recipient rejection, consent scope, collaborator restrictions, membership changes during scanning and concurrency. Database constraints guard tenant relations and immutable history as a second boundary. Typed conditional approvals use frozen authorized employment data, so editing the job after draft creation cannot bypass its required approval.

UI mocks and screenshots are explicitly **not** security evidence. The database suites use real local PostgreSQL and the application's stores/HTTP handlers.

## 10. Unit, integration and E2E results

| Gate | Evidence and result |
|---|---|
| Go unit/vet | Whole suite passed; gofmt clean. Exact decimals, supported currency precision, arithmetic overflow, missing draft operands, formula graph/reference/arity/cycles/zero division and typed policy facts covered. |
| Go race | Full Go 1.26.9 Linux race suite passed using the official local image. Windows' installed 32-bit compiler was unsuitable; no race-check bypass was used. |
| PostgreSQL | **24/24 independently cloned suites passed**, including final job/date filters, Offer Studio, privacy, company governance, messaging and existing candidate/recruiter regressions. |
| Migration rehearsal | 65/66 pristine down/up, populated-loss guards and six legacy offer states/amounts/letters passed. |
| Main Chromium regression | Latest broad checkpoint: **384 passed, 2 skipped, 2 failures** from 388 tests. Candidate-profile selector and notification timing failures were investigated/fixed; affected **20/20 rerun passed**. This is not represented as a single all-green 388-test run. |
| Final affected UI | 30 passed, 1 skipped, 1 new advanced-filter failure; React portal form-event propagation fixed and focused filter passed. Modal/appearance matrix 24 passed; template review, PDF cancellation and frozen employment policy cases passed. Final Review-step draft/nav rerun **2/2 passed**. |
| Admin regression | 25 passed; one machine-suspension network failure passed on a fresh focused rerun. Suspended wall-clock time is not a performance measurement. |
| Cross-browser production | **112 Firefox/WebKit route × viewport × System-appearance checks passed**, plus keyboard containment/focus-return and delayed PDF cancellation in both engines; no page errors. Chromium production measurements/captures passed. |
| Production build | Next.js production build and TypeScript passed after the final Review-step correction. |
| Published CI | Pending at this checkpoint; exact-head PR checks must pass before release classification changes. No check is bypassed. |

The first published CI attempt at `c9aadcdf7f1b1e051a4b998a8abd1aa59f39630a` reproduced two additional acceptance issues: Phase 3 migration CI attempted to reverse a database after tests created governed offer evidence, and staging acceptance still targeted the removed `SapienWorx Recruit` navigation group. The workflow now clones a pristine rollback fixture before mutations, runs real governed workspace/offer database acceptance, explicitly proves populated reversal refuses loss and preserves its count, and reverses all 66 migrations only on the pristine fixture. Local combined product/workspace/offer tests and the full pristine reversal passed. Staging now asserts Talent under the approved Recruit Plus+ group. These changes preserve the rollback guard and authorization assertions; fresh exact-head CI remains mandatory.

The two legacy skipped tests are superseded candidate-table/Kanban expectations. Current card/inline-stage tests replace them. Additional focused cases were added after the broad checkpoint; final remote CI must rerun the complete current suite.

## 11. Accessibility results

**PASS for exercised UI acceptance.** Centered native dialogs keep background inert, contain forward/backward tabbing, expose labelled close/heading/controls, focus an appropriate initial element and restore the opener. Dirty dismissal is explicit; busy sends cannot be dismissed or double-submitted. WebKit pointer focus and delayed/cancelled PDF focus were reproduced and corrected. A removed bulk trigger returns focus to a stable logical control.

Inputs retain labels, controlled errors/status announcements, keyboard operations and minimum action sizing. CV controls avoid hidden-input tab stops; interview/modal Shift+Tab, Escape and focus return were regression checked. Responsive and sampled contrast checks cover Light/Dark/System; no overall WCAG certification is claimed.

Known document limitation: generated PDFs have readable embedded text but are **not tagged accessible PDFs**. The HTML offer retains the readable terms and keyboard decision flow. Screen-reader/real assistive-device certification and tagged document export remain outstanding beyond the tested UI gate.

## 12. Performance results

Local production builds used the same synthetic API and three repeats per route on the same machine. Real PostgreSQL timings were measured separately. **Usable** is the time to a working appearance control after route content, a practical interaction proxy; it is **not a standardized TTI measurement**. No peak live EC2 load or external-network latency claim is made.

| Route | Baseline median FCP | Final median FCP | Baseline usable | Final usable |
|---|---:|---:|---:|---:|
| Applications, 25 results | 192 ms | 168 ms | 315.7 ms | 246.6 ms |
| Applications, 50 results | 244 ms | 192 ms | 368.2 ms | 281.8 ms |
| Jobs | 152 ms | 140 ms | 212.4 ms | 193.5 ms |
| Talent | 160 ms | 136 ms | 216.7 ms | 196.0 ms |

Observed CLS was 0. Final 25/50 routes rendered exactly 25/50 canonical cards. Company/access was fetched once per page; CV/notes were not fetched per card. Two auth/me calls per page remain constant rather than scaling with rows and are an optional optimization.

Twenty navigation/forced-GC samples showed first-five maximum heap 8,862,476 bytes and last-five 8,857,984 bytes; no monotonic retained-heap growth was observed. This limited experiment is not proof that every application path is leak-free.

Real PostgreSQL: 10k-job list ~46 ms; 3k-applicant sorts ~21–26 ms; 9k-stage analytics ~28 ms; 5k discovery profiles ~27 ms; 50-job governed bulk pause ~323 ms. All passed repository budgets. These are local fixture service timings, not production p95/p99 or peak concurrency estimates.

Final total static JavaScript is **716.7 KiB gzip / 2267.3 KiB raw / 90 chunks**, versus baseline 709.1 KiB gzip / 2273.0 KiB raw / 81 chunks. This total includes all app chunks, not bytes transferred by a single page. Production measurements preceded the last small Review-step action/highlight correction; that correction passed the subsequent production build and captures.

Disabling automatic recruiter sidebar prefetch removed observed WebKit document-teardown errors and unnecessary unopened workspace requests. This uses the documented [Next.js App Router prefetch control](https://nextjs.org/docs/app/guides/prefetching); routes still navigate through Link on selection.

## 13. Visual QA screenshots

**PASS for reviewed local states.** Final production capture set: **77 screenshots**, with no page errors. Included expanded/collapsed Light/Dark sidebar, desktop/mobile job filters, five grouped composer steps at 1440/360, nine recruiter offer statuses, candidate sent/accepted/declined states and 200% reflow equivalent. Representative full images and contact sheets were visually inspected; the Review-step draft action and active step styling were corrected and recaptured.

The wider existing acceptance set covers Applications, Candidate Card contexts, CV/notes/interviews, Talent, template/governance dialogs and error/busy states across the seven viewports. Six synthetic PDF pages (short one-page letter and long five-page letter) were rendered and inspected after adding frozen employment facts. Text wraps and page/footer boundaries remain intact; accented Latin names are preserved in extraction.

Local gallery: `frontend/visual-artifacts/governed-final-states/index.html`. Further screenshot directories: `governed-workspace`, `governed-offers` and `recruiter-recruit-talent`. Generated images and PDFs stay local/ignored rather than bloating the source PR. The handoff links the local gallery directly.

## 14. Light, Dark and System

**PASS for tested routes/states.** Explicit Light/Dark and System mode were regression checked. System tracks live media changes without a reload; explicit preferences ignore OS changes. Recruiter/candidate/Company Admin offer surfaces, dialogs, busy/errors, notes, applicant messages and private-CV notice were included. Browser-engine emulation does not substitute for testing every actual OS/device combination.

## 15. Responsive results

**PASS:** 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 428×926 and 360×800. Card lists stay within viewport bounds; Jobs retains its designated desktop columns with readable mobile rows; focused dialogs use full-screen mobile layouts; Offer Studio action bars stay usable above mobile navigation. 720×450 CSS viewport verified 200% reflow equivalent for a 1440-wide desktop. Actual browser zoom/assistive-device testing remains a separate verification dimension.

## 16. Known issues and priorities

| ID | Severity | State | Finding and exact recommendation |
|---|---|---|---|
| QA-01 | High release gate | Pending CI | Publish the exact reviewed branch and wait all applicable checks; any failure blocks merge/deployment. Final handoff records exact head/results. |
| QA-02 | Medium | Known limit | PDF renderer embeds Noto Sans Latin fonts. Unsupported scripts/emoji fail closed instead of silently corrupting terms. Extend `offer_pdf.go` with licensed script coverage and shaping before supporting multilingual PDF offers; add extraction and rendered language fixtures. Do not change candidate names or strip characters to make generation succeed. |
| QA-03 | Medium | Known limit | PDF output is untagged. Add tagged structure/reading order and assistive-reader validation if accessible PDF export is required; preserve the HTML equivalent. |
| QA-04 | Low | Optional optimization | Two auth/me calls per initial page. Consolidate request-scoped authorization reads only after preserving cache/privacy behavior; assert constant calls at 25/50 results. |
| QA-05 | Medium measurement limit | Future approved beta gate | Local performance is not live capacity. After a separately approved rollout, measure existing EC2 RAM/CPU/disk, scanner health, real database TLS/isolation and controlled beta-only concurrency. Do not provision new instances/RDS as part of this release. |
| QA-06 | Low | Documented | Unimported OpenPGP module advisory. Avoid introducing that package; retain reachable-dependency scans and review a parent dependency update when available. |
| QA-07 | Low | Optional deferral | Activity/telemetry, pinned notes, KPI strip and future intelligence remain outside mandatory final architecture; retain actual recorded counts and current note workflow. |
| QA-08 | High | FIXED, regression passed | Candidate erasure could falsely report completion while offer identity remained. The privacy service now locks applications before the account, detects retained offers and uses the existing auditable retention-review gate. PostgreSQL tests verify pending review and the actual in-flight-offer lock race. No immutable history is silently edited or deleted. |

Reproduced implementation defects fixed during acceptance include foreign-role data projections, privacy/CV erasure gaps, draft source/rendering loss, unsafe numeric coercion, command retry identity, lock-order/membership rechecks, advanced-filter propagation, Safari pointer focus, late PDF reopening and missing Review-step incomplete saving. Tests exercise the corresponding behavior. No remaining reproduced critical/high application defect is knowingly hidden by this report.

Immediate: exact-head CI and review. Short term: separately approved beta rollout/smoke and document capability review. Longer term: multilingual/tagged PDF export, authentic device/assistive-reader coverage and measured capacity improvements. Optional UX enhancements must not postpone mandatory release security.

## 17. Rollback plan

1. Preserve the last healthy beta immutable image SHA and database snapshot/ledger before any approved rollout.
2. If smoke fails, stop promotion and roll back **application images first** through the reviewed Beta Stage A rollback process.
3. Retain additive 65/66 schema and governed evidence. Never automatically run their down migrations on populated databases.
4. The older API cannot safely write new governed offers. Before an application rollback, place offer creation/send/decisions into maintenance or deny those mutation routes using a separately reviewed operational procedure; preserve readable evidence and export/snapshot it. Do not silently let a legacy writer bypass new approval/version rules.
5. A schema reversal requires explicit review, evidence preservation and the guards to pass. Loss refusal is intentional. Reconcile document objects/audit and verify beta current database before restoration. Production remains excluded.

## 18. Deployment steps — proposal only

1. Review the exact PR head and all applicable CI; obtain separate explicit beta release approval after this report.
2. Verify deployment environment variables, existing EC2/RDS/S3/scanner and current beta immutable SHA; take/rehearse the approved beta backup. Verify `current_database()` is `sapienworx_beta` before migration.
3. Dispatch only the existing reviewed `beta-deploy.yml` Stage A with the approved final main immutable SHA, `action=deploy`, `confirm_beta=BETA`.
4. Wait its complete result; verify migration ledger/checksums, three immutable containers, private health, database TLS/production isolation, document scan/storage and host capacity.
5. Smoke authentication, sidebar/cards, Jobs/Applications/CV/notes, Interviews/Talent/Offers/approvals/candidate decisions, System/Light/Dark, entitlements, tenant/document privacy and browser errors on beta. Public www/apex must remain the exact holding page.
6. Any critical failure stops promotion; apply the reviewed rollback plan. No Caddy/DNS/TLS changes, Stage B dispatch, production SES or production cutover are part of this proposal.

**These steps were not executed.** Publishing a draft PR triggers repository CI only; no deployment workflow was dispatched.

## 19. Exact source/review references

Baseline and freshly read remote main: `30f1b507758bbd539db44925d6a73136b94eb524`.

Review branch: `codex/recruiter-governed-workspace`. Source and this audit must be committed together, preserving migration/font-license/test files. The final handoff supplies the full resulting commit SHA, draft PR URL and freshly read exact-head CI status; this document cannot contain its own Git object SHA before commit.

## 20. Explicit deployment classification

**NOT safe for deployment while exact-head published CI remains pending.** Once every applicable check passes, the release handoff may classify the implementation as safe for a separately approved beta deployment with the documented limits and smoke gate. It must not authorize automatic rollout.

The governing instruction is **“STOP after the pre-deployment report.”** No beta workflow, live migration, AWS resource, Caddy/TLS/DNS/www/apex change or production cutover was performed. Deployment requires separate explicit approval.
