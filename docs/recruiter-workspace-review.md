# Recruiter workspace redesign — local review

Review date: 7 October 2026.

## Scope and access decision

This local redesign follows the two detailed recruiter briefs and the later native Recruit/Talent refinement. The user confirmed: **separate the workspaces and preserve existing access for now**. No subscription entitlement, pricing, paywall, external integration, or privileged account was introduced.

Recruit has Home, Jobs, Applications, Messages, Interviews and Talent, with Analytics and Settings beneath. Applications opens the company applicant pipeline. Offers and Referrals remain accessible through collapsed hiring tools and contextual flows. Talent has Discover, Pools, Saved searches, Outreach and Insights. Existing URLs remain usable.

Work is isolated on `codex/recruiter-workspace-redesign` in `tmp/beta-stage-a-live`, based on `b0e70e6c91679f7aa1f54d97c808ab04bb46eada`. The unrelated dirty primary checkout was not edited. There has been no commit, push, PR, merge, beta release, AWS operation, DNS/TLS/Caddy operation, or production change in this redesign task.


## Job Management date refinement — 8 October 2026

Posted has its own visible column beside Deadline. Both dates show a short calendar date and relative day count; full dates, including the year, are available on hover and to assistive technology. Dates from another year include that year visibly. Day counts use the workspace's IST calendar, and deadline health uses the same calendar rather than treating today's midnight as an already-passed deadline.

The desktop table is now **Job | Status | Applications | Posted | Deadline | Health | actions**, with the existing selection column retained for bulk work. The Job cell contains only title and location/department/openings. Owner, Updated (full IST timestamp) and Job ID are available in the actions drawer. Application counts and new counts remain direct links. Mobile/tablet cards retain visible Posted and Deadline blocks.

Fresh checks: TypeScript passed; four existing job filter, bulk/lifecycle, applicant navigation and responsive regressions passed (`tmp/job-dates-browser.log`). The old applicant-profile assertion was aligned to the existing Candidate name link. Fourteen page captures cover seven widths in System Light/Dark, with no measured page/table/cell overflow or page errors (`tmp/job-dates-review.log`, `tmp/job-dates-visual-measurements.json`). Four metadata-drawer captures were added. Desktop Light, compact-desktop Dark, mobile Light and metadata-drawer Dark were visually inspected. The gallery defaults to Current Jobs and retains earlier review areas. This refinement changes presentation only; no API contract, database or live environment was changed.

## Latest approval — candidate referral flow implemented locally

The user approved implementing the candidate referral reference now. This section supersedes the older recruiter intake and mandatory-resume wording. All work remains uncommitted and undeployed in the owned checkout; no AWS, live beta/production data, Caddy, TLS, DNS or www/apex action occurred.

### Delivered behavior

- Job Details retains the main application action and adds separate Share and Refer someone actions. Sharing copies an ordinary public job URL and creates no referral record.
- Refer someone opens a native right drawer on desktop and a full-width sheet on mobile. It requests full name/email, optional international phone/relationship/message and a required knows-person acknowledgement. Referrer identity and Candidate source are resolved server-side. There is no friend-CV, salary, skill or experience entry.
- Submission creates only an invitation and a durable email-outbox item. Queued and sent are distinct; registration or pre-existing applications are not disclosed by recipient input. One sender’s retry returns the same invitation without another email; several senders retain distinct history.
- My Referrals lives in the account menu, with a paginated list, literal search, safe status filter and useful empty state. Home shows an activity module only when real records exist. No permanent candidate navigation item or candidate money UI was added.
- Invitation bearers can read the public job description and referrer message before signing in. Save opportunity persists via the existing candidate saved-job API. Reading the full job page preserves the pending referral and returns to consent review instead of silently submitting a direct application.
- Sign-up, verified email and first-login onboarding preserve the bounded invitation return path. A complete manually authored professional profile is accepted without a CV. Accept and Apply remain distinct. Apply explicitly covers employer profile sharing and broad progress sharing with the referrer.
- Existing applications require a separate explicit acknowledgement to record another recommendation. Their original source and canonical referral ID are retained. Multiple recommendations never create duplicate candidate/job applications. Company reward credit is not assigned automatically.
- Recruiters see Candidate referral/referrer attribution in the normal pipeline and can filter actual supported sources. Candidate 360 includes only consented, same-company history in chronological order. Pending personal messages are withheld from recruiter tracking, and recruiters cannot copy/resend/cancel candidate-owned pending invitation links.

### Privacy and abuse controls

The sender DTO omits recipient IDs, application IDs, email/phone, detailed hiring stages, feedback, compensation, scores and rewards. Verified-account linking alone remains private; Joined is shown only after the recipient accepts the opportunity. Detailed stages map to Applied, In process, Successful or Not proceeding only after application attribution consent. Foreign sender histories, wrong recipient identities, disabled/private/closed/deadline-expired jobs and unverified senders are rejected. The durable rolling 24-hour cap is 10 new invitations per candidate, serialized per sender. Cancelled/declined records and repeated requests cannot evade the count; retries create no additional emails.

### Schema and release boundary

Migration **000058** extends the existing referral engine with a candidate actor, per-referrer deduplication and consented `application_referral_history`. `candidate + job` remains unique in applications; source attribution is never overwritten. The down migration refuses a lossy rollback after candidate invitations or multiple recommendations exist. The actual down/up migration rehearsal passed in a rollback transaction on localhost `sapienworx_ci`; the actual refusal guard also passed with synthetic candidate data. These SQL checks were local only. The retired recruiter invitation POST returns **410**. These contract/schema changes require normal release review; no release was performed.

### Fresh verification and inspection

