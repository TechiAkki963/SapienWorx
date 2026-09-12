# SapienWorx Canonical Design Direction

This document is the canonical design direction for SapienWorx.

## Product design philosophy

SapienWorx should feel human, focused, structured and trustworthy. The public and candidate experiences take inspiration from Greenhouse's people-first editorial polish and thoughtful minimalism, while recruiter workflows preserve the information density and search efficiency expected from products such as Naukri. The product must remain distinctly SapienWorx rather than visually cloning another platform.

## Typography

- Brand/editorial headlines: Merriweather, regular weight.
- Product/UI typography: Nunito Sans, primarily regular, medium and semibold.
- Functional metrics, identifiers, timestamps and dense data: IBM Plex Mono.
- Default body size: 16px.
- Operational metadata may use 13–14px where density genuinely matters; primary UI text should not be reduced below 14px.
- Public and Candidate experiences may use Merriweather selectively for major page titles and editorial moments.
- Recruiter and Admin workspaces should remain overwhelmingly sans-serif, with IBM Plex Mono used only for data.

## Visual identity

- Candidate: warm amber, calm, editorial, transparent and career-oriented.
- Recruiter: indigo, structured, high-density, operational and action-first.
- Admin: neutral ink/grey, governance-first and intentionally restrained.
- Preserve the SapienWorx amber/indigo identity.
- Use section backgrounds and whitespace before adding decorative cards.
- Cards are reserved for genuinely self-contained units such as jobs, applications, interviews, candidates, scorecards, notifications and metrics.
- Use typography, spacing and background changes to create hierarchy rather than excessive borders.
- Use a subtle SapienWorx connection-path/network motif as the signature visual device where brand expression is appropriate.

## Core visual dimensions

- Public content width: approximately 1200–1320px.
- Recruiter workspace width: approximately 1360–1600px.
- Long-form readable text width: approximately 600–720px.
- Public section spacing: 96–128px desktop.
- Candidate/product section spacing: 48–64px.
- Recruiter section spacing: 24–40px.
- Marketing grid gaps: 32–48px.
- Candidate grid gaps: 20–24px.
- Recruiter grid gaps: 12–16px.
- Standard controls: 44–48px high; compact recruiter controls may use 40px on desktop but return to at least 44px on touch layouts.
- Card radius: roughly 12–16px. Inputs/buttons: roughly 8–10px. Pills/status: fully rounded.

## UX principles

### Public / Marketing
Editorial, human and premium. Large whitespace, strong Merriweather headlines, human photography or simplified product storytelling, minimal cards, purposeful amber accents, concise narrative sections and clear CTA hierarchy.

### Candidate
A career companion, not an ATS dashboard. Low cognitive load, warm surfaces, transparent application journeys, next-action guidance, privacy clarity and highly readable 16px body text.

### Recruiter
A professional operating system. Nunito Sans + IBM Plex Mono, dense tables, persistent contextual actions, strong candidate search, minimal decoration, rapid scanning and action-first layouts. Do not copy marketing whitespace into operational screens.

### Admin
A governance console. Neutral palette, dense evidence-oriented tables, explicit permissions/audit states and minimal brand decoration.

## Navigation mental models

Candidate: Find → Apply → Track → Interview → Communicate.

Recruiter: Search → Review → Decide → Interview → Hire.

Admin: Observe → Govern → Investigate → Audit.

## Accessibility

Target WCAG 2.2 AA throughout.

- Visible keyboard focus.
- Semantic landmarks/headings/tables.
- 44px minimum touch targets on mobile.
- No critical information conveyed by colour alone.
- Sufficient text/background contrast.
- Reduced-motion support.
- Screen-reader announcements for loading, mutation and error states.
- Proper form labels, error associations and dialog focus management.
- 200% zoom without loss of content or functionality.

## Product-specific constraints that affect design

- Do not expose protected-trait candidate filtering/ranking.
- Do not fabricate AI match/confidence scores.
- External meeting URLs only; no Meet/Teams/Zoom API integration in the current product phase.
- Candidate/consultant OTP and recruiter work-email guardrails must remain intact.
- Preserve privacy, audit and DPDP-aligned controls.

This direction supersedes earlier visual styling preferences where they conflict with this document.