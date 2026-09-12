# SapienWorx Full-Stack UI/UX Rebuild Directive

Status: **Authoritative UI/UX implementation directive**

Target branch: `complete-v1`

This directive extends the existing `app/ui-v1.css` design foundation. It does **not** create a parallel V2/V3 design system.

## 1. Non-negotiable global rules

### Token-driven styling

All new and migrated UI must use the canonical variables defined by `app/ui-v1.css`, including:

- `--amber`, `--amber-deep`, `--amber-tint`, `--amber-ink`
- `--indigo`, `--indigo-deep`, `--indigo-soft`, `--indigo-tint`
- `--ink`, `--ink-soft`, `--muted`
- `--paper`, `--cloud`, `--line`
- `--good`, `--warn`
- spacing, radii and font variables

Hard-coded presentation colours must not be introduced in components or feature stylesheets. Literal colour definitions belong only in the canonical token layer.

### Typography

- Headings: Space Grotesk, `letter-spacing: -0.01em`
- Standard interface copy: Inter
- Functional values / metrics / IDs / machine-like data: IBM Plex Mono

### Shared primitives

Prefer canonical reusable patterns rather than one-off variants. Current canonical migration primitives live in `components/ui-v1-primitives.tsx` and cover:

- row/list item
- empty state
- explainable match chip set
- connected status stepper

Extend these primitives when a pattern is genuinely shared; do not duplicate them per portal.

### Language

Visible interface copy uses British English where the spelling differs, including `Organisation`, `Authorisation`, `Optimise`, `Visualise`, `Colour`, and `Personalise`.

### Accessibility

- Interactive targets are at least 44px where appropriate.
- Keyboard focus remains visible.
- Status is never communicated by colour alone.
- Reduced-motion preferences must disable non-essential transition animation.
- Forms require labels and meaningful validation/error states.

## 2. Public experience

Visual character: warm, accessible, candidate-oriented, amber-led.

### `/`

The landing hero includes a three-part role search:

1. Job title / skills
2. Experience range
3. Location

On mobile (<=639px), fields stack vertically. The primary search action remains obvious and full-width; sticky treatment is acceptable where it does not obscure content.

### `/jobs`

- Recent roles use concise hairline rows or compact list cards.
- Anonymous users do not see candidate-specific match scores or explainability chips.
- Role facts must be transparent and scannable: location, workplace model, experience, employment type, compensation when provided.

### `/knowledge`

An editorial preview of 3–4 useful articles should appear immediately above the public footer to support discovery and organic acquisition.

## 3. Authentication

### Candidate

Routes: `/login`, `/register`

- single-column form
- amber-tinted branded panel
- calm candidate-oriented privacy and verification copy

### Recruiter

Routes: `/recruiter/login`, `/recruiter/register`

- single-column form
- indigo-tinted branded panel
- official work-email rules remain enforced by the actual authentication contract

### Admin

Route: `/admin/login`

- neutral/ink presentation
- centered utilitarian form
- no candidate/recruiter marketing panel

### Verification

Where the backend/authentication contract requires email or mobile OTP, render a six-cell digit-entry experience.

Do not remove existing security requirements merely to match a visual composition. Authentication changes must be end-to-end.

## 4. Candidate portal

Visual character: frictionless, mobile-first, amber-led.

### `/candidate`

Dashboard hierarchy:

1. Application summary: Total applications, Active process, Interviews scheduled, Offers received
2. If there are no applications, replace zero metrics with an action-oriented empty state
3. Next action when an interview or other actionable event exists
4. Active applications
5. Profile strength / recruiter visibility / privacy context

The dashboard should behave like a career workspace, not an analytics console.

### `/candidate/jobs`

Desktop target:

- persistent left filter rail
- compact middle results list
- selected-job detail panel

Mobile target:

- filter rail becomes a bottom sheet
- selected job becomes a dedicated detail view or stacked region
- primary application action remains easy to reach

Explainable matching may render only for signed-in candidates and only when trustworthy match data exists. Do not manufacture AI scores or confidence.