- Production frontend build and TypeScript checks passed: `tmp/candidate-referral-build.log`, `tmp/candidate-referral-typecheck.log`.
- Full backend unit/regression suite and static checks passed: `tmp/candidate-referral-backend-all.log`, `tmp/candidate-referral-vet.log`. Fake scanner socket tests used loopback access; no external scanner or mail provider was enabled.
- Guarded PostgreSQL integration tests passed: `tmp/candidate-referral-db.log`. They exercise registration non-enumeration, actor/job eligibility, owner isolation, optional-phone non-enumeration, no invitation-created accounts/apps, manual profile, explicit consent, idempotency, several referrers, direct-source preservation, actual source filtering, company history, coarse status/DTO privacy, invitation cap and rollback refusal.
- Final referral plus recruiter browser run: **17/17 passed**, `tmp/candidate-referral-browser-verified.log`. Initial failures identified the reverse-Tab wrap and an ambiguous accessible label; both were corrected and rerun. Fixture description/status-selector mismatches were corrected without weakening the behavioral assertions. Visual inspection then caught the public recipient page missing its dark-theme surface; it was corrected, with a targeted normal-text contrast check of at least 4.5:1 and refreshed recipient states.
- Existing candidate saved-job persistence, historic application recognition and keyboard/mobile account/logout regressions: **3/3 passed**, `tmp/candidate-referral-existing-regression.log`.
- **84 current candidate captures** cover Job Details, drawer, queued confirmation, My Referrals, empty filtering and recipient review across 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 428×926 and 360×800 in System Light/Dark. Native drawer screenshots use viewport capture; longer list/recipient pages use full-page capture. Current recruiter pages/drawers and recipient outcome states were refreshed separately. Historical intake images are labeled Legacy.
- Live System light/dark transitions, explicit theme overrides, focus containment/return, Escape, validation, retained error input, save persistence, onboarding return and hydration/page errors were checked. This is Chromium local-fixture verification, not a live-beta, complete WCAG, every-browser or peak-load certification.

### Current limitations

Queued is a truthful outbox state, not proof of email delivery. This change enables no provider, production SES access, external integration, rewards payment or new company-admin privilege. Candidate records use bounded pagination; the older recruiter tracker remains capped at 100 records and needs pagination before larger-scale use. Company reward/credit policy and advanced referral settings remain later work. Existing email/outbox delivery and job-level eligibility controls are reused. Deployment and live acceptance require a separate release action.


## Latest five-brief refinement — 7 October 2026

The five briefs supplied in this turn are implemented locally. This section supersedes earlier review rows where the page contract changed. The agreed decision to preserve existing recruiter access takes precedence over subscription suggestions: no paywall or new entitlement restriction was introduced.

| Area | Current implementation |
|---|---|
| Applications | Automatic compact toolbar, left advanced-filter drawer, actual stage counts, Candidate 360 name/primary action, overflow, contextual stage/pool/save/message actions, compact pagination and job-scoped columns. Interview combines the actual technical/HR/final stages. |
| Jobs | Automatic filters, actual lifecycle counts, compact title/location/department/openings, separate visible Posted and Deadline columns with relative days, owner/updated/Job ID in the actions drawer, applicant/new links, health signals, select-all/contextual bulk actions, governed edit/share/duplicate/assignment/lifecycle overflow and close/archive confirmation. |
| Interviews | Retained list/calendar and status views; keyword/IST-date filters; candidate/job/round/date/time hierarchy; Join/Reschedule for upcoming interviews; complete/cancel/details/history/copy link in overflow. Meeting URLs remain manually supplied data. |
| Talent Pools | Named manual pools, read-time Smart Pools, desktop rail/mobile picker, Create Pool, private/team/company viewing access, owner-only membership edits, automatic location/experience/notice/tag/keyword filters, inline tags and actual saved-by/company/activity metadata. Mobile retains message/activity actions. |
| Referrals | Candidate Job Details hosts Refer someone; the account menu hosts My Referrals. Recruiters track consented applicants in the normal pipeline without a referral-create action. Required professional fields, separate consent, immutable canonical source and consented referral history are preserved. |

### Referral lifecycle and privacy

- Tokens expire after seven days, are signed and stored as hashes. Resend rotates the token on the same referral ID. The raw token is absent from stored outbox content and is reconstructed in memory at dispatch. A fragment link is removed from the browser URL and retained in tab-scoped storage through registration.
- Public lookup exposes company/job/expiry, referrer display name and the invitation message to its bearer, without recipient identity or contact details. Linking requires an active candidate with the matching verified email. Wrong identity, tampered/expired/cancelled/superseded invitations are denied. Invitation linkage/acceptance alone grants no recruiter profile access.
- Registration, email verification and first-login setup preserve only the bounded `/referrals` return path. Completing a profile exposes a clear return link. Opening another invitation in the same tab refreshes its state.
- Apply requires acceptance, explicit consent and actual name/title/location/experience/skills information; a complete manual profile is supported and a CV is optional; no arbitrary percentage threshold. General invitations do not create applications. Existing applications retain their source. Repeated Apply keeps one canonical referral application.
- The hiring stage comes from the canonical application. Candidate 360 attribution is company-scoped and requires the authorized company application; pending invitations never become pipeline counts merely by being entered.
- Reward records require a hired application and explicit employer eligibility/retention review. Approved/paid states need a note and confirmation; paid requires a prior approved record. No payment is initiated and no provider/production SES access is enabled.
- Temporary delivery lookup failure retries with a generic persisted error; permanently unavailable content is suppressed. The fake-provider test sends no email.

### Pool authorization and Smart Pool semantics

Private pools belong to their owner. Team pools allow explicitly selected verified same-company recruiters to view. Company pools allow verified company recruiters to view. Only owners mutate manual membership/tags. Every read rechecks candidate activity and current discovery consent or an existing company application. Sharing never overrides contact/CV privacy; foreign companies and foreign team members are rejected.

Smart membership is computed when opened from current professional criteria and consent, without manual membership or search-appearance events. Saved Searches remain separate. No background membership worker or Projects product was introduced. Company-admin sharing entitlements are not modeled by the current API; the explicit verified-owner/company policy above is used without inventing privileges.

### Schema and compatibility review

Migration **000056** adds named pools, explicit shares, membership and events. **000057** adds referral invitations/events and canonical `applications.referral_id` uniqueness. Both are transactional. Up migrations and a down/up rehearsal inside a rollback transaction passed only in the guarded localhost `sapienworx_ci` database. No RDS/beta migration was run.

