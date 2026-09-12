# Master UI/UX & Frontend Architecture Blueprint — Sapienworx

> **Status: authoritative frontend source of truth.**
>
> All frontend engineering and AI coding-agent work on Sapienworx must follow this document unless a later, explicit product decision supersedes it. Do not create a parallel V3 UI, alternate shell, or another one-off design system.

## 0. Execution guardrails

- Work on `complete-v1` unless explicitly instructed otherwise.
- Do not modify `main` directly.
- Preserve existing backend contracts unless this document explicitly requires a contract migration.
- Never fake an unsupported capability in the UI. If the backend does not support the requested behavior, either implement the backend contract safely or show the capability as unavailable until the contract exists.
- Do not add Google Meet, Microsoft Teams, Zoom, calendar-sync, or third-party scheduling SDK/API integrations. Interview scheduling stores an externally created meeting URL only.
- Do not add external AI/model APIs at the current stage. CV parsing and any AI-ready UI must use the existing local/backend architecture only.
- Preserve DPDP controls, consent evidence, audit trails, role authorization, session security, and official-work-email restrictions where they still apply.

---

## 1. Global system and architecture

### 1.1 One design system

The active application must converge on one semantic design system.

- Remove overlapping global CSS generations and emergency override layers.
- Eliminate all `!important` declarations.
- Use semantic tokens instead of feature-local hex colours.
- CSS Modules are acceptable for component-local layout, but they must consume the shared semantic token layer.
- Do not introduce `v3`, `new-*`, `elite-*`, or another parallel component generation.

Required semantic token groups:

- colour: background, surface, subtle surface, border, strong border, primary text, secondary text, muted text, success, warning, danger
- role accents: candidate/public amber, recruiter indigo, admin neutral ink
- typography: display, UI, data
- spacing scale
- radii
- elevation/shadow
- control heights
- focus ring
- z-index layers
- content widths

### 1.2 Typography

Use only the following families for the main product UI:

- **Space Grotesk** — display headings and major section headings
- **Inter** — body copy, forms, navigation and operational UI
- **IBM Plex Mono** — functional data only: timestamps, IDs, salary/compensation figures, compact metrics and machine-like values

Do not use IBM Plex Mono decoratively.

### 1.3 Responsive modes

Use four canonical responsive modes only:

1. mobile: `<= 639px`
2. tablet: `640px–1023px`
3. desktop: `1024px–1439px`
4. wide: `>= 1440px`

Avoid arbitrary breakpoint proliferation. Component-specific layout changes should resolve into one of these four modes.

### 1.4 Async, empty and failure states

Every API-backed surface must define:

- loading state
- empty state
- filtered-empty state when relevant
- error state with a safe retry path
- disabled/busy state for mutations
- success confirmation for mutations

Never expose Java stack traces, raw queue payloads, infrastructure exception text, SQL text, or unfiltered upstream errors to end users.

Heavy backend work such as CV parsing must show a truthful queued/processing state while Spring Boot and the queue layer continue processing.

---

## 2. Role-based visual separation

### Candidate portal and public website

- accent: `#f2a23b` amber
- consumer-friendly
- mobile-first
- generous spacing
- clear, reassuring privacy copy
- simple task hierarchy

### Recruiter portal

- accent: `#3b3fa6` indigo
- desktop-first while still responsive
- operational and data-dense
- compact tables, filters and bulk actions
- minimal decorative UI

### Master Admin portal

- primary neutral ink: `#15171c`
- no decorative role accent colour
- restrained, procedural and utilitarian
- dense tables and evidence-oriented controls
- destructive/high-impact actions require deliberate confirmation and audit context

---

## 3. Public landing page

The public landing page belongs to the candidate/public visual system.

### Hero search

Provide one bespoke search unit with:

1. Job Title / Skills
2. Experience Range with minimum and maximum values
3. Location

Desktop/tablet may use a horizontal composition. On mobile all search fields and the CTA stack vertically.