Quick Apply appears only when the candidate profile meets the agreed completeness threshold (currently >=70%) and the backend application contract supports the action. `Applied ✓` is shown only after successful mutation.

### `/candidate/applications`

Canonical stage treatment:

- completed: filled amber circle + checkmark
- current: amber ring + solid inner dot
- upcoming: neutral outline
- connector fill transition: approximately 400ms left-to-right on genuine stage advancement
- reduced-motion preference disables the animation

Existing timeline, interview and offer-response behaviour must be preserved during visual migration.

### `/candidate/profile`

Edit Personal Information, Skills and Experience independently with explicit section-level save actions.

CV parsing is always candidate-reviewed before persistence. Confidence indicators may only be displayed when backed by real extraction confidence data:

- high: positive treatment
- low: expanded amber warning requiring review

No parsed data may be silently committed.

## 5. Recruiter portal

Visual character: desktop-first, high-density, indigo-led.

### `/recruiter`

`Needs attention` appears before secondary dashboard widgets and includes actionable operational items such as:

- stalled candidates
- interviews awaiting confirmation
- expiring offers
- applications needing review

### `/recruiter/sourcing`

- persistent advanced filtering rail on desktop
- clear filter state and removal
- protected attributes such as gender, disability and marital status must never be exposed as filterable, sortable or rankable criteria

### `/recruiter/pipeline`

- table-first, not Kanban
- 10 records by default
- sortable columns
- multi-select checkboxes
- contextual bulk-action bar
- permitted bulk actions may include stage movement and messaging

### `/recruiter/interviews`

Current-stage integration rule:

- recruiter pastes an externally created meeting URL
- SapienWorx stores and sends the URL
- candidate can open the external meeting link
- `.ics`/calendar support may be provided
- no Google Meet, Microsoft Teams or Zoom API/SDK integration is introduced at this stage

`Schedule & Notify` must be explicit and confirmable.

## 6. Master Admin portal

Visual character: data-dense, neutral, ink-led. Accent colours are avoided.

### Users and access

- dense paginated table
- name, email, role and permissions visible
- tablet horizontal scrolling is acceptable for dense governance tables

### Sub-admin provisioning

Use `Invite admin` with granular permission toggles rather than relying only on broad rigid roles.

Permissions are enforced server-side; UI toggles are not an access-control boundary.

### Purpose-limited investigation

Required flow:

1. select purpose: support / security / compliance
2. enter a reason
3. request temporary access
4. server records purpose and reason
5. server authorises a restricted investigation session
6. access expires after 15 minutes
7. expiry and investigation activity are written to audit logs

The 15-minute window must be server enforced. A client-side countdown is display-only.

## 7. AI and trust guardrails

At the current product stage, no external AI/model API integration is introduced.

UI components may be future-ready for:

- resume parsing confidence
- semantic search
- match score explanations

but they render only when supported by real application/backend data.

Never fabricate:

- match percentages
- confidence values
- candidate ranking explanations
- recruiter recommendations presented as AI output

## 8. Migration order

### Phase 1 — foundation and candidate home

- canonical primitives
- candidate dashboard
- shell consistency

### Phase 2 — candidate journey

- jobs + job detail
- applications status treatment
- interview experience
- unified inbox
- profile/CV review

### Phase 3 — public and authentication

- public landing/search
- public jobs
- knowledge preview
- candidate/recruiter/admin auth visual consolidation

### Phase 4 — recruiter workspace

- needs-attention workbench
- sourcing filter rail
- table pipeline + bulk actions
- external-link interview scheduling UX

### Phase 5 — admin governance

- users/access tables
- granular admin permissions
- purpose-limited investigation UI paired with server enforcement

## 9. Definition of done for migrated screens

Every API-backed migrated surface handles:

- loading
- empty
- filtered empty
- error + retry
- disabled/busy mutation state
- successful mutation feedback

Migration must preserve existing backend behaviour unless the implementation task explicitly includes the associated backend contract change.