Historical referral records remain readable. Old manual referral-create/status HTTP endpoints now return **410** with guidance to use invitations, preventing a consent/progress bypass. This deliberate API contract change requires release review alongside the migrations; historical data is retained.

### Defects found and corrected

| ID | Severity | Finding | Fix |
|---|---|---|---|
| RR-01 | Medium | Left filter variant still aligned right. | Corrected inset/border/radius; focus and left-edge assertions pass. |
| RR-02 | Medium | Pool inputs overflowed mobile cards. | Bounded field widths/flex bases; seven-width matrix passes. |
| RR-03 | Medium | Row actions wrapped and the dark new-applicant link lacked contrast. | Compact nowrap actions, revised columns, themed colour. |
| RR-04 | Medium | Empty Smart selection displayed bookmarks and inherited incompatible filters. | Real Smart chooser; clear unrelated facets on Smart links. |
| RR-05 | High | New invitees could not start onboarding with the referral return path. | Bounded server allowlist plus redirect preservation; registration/verification/setup tests pass. |
| RR-06 | Medium | Text entered before hydration could lose its filter update. | Disable fields until handlers are ready; immediate/debounced update tests pass. |
| RR-07 | High | Temporary delivery lookup errors could suppress invitations permanently. | Retry transient errors; suppress only permanent unavailability. Guarded DB/fake-provider test passes. |
| RR-08 | Medium | Mobile pools omitted desktop metadata and actions. | Restore notice/company/skills/activity, inline tags and message/activity overflow. |
| RR-09 | Medium | Existing applications and replayed Accept could misstate progress. | Derive already-applied state and preserve canonical submitted state/source. |
| RR-10 | Medium | Another invitation opened in the same tab retained stale content. | Listen for link changes, clear stale content/consent and fetch fresh state. |

### Verification evidence

- Full backend regressions **PASS**: `tmp/recruiter-refinements-backend-all.log`. Static checks **PASS**: `tmp/recruiter-refinements-vet.log`.
- Guarded PostgreSQL tests **PASS**: `tmp/recruiter-refinements-db.log`. These exercise ACLs/owner-only writes, foreign shares, filter counts, consent withdrawal, Smart membership, invitation dedupe/no account/no application creation, token integrity/rotation, verified identity, outbox token protection, acceptance/consent/required CV/idempotency, canonical attribution, foreign Candidate 360 denial, reward preconditions and fake-provider retry/suppression.
- Initial broader Chromium regression run: **35/38 passed**. All three failures were investigated: an old Candidate 360 button assertion, pre-hydration filter input and an ambiguous select label. Final targeted run: **11/11 passed**, including each previously failing check plus referral registration/error states. Candidate onboarding additionally passed **3/3**. Logs: `tmp/recruiter-refinements-regressions.log`, `tmp/recruiter-refinements-final-browser.log`, `tmp/recruiter-refinements-verified-browser.log`.
- The current six pages plus three drawers have **126 captures** across 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 428×926 and 360×800 in System Light/Dark. Automated checks cover overflow, runtime page errors, focus containment and Escape. Representative finished desktop/tablet/mobile/drawer images were personally inspected. Broader passes cover Candidate 360 privacy/actions, Recruit/Talent context, job builder, saved searches, messaging/live appearance/contrast, analytics export, outreach and keyboard focus.
- Final invitation UI rerun: **4/4 PASS**, `tmp/recruiter-refinements-invitation-final.log`. The public, expired/unavailable, incomplete-profile, general, existing-application and submitted states add **24 captures** at 1440 and 360 px in Light/Dark. The profile-return link is also checked. Total current evidence: **150 captures**. Production frontend build and TypeScript validation **PASS** (`tmp/recruiter-refinements-build.log`, `tmp/recruiter-refinements-typecheck.log`).

### Release status and limits

Changes are **uncommitted and undeployed**. Review migrations 56/57, legacy referral endpoint retirement, frontend/email origin and worker configuration together before release through the established CI/explicit beta approval flow. No live email/SMS acceptance was performed.

Named-pool listing returns at most 100 authorized pools and computes current membership counts per pool; referral listing returns at most 100 records. Large-company workloads need pagination/batched counts and measured load testing. Existing offset-pagination and workforce-indexing limits described later remain. No cross-browser/full WCAG/live-beta or million-profile capacity certification is claimed. Interviewer/feedback and subscription fields without an authoritative model were not fabricated.

## Shared review contract

Tables have column headers and bounded server results where the API supports them; mobile displays the same records as stacked articles. Native drawers supply background inertness, Tab/Shift+Tab containment, Escape, initial focus and focus return. Existing server role/company/owner checks remain authoritative. System follows live device appearance; explicit modes use the existing theme implementation. The approved serif display typography and SapienWorx colours are retained.

Loading/error/empty states distinguish absence from service failure where introduced. Mutations retain form values and report failure. The new search boundary rejects unknown, nested, sensitive and unauthorized criteria, validates finite decimal experience and Boolean syntax, and bounds page size and taxonomy terms. Relevant-skill order uses exact canonical professional skills, not invented AI percentages. Candidate contact and CV permissions remain separately controlled.

The screenshots are local mock-data UI evidence, not live beta acceptance. Database checks use the guarded localhost `sapienworx_ci` database, never RDS. Browser runs use isolated ports 3213/18093. Full browser/device and production load certification are outside this evidence.

## Page-by-page 20-point review

Each page below records the requested twenty review points. Items 13–20 apply the shared contract above, with page-specific evidence and limits called out.

