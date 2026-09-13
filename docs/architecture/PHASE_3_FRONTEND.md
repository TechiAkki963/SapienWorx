# Phase 3 — Frontend Setup & Design System

## Objective

Create one responsive visual and interaction foundation that can support two deliberately different densities:

1. warm, human candidate journeys;
2. data-dense recruiter operations.

## Technology

SapienWorx uses Next.js App Router with React, TypeScript, Tailwind CSS and Motion. The frontend does not call third-party product APIs. No remote font dependency is required for the shell.

## Token strategy

Tailwind v4's CSS-first token system is defined in `app/globals.css`. Brand colors are semantic rather than page-specific:

- `indigo` / `indigo-soft` — brand and primary actions;
- `lavender` — calm section hierarchy;
- `mint` — progress and positive status;
- `peach` — warmth and human accents;
- `ink` / `ink-muted` — high-contrast reading hierarchy;
- `canvas`, `surface`, `line` — reusable application chrome.

This avoids creating separate candidate and recruiter brands while still letting later layouts alter spacing, density and composition.

## Brand primitives

- `HumanSignal`: SVG fingerprint/network motif using `currentColor` so it can inherit semantic palette tokens.
- `OrganicPortrait`: asymmetric portrait mask for approved human photography with an internal branded fallback.
- `FloatingProductCard`: animated product-data cards for hero and storytelling compositions.
- `Wordmark`: lightweight initial wordmark primitive pending final logo asset integration.

## Interaction primitives

- `Button`: primary, secondary and ghost variants with minimum touch targets.
- `Input`: explicit label, hint/error association and invalid-state semantics.
- `Surface`: reusable rounded pastel/white panel.
- `Reveal`: viewport reveal motion with shared timing.
- `MotionProvider`: global reduced-motion-aware Motion configuration.

## Accessibility & performance

- semantic headings and controls;
- skip link and visible `:focus-visible` treatment;
- touch-target sizing;
- `prefers-reduced-motion` CSS fallback plus Motion `reducedMotion=user`;
- no remotely fetched Google fonts;
- Next Image support for future approved human assets;
- mostly server components, with client boundaries limited to motion primitives and form components that need React hooks.

## Deferred

Phase 3 does not build complete login/signup workflows, candidate job discovery, application tracking or recruiter dashboards. Those remain Phases 4–6.
