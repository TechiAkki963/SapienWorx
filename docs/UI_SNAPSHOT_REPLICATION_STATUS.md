# SapienWorx UI Snapshot Replication Status

This document maps the Stitch reference library in `docs/ui_ux_design/stitch_app_ui_ux_design/` to the production Next.js routes and components on `main`.

The screenshots and paired `code.html` files are **visual references**, not a second application. Production routes keep the real SapienWorx API contracts, permissions, privacy controls, pagination, audited PII reveal, and interview-link model.

## Visual baseline

The shared implementation follows `portal_intelligence/DESIGN.md`:

- pale blue/slate application canvas with white surfaces;
- professional blue as the primary interactive colour;
- deep navy text and low-contrast slate dividers;
- compact, data-dense Recruiter and Master Admin workspaces;
- calmer, transparency-first Candidate surfaces;
- thin borders and very soft depth instead of heavy shadows;
- compact tables with text + status indicators;
- 32px-equivalent desktop page rhythm, responsive mobile reflow;
- no visual-only feature that bypasses a backend permission or state model.

The shared theme is implemented in `app/reference-snapshot-theme.css` and is loaded after the existing production style layers.

## Candidate portal

| Reference snapshot | Production route / surface | Replication status |
| --- | --- | --- |
| Candidate Registration - Signup | `/register` candidate flow | Shared snapshot theme applied; preserve OTP/auth contract. |
| Candidate Registration - Resume Upload & Consent | `/candidate/onboarding` | Mapped; retain explicit consent and parser fallback. |
| Candidate Dashboard - Onboarding | `/candidate` | Mapped to the real candidate home rather than a duplicate onboarding dashboard. |
| Candidate - Confirmation & Profile Setup | `/candidate/onboarding`, `/candidate/profile` | Consolidated into onboarding + profile. |
| Candidate - Edit Profile & Portfolio | `/candidate/profile` | Mapped to production profile editor. |
| Candidate - Resume Parser Review (Split-screen) | `/candidate/review` | Mapped; split-review reference is the target desktop composition. |
| Candidate - Resume Parser Review | `/candidate/review` | Same production review route; do not create a second parser UI. |
| Sapienworx Landing Page | `/` | Existing public surface; snapshot theme is shared where compatible. |
| Sapienworx - External Job Board | `/jobs` | Mapped to public job board. |
| Sapienworx - All Jobs & Knowledge Hub | `/jobs`, `/knowledge` | Split into focused production routes. |
| Candidate - Job Search & Recommendations | `/candidate/jobs` | Mapped. Recommendations must use available production signals only. |
| Candidate - Fixed Job Search & Recommendations | `/candidate/jobs` | Design variant of the same route. |
| Candidate - Redesigned Job Search & Recommendations | `/candidate/jobs` | Latest visual variant informs the same route. |
| Candidate - Detailed Job View | `/jobs/[jobId]/[slug]` | Mapped to public/candidate-safe job detail. |
| Candidate - Job Details View | `/jobs/[jobId]/[slug]` | Design variant of job detail. |
| Sapienworx - Public Job Listing | `/jobs/[jobId]/[slug]` | Mapped. |
| Candidate - Job Application Form | public job apply flow | Keep registered/guest behavior attached to the real job surface. |
| Candidate - Application (Registered) | public job apply flow | Consolidated application state. |
| Candidate - Application (Guest Upload) | public job apply flow | Consolidated guest application state. |
| Candidate - Application (OTP Verification) | application/auth flow | Retain real OTP verification rather than a visual-only step. |
| Candidate - Application Submission Success | application success state | In-flow success state; no duplicate route required. |
| Candidate - Job Application Status Tracker | `/candidate/applications` | Mapped to compact expandable application timeline. |
| Candidate - Message Center & Communications | `/candidate/messages` | Unified recruiter + system inbox already implemented; snapshot styling target. |
| Candidate - Confirm Interview Invitation | `/candidate/interviews` | Adapted to real interview model. No unsupported confirmation state is invented. |
| Candidate - Confirm Interview Invitation (Manual Link) | `/candidate/interviews` | External meeting URL only; no Meet/Teams SDK integration. |
| Candidate - Interview Feedback Notification | `/candidate/messages`, notifications | Consolidated into communication/notification surfaces. |

## Recruiter portal