### Home

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Too many competing dashboard surfaces. |
| 2 | Goal | Make the next hiring action clear. |
| 3 | Hierarchy | Compact greeting; attention list; four actual KPIs; active jobs; interviews; six recent applications. |
| 4 | Desktop | Compact tables. |
| 5 | Tablet | Reduced columns and wrapping controls. |
| 6 | Mobile | Stacked job/interview/application articles. |
| 7 | Primary action | Post a job. |
| 8 | Secondary actions | Open applicant/interview; full analytics. |
| 9 | Retained capability | Dashboard counts, job links, application links and upcoming schedule. |
| 10 | Moved/collapsed capability | Detailed reporting remains under Analytics. |
| 11 | Components | Shared header, data table and state surface. |
| 12 | Backend/API | Existing dashboard/jobs APIs; no fabricated feedback-overdue or approval counts. |
| 13 | Permissions | Company scope and existing session role. |
| 14 | Loading | Existing route loading plus table readiness. |
| 15 | Empty | Clear queues/no active jobs/no upcoming interviews. |
| 16 | Error | Active-job fetch failure has an actionable retry link. |
| 17 | Accessibility | Named KPI links, proper table headers, visible keyboard focus. |
| 18 | Responsive QA | Seven viewport/appearance matrix. |
| 19 | Functional QA | Dashboard and interview navigation regressions. |
| 20 | Visual finding / limit | Desktop hierarchy inspected; counts intentionally describe applications rather than pretending they are unique candidates. |

### Jobs

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Large cards and competing actions obscured vacancy operations. |
| 2 | Goal | Manage vacancies in a compact list. |
| 3 | Hierarchy | Status tabs; search/facets; bulk selection; results and pagination. |
| 4 | Desktop | Fixed-layout table with job reference, status, application count, deadline, health and next action. |
| 5 | Tablet | Only essential columns remain. |
| 6 | Mobile | Stacked vacancy records with the same actions. |
| 7 | Primary action | View applicants, with job title opening its overview. |
| 8 | Secondary actions | More: edit, analytics, preview/share where public; governed bulk controls. |
| 9 | Retained capability | All status transitions, duplicate/edit, private-job protection and job references. |
| 10 | Moved/collapsed capability | Preview/share/analytics move into More. |
| 11 | Components | Existing lifecycle/status/share controls plus compact header. |
| 12 | Backend/API | Existing job workspace; actual owner name added from company-scoped recruiter profile. |
| 13 | Permissions | Company-owned jobs and existing assignment/status authorization. |
| 14 | Loading | Existing route loading. |
| 15 | Empty | Filtered no-results remains useful. |
| 16 | Error | Existing backend errors remain visible. |
| 17 | Accessibility | Action names, bulk confirmation and native disclosures. |
| 18 | Responsive QA | Seven viewport/appearance matrix and existing bulk tests. |
| 19 | Functional QA | Private sharing, bulk reassignment, references and applicant navigation. |
| 20 | Visual finding / limit | Dark desktop table inspected; updated date and actual owner retained without invented ownership. |

### Job builder

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Unrelated controls occupied one long recruitment-settings step. |
| 2 | Goal | Preserve every input while making sequencing understandable. |
| 3 | Hierarchy | Basics → Description → Application → Hiring workflow → Publish. |
| 4 | Desktop | Working form beside candidate-facing preview. |
| 5 | Tablet | Wrapping step navigation and narrower preview. |
| 6 | Mobile | Full-width form; preview follows it. |
| 7 | Primary action | Continue; publish only in the final step. |
| 8 | Secondary actions | Back and draft/save; public sharing follows publishing from the job overview. |
| 9 | Retained capability | All existing fields and exact POST/PATCH payload shape. |
| 10 | Moved/collapsed capability | Experience moves to Basics; education/skills to Description; questions/deadline to Application; owner/stages/private compensation/notes to Workflow; visibility/referrals to Publish. |
| 11 | Components | Existing JobBuilder, taxonomy and preview components. |
| 12 | Backend/API | No new fields or publish API contract. |
| 13 | Permissions | Existing owned-job guards; only 403/404 become controlled not-found. |
| 14 | Loading | Busy draft/publish controls. |
| 15 | Empty | Editable drafts keep existing values. |
| 16 | Error | Focused errors retain the draft. |
| 17 | Accessibility | New step heading focus; every previous field remains labeled. |
| 18 | Responsive QA | Existing builder regression widths plus workspace matrix. |
| 19 | Functional QA | Five-step payload preservation and private preview checks. |
| 20 | Visual finding / limit | Optional features without an existing API, such as hiring-manager/scorecard configuration, were not fabricated. |

### Job overview

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Job-related work required jumping between unrelated modules. |
| 2 | Goal | Provide a native job command page. |
| 3 | Hierarchy | Overview, Candidates, Interviews, Offers, Activity. |
| 4 | Desktop | Actual hiring progress, role details, owner and latest twenty audit events. |
| 5 | Tablet | Tabs wrap and details use fewer columns. |
| 6 | Mobile | Stacked metrics/details with contextual links. |
| 7 | Primary action | Open Candidates. |
| 8 | Secondary actions | Edit/share; job analytics; other contextual tabs. |
| 9 | Retained capability | Existing applicants, interviews, offers and audit APIs. |
| 10 | Moved/collapsed capability | Cross-job monitoring remains available, while job-specific links retain job_id. |
| 11 | Components | JobContext and ownedRecruiterJob guard. |
| 12 | Backend/API | Optional parameterized job filters for interviews/offers, always combined with company ownership. |
| 13 | Permissions | Foreign jobs cannot unlock the overview or related data. |
| 14 | Loading | Route readiness preserves loading boundary. |
| 15 | Empty | No recorded audit changes is explicit. |
| 16 | Error | 500-class backend failures remain errors, not not-found. |
| 17 | Accessibility | Semantic navigation and description of cumulative funnel totals. |
| 18 | Responsive QA | Seven viewport/appearance matrix. |
| 19 | Functional QA | Context persistence through calendar/offers; tenant database checks. |
| 20 | Visual finding / limit | Progress counts say applications that reached a stage, not current stage distribution. |