### Opportunity modules

- recent jobs: clean row/list presentation, not large marketing cards
- companies: responsive card grid
- Knowledge Hub: 3–4 article cards directly above the footer

The landing page must remain fast, semantic, keyboard accessible and usable without account creation.

---

## 4. Authentication — Email OTP only

### Target experience

Use a Greenhouse-style authentication layout:

- branded side panel as a visual anchor
- single-column centered form
- minimal steps
- clear progress and recovery states

OTP entry must use **six visually distinct digit boxes**, with paste support, numeric input, keyboard backtracking and accessible per-digit labels.

### Contract migration rule

The current repository historically used passwords and, for some candidate/consultant flows, mobile OTP. **Do not simply hide those controls in the frontend while the backend still requires them.**

Email-OTP-only authentication is a cross-stack contract migration. Before removing password/mobile verification from active flows, the implementation must:

- update the Spring Boot authentication contract
- update candidate/recruiter account activation rules
- update database nullability/verification assumptions where necessary
- preserve recruiter official-work-email validation
- update recovery/session logic
- update tests and QA fixtures
- provide a migration-safe path for existing accounts

Until that migration is complete, the frontend must remain truthful about the backend requirement.

### Candidate onboarding

Retain the CV-first profile path.

Parsed CV data must be presented as a candidate-editable proposal, never silently committed. When parser confidence is available, surface it clearly:

- high confidence: normal treatment
- medium confidence: subtle caution
- low confidence: amber warning and explicit review request

If the current parser does not expose field-level confidence, do not invent fake percentages. Add the contract first.

---

## 5. Recruiter portal

### 5.1 Candidate pipeline — strictly no Kanban

Candidate management must use a table-oriented list workflow.

Desktop table columns should prioritise:

- selection checkbox
- candidate name
- title/headline
- skills
- experience
- location
- notice period
- stage
- last active / updated context
- actions

Default page size: **10 candidates**.

Core structured filters:

- Name / keyword
- Title / role
- Skills
- Experience range
- Location
- Notice period

Advanced filters may include company, education, salary, activity, career stage and consent-gated attributes supported by the backend.

Do not create a Kanban toggle.

### 5.2 Bulk actions

Candidate and job lists must support multi-select checkboxes. Selection activates a sticky bulk-action bar for supported actions such as:

- move stage
- bulk message
- supported job status actions

Never show a bulk action if there is no backend endpoint or safe workflow for it.

### 5.3 Interviews

No external scheduling APIs or SDKs.

Recruiter flow:

- choose candidate/application
- choose date/time
- choose duration
- paste external meeting URL
- optional agenda/details if supported
- explicit **Schedule & Notify** action

The candidate receives the stored meeting URL and interview details through Sapienworx notification/email flows.

### 5.4 Communications

Provide:

- backend-backed template library
- create/edit/delete template workflow
- side-by-side template editor
- live merge-field preview
- protected candidate-recipient handoff
- direct application-linked replies

Do not use hard-coded demo templates as the active source of truth.

---

## 6. Candidate portal

### 6.1 Application Hub

Use a clean list, not a complex analytics dashboard.

Each application should show progress with either:

- horizontal stepper on sufficiently wide screens, or
- vertical timeline where space is constrained

Progress must be based on real application stage data.

### 6.2 Unified inbox

Direct recruiter messages and system/application updates belong in one inbox surface with filter tabs.

Recommended tabs:

- Messages
- Application updates
- Interview updates, if the backend exposes them independently

Do not duplicate the same notification into multiple competing inbox experiences.

### 6.3 Interviews

Candidates must be able to:

- view upcoming/past/cancelled interview details
- open the recruiter-supplied external meeting URL
- download an `.ics` calendar file
- message the recruiter

Do not require live Google/Microsoft calendar sync.

---

## 7. Master Admin portal

### 7.1 Team & access

The target model is granular permission-based sub-admin access, not broad all-or-nothing roles.

