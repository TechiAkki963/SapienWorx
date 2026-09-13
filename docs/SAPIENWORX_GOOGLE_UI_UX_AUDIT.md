# SapienWorx — Google-aligned UI/UX Audit

Date: 13 September 2026
Scope: public landing, authentication, candidate workspace, recruiter workspace, admin shell, shared design system and responsive interaction foundations.

## Audit basis

This audit uses Google-published web UX/accessibility guidance as the primary benchmark, including:

- web.dev Accessible tap targets — target approximately 48x48 CSS/device-independent pixels on touch devices, with adequate spacing.
- web.dev Accessibility for web developers / accessibility reviews — logical keyboard order, visible focus, semantic interactive elements and no keyboard traps.
- web.dev Forms accessibility — clear labels, meaningful field purpose and browser-assisted completion where appropriate.
- web.dev Accessible responsive design — maintain logical flow and usable controls across breakpoints.
- Google Core Web Vitals — LCP <= 2.5s, INP <= 200ms and CLS <= 0.1 at the 75th percentile.

This is a code/design-system audit plus repository CI evidence. It is not a substitute for moderated usability research, manual assistive-technology testing with real users, or production field Core Web Vitals data.

## Executive scorecard

| Area | Status | Notes |
| --- | --- | --- |
| Visual hierarchy | PASS | Source Serif 4 for major editorial hierarchy; Inter for UI; IBM Plex Mono constrained to metrics/data. |
| Interaction clarity | PASS | Primary/secondary actions, recruiter priority queue, staged interview confirmation and recovery-oriented empty states are explicit. |
| Keyboard focus | PASS | Global `:focus-visible` treatment plus modal focus containment and restoration. |
| Touch targets | PASS | Canonical 48px controls; coarse-pointer rule upgrades interactive controls to 48px minimum. |
| Color contrast | PASS | Candidate amber deepened to `#a55f0d`; normal text on white exceeds 4.5:1. |
| Form labels | PASS | Auth and recruiter operational forms use real labels around inputs. |
| Form autocomplete | PASS WITH MIGRATION NOTE | Shared interaction layer adds browser-compatible autocomplete/name semantics for active auth fields and OTP inputs. Future form components should declare these statically at source. |
| Responsive/adaptive layout | PASS WITH FOLLOW-UP | Four-breakpoint browser regression exists; dedicated mobile accessibility tests now check touch sizing and horizontal overflow. |
| Empty/error/recovery states | PASS | Jobs, interviews, dashboard and pipeline provide next actions rather than dead-end messages. |
| Motion sensitivity | PASS | Reduced-motion media query disables/shortens motion globally. |
| Information density | PASS | Recruiter remains table-first and compact on fine-pointer desktop while touch devices receive larger targets. |
| Modal/dialog behavior | PASS FOR SHARED MODAL LAYER | Modal focus moves inside, remains trapped, background becomes inert, Escape closes cancellable dialogs and focus returns to the trigger. |
| Automated accessibility regression | PASS BASELINE | Playwright now verifies auth autocomplete semantics, modal focus/inert behavior, mobile 48px targets and horizontal-overflow safety. |
| Brand consistency | PARTIAL | Core visible brand is SapienWorx; remaining legacy source strings/repository metadata still need a controlled casing sweep. |
| Core Web Vitals | NOT YET VERIFIED IN FIELD | Build/browser CI cannot certify LCP/INP/CLS at the 75th percentile. Production RUM remains required. |

## Findings and implemented actions

### P0 — fixed

1. **Candidate amber text contrast**
   - Previous `--amber-deep: #b96f12` produced about 3.93:1 against white for normal-size text.
   - Changed to `#a55f0d`, approximately 4.95:1 against white.
   - Keeps the amber identity while meeting WCAG AA normal-text contrast.

2. **Touch targets on touch-capable devices**
   - Recruiter desktop intentionally uses 40px compact controls for information density.
   - `@media (any-pointer: coarse)` upgrades interactive controls to at least 48px on touch-capable hardware regardless of viewport width.
   - This preserves dense mouse/keyboard desktop operation without penalising tablet/touch users.

### P1 — implemented