### Candidates / Pipeline

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Applicant cards duplicated information and displaced stage actions. |
| 2 | Goal | Make active applicant review quick and table-first. |
| 3 | Hierarchy | Filters, selected criteria, bounded results, bulk action and pagination. |
| 4 | Desktop | Compact application rows, stage control and details. |
| 5 | Tablet | Collapsed filters and essential columns. |
| 6 | Mobile | Candidate articles with stage and details. |
| 7 | Primary action | Review candidate / move stage. |
| 8 | Secondary actions | Save selected, message, CV under its authorization, notes and activity. |
| 9 | Retained capability | Application stages, notes, CV controls, saved flags and existing bulk save. |
| 10 | Moved/collapsed capability | Long profile content moves to drawer/Candidate 360. |
| 11 | Components | Applicant workspace and shared drawer/table. |
| 12 | Backend/API | Existing pipeline plus server-side candidate_id and source filters. |
| 13 | Permissions | Company job predicate remains mandatory for every query. |
| 14 | Loading | Route loading and mutation-busy states. |
| 15 | Empty | No matches explains filters. |
| 16 | Error | Stage/save errors retain the row state. |
| 17 | Accessibility | Accessible status disclosures with Escape/focus return; labeled selection. |
| 18 | Responsive QA | Seven viewport/appearance matrix. |
| 19 | Functional QA | Stage payload, company filtering, source filtering, mobile actions. |
| 20 | Visual finding / limit | Desktop/mobile candidates inspected; no Kanban. |

### Candidate 360

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | One long page mixed professional information, matching, activity and privacy. |
| 2 | Goal | Progressively disclose a complete authorized profile. |
| 3 | Hierarchy | Compact header; Overview, Experience, Resume, Interviews, Matches, Activity, Privacy. |
| 4 | Desktop | Notes immediately precede professional summary; detailed sections under tabs. |
| 5 | Tablet | Tabs wrap without squeezing content. |
| 6 | Mobile | Full-width panels and bounded action rows. |
| 7 | Primary action | Message / interview when authorized. |
| 8 | Secondary actions | Save, authorized CV/contact and job-specific actions. |
| 9 | Retained capability | Professional records, approved match explanation, applications, audit activity and consent gates. |
| 10 | Moved/collapsed capability | CV, interview events, matches and privacy move into focused sections. |
| 11 | Components | Roving keyboard tabs plus existing note/contact/CV components. |
| 12 | Backend/API | Exact owned-job resolution handles jobs outside the first list page. |
| 13 | Permissions | Withdrawn discovery consent blocks bookmarked access; a company application retains it. |
| 14 | Loading | Existing route and action loading. |
| 15 | Empty | Missing professional records are stated. |
| 16 | Error | 403/404 detail denial is controlled; backend outages remain errors. |
| 17 | Accessibility | Arrow/Home/End tabs; focus return; dark skill contrast corrected. |
| 18 | Responsive QA | Seven viewport/appearance matrix plus edge-case tests. |
| 19 | Functional QA | Sourced/applicant privacy, interview availability and hydrated HTML regressions. |
| 20 | Visual finding / limit | Mobile Dark inspected; a nested paragraph hydration defect was corrected. |

### Messages

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Inbox had no candidate context alongside a conversation. |
| 2 | Goal | Keep direct messages focused on the hiring conversation. |
| 3 | Hierarchy | Conversations; conversation; authorized candidate context. |
| 4 | Desktop | Three panes at wide desktop. |
| 5 | Tablet | Conversation with context drawer. |
| 6 | Mobile | Separate inbox/conversation/context views. |
| 7 | Primary action | Send a direct reply. |
| 8 | Secondary actions | View authorized profile and job interviews; unread/search. |
| 9 | Retained capability | HTTP messaging, WebSocket reconnect, typing/read events and draft behavior. |
| 10 | Moved/collapsed capability | Automation remains in Talent Outreach. |
| 11 | Components | Existing messaging hooks plus abortable context component/native drawer. |
| 12 | Backend/API | Candidate detail and tenant-scoped candidate/job pipeline reads. |
| 13 | Permissions | Context denial does not expose data or block an existing authorized conversation. |
| 14 | Loading | Explicit context loading. |
| 15 | Empty | Existing empty inbox/conversation. |
| 16 | Error | Read failure leaves the conversation usable; send errors retain text. |
| 17 | Accessibility | Reply label; keyboard drawer containment/return; dark message text corrected. |
| 18 | Responsive QA | Seven viewport/appearance matrix. |
| 19 | Functional QA | Context success/error UI and existing messaging regressions. |
| 20 | Visual finding / limit | Wide Dark inspected; local mock cannot certify real beta WebSocket delivery. |

### Discover Talent

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Large flat search form and card results made complex criteria hard to manage. |
| 2 | Goal | Give structured search a clear primary action and privacy boundary. |
| 3 | Hierarchy | 75/25 criteria and recent/saved rail; nine expandable groups; fixed actions; results. |
| 4 | Desktop | Structured form, active chips and table results. |
| 5 | Tablet | Single-column sections with rail below. |
| 6 | Mobile | Full-width criteria/results and preview drawer. |
| 7 | Primary action | The fixed Search Talent action. |
| 8 | Secondary actions | Save/update/duplicate search, edit criteria, sort/page, preview/profile/message/add pool. |
| 9 | Retained capability | Boolean/scope/exclusion, skills, decimal experience, locations, employment, education, languages, certifications, activity, verification and resume presence. |
| 10 | Moved/collapsed capability | Advanced groups collapsed; restricted fields disabled; long profile in preview/360. |
| 11 | Components | Metadata-driven fields, taxonomy chips, shared results and drawer. |
| 12 | Backend/API | Unified whitelist/validation; professional-only SQL; skill/text/updated indexes in migration 55. |
| 13 | Permissions | Latest discovery consent and private-field rejection enforced server-side. |
| 14 | Loading | Cancelable search and skeleton. |
| 15 | Empty | Build-search/no matches explains the next step. |
| 16 | Error | 400/429/503 states retain criteria and field focus. |
| 17 | Accessibility | Keyboard chips, range errors, native drawer and fixed-bar scroll padding. |
| 18 | Responsive QA | Seven viewport/appearance matrix plus state tests. |
| 19 | Functional QA | Real PostgreSQL exact Go-versus-Django, legacy skills, privacy and 100k search. |
| 20 | Visual finding / limit | Default visit shows criteria before running a query; natural-language interpretation/semantic ranking are not invented. |

