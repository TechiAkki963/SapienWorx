# SapienWorx — Google-aligned UI/UX Audit

Date: 13 September 2026
Scope: public landing, authentication, candidate workspace, recruiter workspace, admin shell, shared design system and responsive interaction foundations.

## Audit basis

This audit uses Google-published web UX/accessibility guidance as the primary benchmark, including:

- web.dev Accessible tap targets — target approximately 48x48 CSS/device-independent pixels on touch devices, with adequate spacing.
- web.dev Accessibility for web developers / accessibility reviews — logical keyboard order, visible focus, semantic interactive elements and no keyboard traps.
- web.dev Forms accessibility — clear labels and understandable field purpose.
- web.dev Accessible responsive design — maintain logical flow and usable controls across breakpoints.
- Google Core Web Vitals — LCP <= 2.5s, INP <= 200ms and CLS <= 0.1 at the 75th percentile.

This is a code/design-system audit plus repository CI evidence. It is not a substitute for moderated usability research, assistive-technology testing with real users, or production field Core Web Vitals data.

## Executive scorecard

| Area | Status | Notes |
| --- | --- | --- |
| Visual hierarchy | PASS | Source Serif 4 for major editorial hierarchy; Inter for UI; IBM Plex Mono constrained to metrics/data. |
| Interaction clarity | PASS | Primary/secondary actions, recruiter priority queue, staged interview confirmation and recovery-oriented empty states are explicit. |
| Keyboard focus | PASS | Global `:focus-visible` treatment plus component-level focus states. |
| Touch targets | PASS after audit fix | Canonical 48px controls; coarse-pointer rule now upgrades interactive controls to 48px minimum. |
| Color contrast | PASS after audit fix | Candidate amber deepened to `#a55f0d`; normal text on white now exceeds 4.5:1. |
| Form labels | PASS | Auth and recruiter operational forms use real `<label>` elements around inputs. |
| Responsive/adaptive layout | PASS WITH FOLLOW-UP | Four-breakpoint automated regression exists; continue checking DOM/tab order whenever responsive visual order changes. |
| Empty/error/recovery states | PASS | Jobs, interviews, dashboard and pipeline provide next actions rather than dead-end messages. |
| Motion sensitivity | PASS | Reduced-motion media query disables/shortens motion globally. |
| Information density | PASS | Recruiter remains table-first and compact on fine-pointer desktop while touch devices receive larger targets. |
| Brand consistency | PARTIAL | Core visible brand is SapienWorx; repository/auth legacy strings still require a full casing sweep. |
| Form autocomplete | NEEDS IMPROVEMENT | Shared auth field abstraction does not currently expose `autocomplete`; add semantic tokens for email, current-password, new-password, one-time-code, name, tel, organisation fields. |
| Core Web Vitals | NOT YET VERIFIED IN FIELD | Build/browser CI is useful but cannot certify LCP/INP/CLS at the 75th percentile. Add RUM/web-vitals telemetry before production launch. |
| Screen-reader/modal focus | PARTIAL | Semantic labels/status roles are present. Guarded dialogs should receive explicit focus-trap/inert verification in automated + manual AT tests. |

## Findings and actions

### P0 — fixed during this audit

1. **Candidate amber text contrast**
   - Previous `--amber-deep: #b96f12` produced about 3.93:1 against white for normal-size text.
   - Changed to `#a55f0d`, approximately 4.95:1 against white.
   - Keeps the amber identity while meeting WCAG AA normal-text contrast.

2. **Touch targets on touch-capable devices**
   - Recruiter desktop intentionally uses 40px compact controls for information density.
   - Added `@media (any-pointer: coarse)` so interactive controls resolve to at least 48px on touch-capable hardware regardless of viewport width.
   - This preserves dense mouse/keyboard desktop operation without penalising tablet/touch users.

### P1 — next implementation priorities

1. **Add `autocomplete` semantics to shared auth fields**
   - Email: `email`
   - Current password: `current-password`
   - New password: `new-password`
   - OTP: `one-time-code`
   - Phone: `tel`
   - Name fields: `given-name`, `family-name`, `name`
   - Organisation: `organization`
   This improves speed, error reduction and password-manager compatibility.

2. **Finish SapienWorx casing audit**
   - Product-facing casing must always be `SapienWorx`.
   - Legacy repository description and old auth strings should be normalised where still active.

3. **Dialog focus/inert verification**
   - Verify focus moves into every modal/dialog when opened, remains contained while blocking interaction, Escape/close works where appropriate, and focus returns to the initiating control.
   - Ensure background content is inert while guarded dialogs are active.

4. **Add automated accessibility checks to browser CI**
   - Add axe-core/Playwright accessibility smoke tests for public landing, auth, candidate home, recruiter workbench/pipeline and admin access.
   - Keep manual keyboard and screen-reader verification because automated tooling cannot catch all UX issues.

### P2 — production-quality enhancements

1. **Real-user Core Web Vitals monitoring**
   - Capture LCP, INP and CLS in production.
   - Targets: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 at p75 for mobile and desktop.

2. **Usability testing by role**
   - Candidate: find job -> evaluate -> apply -> track application.
   - Recruiter: identify priority -> review candidate -> move stage -> schedule interview.
   - Admin: investigate access -> justify sensitive action -> review audit evidence.
   Measure completion rate, time on task, recovery from errors and comprehension.

3. **Continue global CSS migration**
   - `complete-v1.css` still carries active and legacy selectors together.
   - Migrate active recruiter/job/admin rules to component scopes or canonical role layers before deleting the file.
   - Do not replace it with another late override stylesheet.

## UX principles review

### Clear hierarchy and task priority
SapienWorx now differentiates role intent rather than applying one visual density everywhere. Candidate/public experiences are warmer and editorial; recruiter surfaces prioritise operational scanning; admin remains restrained and governance-led.

### Familiar, predictable interaction
Buttons, links, form controls and table actions use conventional HTML controls. Destructive/state-changing recruiter actions require confirmation. Interview scheduling uses a review step before candidate notification.

### Error prevention and recovery
The product increasingly prevents dead ends: filtered Jobs can clear filters, empty Jobs can create a role, Interviews points back to Pipeline, recruiter Workbench identifies missing links, and authentication provides inline status/error feedback.

### Accessibility and inclusive input
Global focus-visible styling, labelled fields, reduced motion, semantic status messages and 48px coarse-pointer targets form a sound baseline. Remaining work is focused on autocomplete semantics, dialog focus verification and automated accessibility regression coverage.

### Responsive continuity
The layout changes intentionally by role and breakpoint instead of simply shrinking desktop UI. Recruiter tables remain dense on desktop; mobile/touch controls enlarge and shell navigation adapts. Continue validating that visual reordering never diverges from DOM/tab order.

### Performance as UX
Repository build/browser regression tests protect functional rendering, but Core Web Vitals require field data. Production RUM is a launch requirement, not an optional analytics enhancement.

## Current overall rating

**8.4 / 10 — strong product foundation, not yet release-complete for Google-quality UX assurance.**

Strongest areas: hierarchy, recruiter operational clarity, accessible focus, responsive role-aware layout, design-system consistency and recovery-oriented empty states.

Main remaining gaps: autocomplete semantics, automated accessibility CI, dialog focus/inert verification, legacy CSS migration and real-user Core Web Vitals.