| Reference snapshot | Production route / surface | Replication status |
| --- | --- | --- |
| Recruiter Dashboard - Analytics | `/recruiter` | Bento/dashboard reference applied to real operational metrics. |
| Recruiter - Personal Profile & Experience | recruiter settings/profile surface | Preserve actual account/profile contract. |
| Recruiter - Job Center & Management | `/recruiter/jobs/manage` | Mapped to dense job operations table. |
| Recruiter - Create New Job | `/recruiter/jobs` | Mapped. |
| Recruiter - Create Job with Live Preview | `/recruiter/jobs` | Same create-job workflow; preview is a progressive panel, not a parallel route. |
| Recruiter - Candidate Search Database | `/recruiter/sourcing` | Mapped to privacy-safe sourcing/search. |
| Recruiter - Candidate Management List View | `/recruiter/pipeline`, `/recruiter/candidates` | Table-first management; no Kanban. |
| Recruiter Pipeline - Management | `/recruiter/pipeline` | Mapped. |
| Recruiter Pipeline - List View | `/recruiter/pipeline` | Design variant of the same production route. |
| Recruiter Pipeline - Detailed List View | `/recruiter/pipeline` | Design variant; detail opens from table/workspace. |
| Recruiter - Candidate Profile Detail View | `/recruiter/candidates/[candidateId]`, job applicant detail | Mapped; PII stays masked until audited reveal. |
| Recruiter - Candidate Profile with Projects & Coding Links | candidate detail surface | Consolidated into candidate detail profile. |
| Recruiter - Message Center & Communications | `/recruiter/communications` | Mapped. |
| Recruiter - Message Center & Templates | `/recruiter/communications` | Consolidated into communication workspace. |
| Recruiter - Calendar & Interview Management | `/recruiter/interviews` | Mapped. |
| Recruiter - Schedule Interview | interview scheduling flow | External meeting URL is stored/sent; no provider SDK. |
| Recruiter - Schedule Interview (Manual Link) | interview scheduling flow | This reference matches the current production integration boundary. |
| Recruiter - Interview Feedback & Evaluation | interview/candidate detail workspace | Mapped to real evaluation data only. |

## Master Admin portal

| Reference snapshot | Production route / surface | Replication status |
| --- | --- | --- |
| Master Admin - Platform Overview | `/admin` | Mapped to live platform health and guarded controls. |
| Master Admin - Organizations & Users Management | `/admin#users`, `/admin#governance` | Consolidated into real cross-tenant access and governance views. |
| Master Admin - Organization Settings & Platform Defaults | `/admin#governance`, `/admin#advanced` | Mapped to enforced settings only. |
| Master Admin - Parser Monitoring & Operations | `/admin#operations` | Mapped to queue/parser operations metadata; raw CV content remains protected. |
| Master Admin - Billing & Subscription Management | `/admin#advanced` | Visual reference only where production billing capabilities exist; no fake billing controls. |
| Master Admin - Grievance Redressal & Privacy Requests | `/admin#support` | Mapped to support tickets + DPDP privacy cases. |
| Master Admin - System Audit Logs | `/admin#assurance` | Mapped to immutable audit evidence. |
| Master Admin - System Health Dashboard | `/admin`, `/admin#operations` | Mapped to live platform/queue health. |

## Intentional differences from the mockups

1. **No fake data or unsupported KPIs.** Reference-only values such as a mocked average time-to-hire are not displayed unless the backend exposes a trustworthy value.
2. **No fake interview confirmation state.** Current interview status supports the production states already modeled by the backend. The UI does not invent `AWAITING_CONFIRMATION`.
3. **No Google Meet / Microsoft Teams API or SDK integration.** Interview scheduling stores an externally created meeting URL, sends it to the candidate, and opens that URL when Join is selected.
4. **No external AI/model API.** Parser and matching UI must represent the current production capabilities truthfully.
5. **Candidate contact data remains protected.** Sourcing results do not expose contact values; recruiter reveal remains job-contextual and audited.
6. **Search rank is not a probability.** PostgreSQL retrieval rank must not be presented as an AI fit percentage.
7. **Master Admin controls remain permission-backed.** A control from a Stitch mockup is not exposed unless the backend persists and enforces it.
8. **Purpose-limited investigation access remains 15 minutes and separately audited.** The reference styling must not weaken the existing privacy boundary.

## Reference asset caveat

Several `screen.png` files in the Stitch directory are tiny placeholder files rather than usable screenshots. For those screens, the paired `code.html` is the authoritative layout reference. Valid PNG snapshots and `code.html` are treated together as one design source.

## Next visual acceptance pass

Every mapped route should be reviewed at desktop and mobile sizes against its reference family. Acceptance should check shell/navigation, page rhythm, surface colour, typography hierarchy, table/list density, status treatment, empty/loading/error states, and whether all visible actions remain backed by real production capabilities.