### Pools / Projects

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Saved talent was presented as large cards with limited organization. |
| 2 | Goal | Organize authorized bookmarks into private groups. |
| 3 | Hierarchy | Static tag-backed pools and criteria-backed smart searches. |
| 4 | Desktop | Table with selection, professional summary, groups and actions. |
| 5 | Tablet | Reduced columns. |
| 6 | Mobile | Stacked saved records and contextual bulk bar. |
| 7 | Primary action | View candidate / select audience. |
| 8 | Secondary actions | Edit/add tags, confirmed bookmark removal, bulk InMail. |
| 9 | Retained capability | Private bookmark ownership, tags and existing bulk-message safeguards. |
| 10 | Moved/collapsed capability | Smart grouping uses actual saved criteria rather than a fake engine. |
| 11 | Components | Shared table/drawer and existing bulk InMail component. |
| 12 | Backend/API | Omitted PUT tags preserve existing groups; explicit empty tags clear them. |
| 13 | Permissions | Withdrawal cannot be bypassed by a bookmark; company applicants stay available. |
| 14 | Loading | Busy mutation controls. |
| 15 | Empty | No saved candidates points to a real workflow. |
| 16 | Error | Partial bulk failure reports successes and retains failed selections. |
| 17 | Accessibility | Labeled checkboxes and confirmed removal; keyboard drawer. |
| 18 | Responsive QA | Seven viewport/appearance matrix. |
| 19 | Functional QA | Tag persistence, cancelled removal and real tenant/privacy tests. |
| 20 | Visual finding / limit | Mobile pool layouts inspected; no candidate records are deleted by bookmark removal. |

### Saved searches

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Saved search alert cards could not manage criteria or show fresh counts. |
| 2 | Goal | Reuse precise searches and control delivery. |
| 3 | Hierarchy | Search/criteria table, alert selector and contextual actions. |
| 4 | Desktop | Criteria, delivery and actions in three columns. |
| 5 | Tablet | Wrapping controls. |
| 6 | Mobile | Stacked search records. |
| 7 | Primary action | Run search. |
| 8 | Secondary actions | Edit criteria, rename, duplicate, delete, fresh match counts, Off/Daily/Weekly. |
| 9 | Retained capability | Ownership, old criteria, alert metadata and worker delivery. |
| 10 | Moved/collapsed capability | Full editing returns to the populated Discover form. |
| 11 | Components | SavedSearchAlerts and shared drawer/table. |
| 12 | Backend/API | Owner-only GET/PATCH/DELETE and match-count endpoint; shared canonical validator. |
| 13 | Permissions | Private/unknown criteria never widen a search; foreign IDs are denied. |
| 14 | Loading | Action/checking busy state. |
| 15 | Empty | No saved searches gives a discovery link. |
| 16 | Error | Failed changes retain criteria; invalid legacy policy is reported. |
| 17 | Accessibility | Labeled frequency selectors and confirmed delete. |
| 18 | Responsive QA | Seven viewport/appearance matrix. |
| 19 | Functional QA | Owned/foreign counts, no false profile-appearance events, rename/delete/criteria retention. |
| 20 | Visual finding / limit | Counts are requested explicitly; updated-profile counts are not mislabeled as unique new candidates. |

### Outreach

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Campaigns, sequence forms and template cards competed on the same screen. |
| 2 | Goal | Guide a reviewed audience into a controlled draft campaign. |
| 3 | Hierarchy | Campaigns / Sequences / Templates; Audience → Message → Schedule → Review drawer. |
| 4 | Desktop | Compact campaign/template/sequence tables and two actual delivery metrics. |
| 5 | Tablet | Wrapping actions and preview disclosures. |
| 6 | Mobile | Stacked records and full-width editor. |
| 7 | Primary action | Create the selected resource. |
| 8 | Secondary actions | Launch/pause/resume/cancel; template/step preview. |
| 9 | Retained capability | Consent/suppression/cooldown/budgets/idempotency/reply-stop delivery remains server-owned. |
| 10 | Moved/collapsed capability | Forms move to drawers; follow-up detail is on demand. |
| 11 | Components | Shared tables/drawers with the existing sequence/campaign handlers. |
| 12 | Backend/API | Stable retry idempotency key per launch; existing APIs retained. |
| 13 | Permissions | Existing recipient and tenant policy; draft creation sends no messages. |
| 14 | Loading | Busy form/campaign actions. |
| 15 | Empty | No resources gives real setup steps. |
| 16 | Error | Forms retain drafts and server messages. |
| 17 | Accessibility | Roving tabs, named fields and drawer focus. |
| 18 | Responsive QA | Seven viewport/appearance matrix. |
| 19 | Functional QA | Draft wizard payload and protected launch regression. |
| 20 | Visual finding / limit | Actual sequence delays shown; calendar scheduling and speculative eligibility counts are not fabricated. |

### Interviews

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | UUID-oriented scheduling and mixed views increased coordination friction. |
| 2 | Goal | Use named applicants and reliable local-time entry. |
| 3 | Hierarchy | List/calendar; All/Upcoming/Completed/Cancelled; schedule drawer. |
| 4 | Desktop | Interview table with role, schedule, status and actions. |
| 5 | Tablet | Compact interview records. |
| 6 | Mobile | Stacked candidate/role/time/action records. |
| 7 | Primary action | Schedule interview. |
| 8 | Secondary actions | Reschedule/cancel/complete, candidate/message and manual meeting link. |
| 9 | Retained capability | All original scheduling/change/history fields and manual URLs. |
| 10 | Moved/collapsed capability | Scheduling fields move to drawer; calendar remains optional. |
| 11 | Components | Shared native drawer and explicit IANA time conversion. |
| 12 | Backend/API | Existing APIs plus company-and-job filter; ambiguous/missing wall times are rejected. |
| 13 | Permissions | Application/company authorization unchanged. |
| 14 | Loading | Busy mutation states. |
| 15 | Empty | Unavailable/no upcoming schedule remains explicit. |
| 16 | Error | Bad time/meeting inputs remain editable. |
| 17 | Accessibility | Initial application focus; Tab/Shift+Tab/Escape/return. |
| 18 | Responsive QA | Seven viewport/appearance matrix and existing day/week cases. |
| 19 | Functional QA | Scheduling UTC payload, conflict-safe time entry and history navigation. |
| 20 | Visual finding / limit | Tablet Dark inspected; interviewer availability and structured feedback need an existing governed backend before adding UI. |