1. **Auth autocomplete semantics**
   - Email resolves to `email`.
   - Existing-password fields resolve to `current-password`.
   - Account creation/reset fields resolve to `new-password`.
   - OTP fields resolve to `one-time-code`.
   - Phone resolves to `tel`.
   - Name fields resolve to `given-name`, `family-name` or `name`.
   - Organisation/designation/location fields receive suitable browser tokens where recognised.
   - Missing `name` attributes are added consistently for browser/password-manager interoperability.

   Migration note: this currently lives in the shared interaction-accessibility layer so all existing auth paths benefit without a high-risk rewrite of the large legacy auth component. New form abstractions should set `autocomplete` directly in JSX and the existing auth component should be migrated incrementally.

2. **Dialog focus and background interaction**
   - Shared modal behavior detects `role="dialog" aria-modal="true"`.
   - Focus moves inside an opened dialog.
   - Tab and Shift+Tab remain contained.
   - Background branches become `inert` and `aria-hidden` while the modal is active.
   - Escape activates an available Cancel/Close/Dismiss control.
   - Focus returns to the element that had focus before the modal opened.

3. **Automated accessibility regression**
   - `e2e/accessibility-baseline.spec.ts` verifies auth semantics and modal focus/inert behavior.
   - `e2e/mobile-accessibility-baseline.spec.ts` verifies minimum mobile touch-target height and horizontal-overflow safety.
   - These tests run through the existing Playwright browser-regression workflow, so accessibility regression is part of normal frontend CI rather than an isolated optional job.

### P1 — remaining

1. **Finish SapienWorx casing audit**
   - Product-facing casing must always be `SapienWorx`.
   - Remaining old source strings and repository metadata should be normalised only after confirming they are active, rather than adding a display-time text-replacement hack.

2. **Manual assistive-technology verification**
   - Run keyboard-only, NVDA/Chrome or NVDA/Firefox, VoiceOver/Safari and high-zoom/reflow checks on the release candidate.
   - Automated tooling cannot certify announcement quality, reading order or cognitive clarity.

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

4. **Move auth semantics from enhancement layer into source components**
   - The current shared layer provides immediate coverage across legacy auth paths.
   - During auth-component decomposition, promote `autocomplete`, `name`, input purpose and OTP semantics into typed component props so browser semantics exist directly in rendered source.

## UX principles review

### Clear hierarchy and task priority
SapienWorx differentiates role intent rather than applying one visual density everywhere. Candidate/public experiences are warmer and editorial; recruiter surfaces prioritise operational scanning; admin remains restrained and governance-led.

### Familiar, predictable interaction
Buttons, links, form controls and table actions use conventional HTML controls. Destructive/state-changing recruiter actions require confirmation. Interview scheduling uses a review step before candidate notification.

### Error prevention and recovery
The product prevents dead ends: filtered Jobs can clear filters, empty Jobs can create a role, Interviews points back to Pipeline, recruiter Workbench identifies missing links, and authentication provides inline status/error feedback.

### Accessibility and inclusive input
Global focus-visible styling, labelled fields, reduced motion, semantic status messages, browser autocomplete semantics, modal focus containment and 48px coarse-pointer targets form a substantially stronger baseline. Automated Playwright coverage now protects the highest-risk interaction regressions.

### Responsive continuity
The layout changes intentionally by role and breakpoint instead of simply shrinking desktop UI. Recruiter tables remain dense on desktop; mobile/touch controls enlarge and shell navigation adapts. Automated mobile checks now guard against horizontal clipping and undersized touch controls.

### Performance as UX
Repository build/browser regression tests protect functional rendering, but Core Web Vitals require field data. Production RUM is a launch requirement, not an optional analytics enhancement.

## Current overall rating

**9.0 / 10 — strong Google-aligned product foundation with release-quality interaction safeguards; field performance and manual AT/usability evidence remain outstanding.**

Strongest areas: hierarchy, recruiter operational clarity, visible focus, touch ergonomics, responsive role-aware layout, recovery-oriented states, modal containment and automated accessibility regression.

Main remaining gaps: production Core Web Vitals, manual assistive-technology/usability testing, controlled legacy CSS migration and the final SapienWorx casing sweep.