The UI must eventually support:

- invite colleague
- display name
- work email
- granular permission picker
- active/inactive state
- last sign-in
- permission review
- revoke access
- high-impact changes through approval/audit controls

### Contract migration rule

The current backend exposes role-derived permission sets. A frontend-only permission picker would be cosmetic and is forbidden.

Before enabling editable granular permissions, the backend must support persisted permission assignments (or an equivalent policy model) and enforce them at API boundaries. Until then, show existing permissions truthfully and do not expose a fake invite/save control.

### 7.2 Governance tables

Tenants, administrators, active sessions and other governance datasets should use dense, paginated tables.

Controlled horizontal scrolling is acceptable on tablet for admin data tables. It must be scoped to the table container—never globally mask overflow on the document body.

---

## 8. Accessibility and interaction quality

- one `h1` per page; logical heading order
- visible keyboard focus
- every input has a programmatic label
- `aria-live` or status roles for async mutation feedback where appropriate
- semantic table markup for operational data
- accessible dialogs with focus containment and clear cancel/confirm actions
- no colour-only state communication
- 44px minimum interactive target for normal controls
- respect reduced-motion preference

---

## 9. Implementation order

1. Audit active route/import tree and CSS ownership
2. Consolidate semantic tokens and shared primitives
3. Remove duplicate global CSS generations only after selector ownership is proven
4. Public landing/auth shell
5. Recruiter pipeline/table and bulk-action grammar
6. Recruiter interviews and communications
7. Candidate application/inbox/interview flows
8. Master Admin Team & access and governance tables
9. Remove dead/legacy UI after branch-specific import proof
10. Responsive/a11y QA
11. Typecheck/build/e2e verification

---

## 10. Current repository alignment snapshot

As of the `complete-v1` frontend audit following commit `Fix rebuild v2`:

### Already aligned or substantially aligned

- Space Grotesk / Inter / IBM Plex Mono are already loaded globally.
- Candidate/public amber, recruiter indigo and admin ink token families already exist.
- Public landing already contains the three-part job search, recent-job list, company grid and Knowledge Hub placement.
- Six-box OTP input UI already exists.
- Candidate applications already use a list plus real stage progress.
- Candidate inbox already combines direct messages and application updates through tabs.
- Candidate interviews already use external meeting URLs and expose a calendar-download endpoint instead of live calendar sync.
- Recruiter interview scheduling already uses external URLs and `Schedule & Notify` wording.
- Recruiter communications now use backend-backed template CRUD and candidate context rather than demo templates.

### Must still be migrated

- Global styling is still loaded through multiple historical CSS files; consolidate carefully instead of deleting selectors blindly.
- Recruiter pipeline should move from card-heavy desktop rendering to a semantic table-oriented workflow while retaining compact mobile rendering.
- Email-OTP-only authentication requires a real backend/data migration before password/mobile requirements can be removed.
- Master Admin granular sub-admin permissions require persisted backend permission enforcement before an editable permission picker/invite workflow can be enabled.
- Dense admin tables and pagination should replace remaining free-form operational lists where backend datasets justify them.

---

## 11. Definition of Done

The rebuild is complete only when:

- active UI uses one coherent semantic token system
- no active V1/V2/V3 visual generations conflict at runtime
- no `!important` declarations remain
- public/candidate/recruiter/admin role identities are visually distinct but structurally coherent
- four responsive modes are used consistently
- recruiter pipeline is table/list only, never Kanban
- recruiter interviews remain external-link based
- communications use persisted templates and real recipient context
- candidate applications, inbox and interviews are simple, mobile-first and truthful
- admin permissions are persisted and enforced, not cosmetic
- email-only OTP is implemented end-to-end before old auth requirements are removed
- loading/empty/error states are consistent and safe
- keyboard and screen-reader fundamentals pass manual QA
- TypeScript typecheck, production build, backend verification and relevant e2e tests pass