### Offers / Referrals

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Long create forms displaced monitoring records. |
| 2 | Goal | Keep conversion and referral actions contextual and compact. |
| 3 | Hierarchy | Status/recruitment/reward views; responsive list; create drawer. |
| 4 | Desktop | Table with candidate/job/status and relevant actions. |
| 5 | Tablet | Wrapping controls. |
| 6 | Mobile | Stacked records. |
| 7 | Primary action | Create offer / referral. |
| 8 | Secondary actions | Existing status/reward transitions; candidate/job context. |
| 9 | Retained capability | All existing compensation/date/note/referral inputs and server rules. |
| 10 | Moved/collapsed capability | Creation moves into drawer; cross-job screens remain secondary. |
| 11 | Components | Shared table/drawer/state components. |
| 12 | Backend/API | Existing offer/referral APIs plus company-owned job offer filter. |
| 13 | Permissions | Cross-company mutations remain denied and audited stage effects retained. |
| 14 | Loading | Busy mutations. |
| 15 | Empty | No matching records explained. |
| 16 | Error | Errors retain input; form reset captures the form before awaiting. |
| 17 | Accessibility | Named human applicant pickers and native focus behavior. |
| 18 | Responsive QA | Seven viewport/appearance matrix plus original product views. |
| 19 | Functional QA | Owned/foreign offer mutation and stage audit checks; UI regression. |
| 20 | Visual finding / limit | Draft/approval/document capabilities not represented by the API are not fabricated. |

### Analytics / Talent insights / Settings

| # | Review point | Result |
|---|---|---|
| 1 | Current problem | Reports and configuration lacked a clear place outside daily hiring. |
| 2 | Goal | Keep daily work uncluttered and report actual data. |
| 3 | Hierarchy | Recruit analytics; Talent delivery insights; account/organization/appearance settings. |
| 4 | Desktop | Aggregate funnel/source/cohort tables plus accessible compact chart and CSV export. |
| 5 | Tablet | Fewer columns and wrapping controls. |
| 6 | Mobile | Stacked aggregate records. |
| 7 | Primary action | Open the relevant pipeline / export aggregate data. |
| 8 | Secondary actions | Talent delivery inspection and appearance/password reset. |
| 9 | Retained capability | All original aggregate metrics and existing theme preferences. |
| 10 | Moved/collapsed capability | Detailed metrics remain outside Home. |
| 11 | Components | Shared tables/states plus scoped analytics component. |
| 12 | Backend/API | Source drill-down now applies a real pipeline source filter; CSV escapes formulas; actual campaign counts. |
| 13 | Permissions | Tenant aggregates; no new commercial gate or private candidate export. |
| 14 | Loading | Existing route loading. |
| 15 | Empty | No campaign activity explicit. |
| 16 | Error | Service failures remain errors in the new insight/settings reads. |
| 17 | Accessibility | Chart has an equivalent accessible table; named mode controls. |
| 18 | Responsive QA | Seven viewport/appearance matrix. |
| 19 | Functional QA | Source/tenant SQL filters, CSV flow and mode regression. |
| 20 | Visual finding / limit | Desktop/mobile report hierarchy inspected; no unsupported reply/hire attribution or subscription management UI. |

## Defects addressed and remaining work

| ID | Component | Severity | Finding / action | State |
|---|---|---|---|---|
| R01 | Candidate access | High | A private bookmark could grant profile access after discovery consent withdrawal. `candidate_detail.go`, `candidate_match.go` and `talent_pool.go` now require current discovery consent or a company application. | Fixed locally; two-company PostgreSQL regression passed. |
| R02 | Search validation | High | Search and stored alert criteria could differ or admit unsupported private fields. `discovery_criteria.go` is the shared validated boundary for interactive, saved and alert criteria. Nested/unknown/restricted fields are rejected. | Fixed locally. |
| R03 | Professional details | High | Arbitrary key-skill objects and private certification keys could reach recruiter details. `candidate_detail_privacy.go` keeps string skill names and approved certification fields. | Fixed locally; allow-list regression passed. |
| R04 | Skill search | Medium | Substring skill matching could treat Go as Django and miss historical comma/array skill records. Migration 55 and the discovery query use exact canonical skill terms with a partial GIN index. | Fixed locally; real PostgreSQL semantic and 100k fixture checks passed. |
| R05 | Candidate 360 | High | Nested CV markup inside a paragraph caused hydration errors. The CV controls use a valid container. | Fixed locally; browser page-error/hydration checks passed. |
| R06 | Job context | Medium | Looking for an owned job only in a bounded recent-job list could return a false 404. `recruiter-job-server.ts` resolves the exact owned job; applicants, interviews and offers retain job context. | Fixed locally. |
| R07 | Pool tags | Medium | An idempotent save with omitted tags could clear existing group membership. `SaveToTalentPool` preserves tags when omitted and permits an explicit empty array to clear them. | Fixed locally; PostgreSQL regression passed. |
| R08 | Bulk pipeline controls | Medium | Selected identifiers could remain stale after the visible scope changed. Selection is reconciled with current rows and bulk actions use those rows. | Fixed locally. |
| R09 | Campaign wizard | Medium | The final Continue button could become a submit button during the same click and create a draft before review. Footer buttons have explicit types/form ownership, distinct keys and a submission guard requiring Review. | Fixed locally; test proves zero create requests before the final action. |
| R10 | Long drawer forms | Medium | Save/Cancel could fall below the visible portion of long forms. Interview, offer, referral and outreach actions now live in the fixed drawer footer. | Fixed locally; seven-width layout and keyboard checks. |
| R11 | Large IT-skill import | High | A 100k normalized IT-skill import timed out in the existing taxonomy usage trigger. Search with supported key-skill fixtures passes, but bulk IT-skill ingestion remains unproven. Profile `workforce.sync_candidate_competencies` contention and replace per-row hot aggregate updates with a separately reviewed bulk ingestion approach. | Open; capacity/ingestion blocker, not hidden by disabling triggers. |
| R12 | Invalid legacy alerts | Medium | A due batch dominated by invalid stored definitions can repeatedly retry them and delay valid searches. Repair invalid definitions without widening search, then review a durable validation/error state and fair worker pagination in `saved_search_alert_worker.go`. | Open; administrator/worker follow-up. |
| R13 | Cross-job list scale | Medium | Existing interview/offer list APIs and bounded audience pickers do not establish unlimited scale. Add company-scoped cursor/search APIs before promising 1M-record operations across these flows. | Open; current API capacity limit. |
| R14 | Deployment migration | Medium | Migration 55 rebuilds expression indexes transactionally. Measure index-build locks and runtime capacity on a rehearsal copy before authorizing a release. | Release gate; not applied to beta/production. |
| R15 | Outreach initial fetch failure | Medium | Initial upstream failures were converted into empty lists. The route now shows an explicit unavailable state, protects creation during the outage and provides retry. | Fixed locally; synthetic 503 and recovery test passed. |

Immediate: review the local diff and CI, rehearse migration 55, and keep deployment separate. Short term: repair invalid legacy alerts, profile the IT-skill ingestion bottleneck, and add proper pagination/search to large cross-job pickers. Long term: establish a governed entitlement model and production-like concurrency/cross-browser acceptance before commercial gating or scale claims.

## Capability and release limits

- Existing Recruit and Talent access is preserved. A reviewed entitlement/pricing policy is still needed before any commercial gating.
- Private compensation, protected characteristics, disability/defence/category and work-authorization filters remain unavailable unless a reviewed lawful-sharing and audited authorization model exists. Disabled controls do not silently submit values.
- Prompt interpretation, external model APIs, fabricated relevance percentages, similar-candidate engines, calendar integrations and unimplemented offer/feedback/approval systems were not added. The existing approved job matching model remains separate from search relevance.
- Projects are existing recruiter-private tag groups; smart pools are saved criteria. This does not introduce shared project administration, project ACLs or a second candidate database.
- Larger cross-job interview/offer lists and the bounded applicant audience selectors inherit existing API limits. They need proper cursor/search APIs before promising unlimited scale.
- Legacy invalid alert definitions are rejected and logged. A batch dominated by invalid definitions can still require administrative repair to avoid repeated retries; do not enable previously invalid criteria by widening them.
- The earlier local 100k import using normalized IT-skill records exceeded its timeout in the existing taxonomy usage trigger. The successful search-scale fixture uses supported professional key-skill records, without disabling triggers. This does not resolve or certify large IT-skill imports.
- Migration 55 rebuilds expression indexes and adds the professional skill index. It has not run on beta or production. Deployment must review index-build locking, host capacity, the migration ledger and the exact release after CI.
- A new release/deployment is not implied by completing this local review.

## Verification record

| Check | Result / evidence |
|---|---|
| Recruiter/browser regressions | 49 unique active Chromium checks passed across the combined suite and targeted reruns. One old Kanban scenario is intentionally skipped because the approved design uses tables. |
| Page coverage | 17 recruiter areas × seven widths × three device appearances = 357 page captures. Discover has 21 further captures. |
| Drawer coverage | Six major drawer states × seven widths × Light/Dark = 84 captures. Footer visibility and keyboard behavior checked where applicable. |
| Visual gallery | 462 captures across 24 page/drawer states in [recruiter-workspace-gallery.html](recruiter-workspace-gallery.html). |
| Hydration / page errors | Full recruiter matrix passed; job builder/referral additions passed. No error found by the exercised checks. |
| Message contrast | Settled message body colours meet 4.5:1 in the exercised Light/Dark/System fixtures at seven widths. This is a targeted contrast check, not a complete WCAG certification. |
| Appearance | Live System Light↔Dark and explicit Light/Dark ignoring opposite device appearance passed in the messaging regression. |
| Campaign review | No draft-create POST before the explicit Review action; protected draft/create/launch regression passed. |
| Outreach outage | Synthetic upstream 503 shows unavailable rather than empty; retry recovers. |
| Full backend unit suite | PASS — `go test ./...`; the synthetic scanner socket required localhost permission. Optional database suites without their configured fixtures remain skipped. |
| Go recruiter + HTTP suites | Passed, including guarded localhost PostgreSQL owner/company, saved-search count, tag preservation, profile-consent and skill-semantic checks. Other opt-in integration suites without configured fixtures remain skipped. |
| Static checks | TypeScript, Go vet and diff whitespace checks passed. |
| 100k scale fixture | Passed: basic query 492 ms; structured query 465 ms. The isolated database includes retained earlier fixtures; this is a single-run local benchmark, not p95 or live concurrency. |
| 1M / bulk IT-skill ingestion | Not certified. Available workstation memory during browser QA was roughly 1–2 GiB. The earlier IT-skill-record import timed out in the existing taxonomy trigger. |
| Migration rehearsal | Migration 55 down/up succeeded in the isolated database; prior migration files were not edited. No beta/production migration occurred. |
| Production build | PASS — Next production build completed, including TypeScript, static prerendering and the new dynamic recruiter routes. No release was performed. |

Local logs are retained in the owned worktree’s ignored `tmp/` folder: `recruiter-browser-final.log` (46 pass, one transient closed-drawer locator failure, one old Kanban skip); `recruiter-completion-final.log` (six pass, including the corrected campaign check and two extra cases); `recruiter-backend-owner-final.log`; `recruiter-backend-all-final.log`; `recruiter-100k-final.log`; `recruiter-messaging-contrast-final.log`; and `recruiter-production-build.log`. Reruns do not inflate the unique test count. Screenshots are local synthetic fixtures and are ignored by Git; the gallery requires those local artifact files. The Light/Dark page matrix uses System with emulated device appearance, while explicit theme override is checked separately.

A sample of the final page and drawer captures was visually inspected by the engineer. The automated matrix validates all captured states for overflow and exercised errors; it does not mean every pixel of every capture was manually reviewed. No Safari/Firefox/mobile-device, full accessibility, production load, or beta acceptance certification is implied.
