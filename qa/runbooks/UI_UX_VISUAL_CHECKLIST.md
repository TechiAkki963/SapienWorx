# SapienWorx UI/UX Visual Release Checklist

## Candidate-facing experience

- [ ] Landing, login, signup, jobs and profile screens preserve the soft indigo/lavender/mint/peach visual system.
- [ ] Human Signal artwork and approved human assets render without clipping, distortion or awkward cropping.
- [ ] Text/background combinations meet WCAG AA contrast.
- [ ] Primary actions remain obvious without harsh or inconsistent colors.
- [ ] Motion is restrained and never blocks content or interaction.
- [ ] `prefers-reduced-motion` is respected.
- [ ] No cumulative layout shift is visible during hero/image/motion loading.

## Responsive breakpoints

Verify at minimum:

- [ ] 390x844 mobile
- [ ] 768x1024 tablet
- [ ] 1280x800 laptop
- [ ] 1440x1000 desktop
- [ ] 1920x1080 wide desktop

At every size:

- [ ] No accidental horizontal page overflow.
- [ ] Navigation remains reachable by keyboard and touch.
- [ ] Forms keep labels, validation and CTA buttons visible.
- [ ] Dialogs/drawers do not escape the viewport.
- [ ] Focus order matches visual order.

## Recruiter data-density workspace

- [ ] Candidate tables remain table-first and scannable.
- [ ] 1,000+ row test fixtures do not freeze scrolling.
- [ ] Sticky headers/columns do not cover content.
- [ ] Location, skills and notice-period filters remain inside viewport boundaries.
- [ ] Dense row padding still preserves click/tap targets.
- [ ] Bulk selection/action controls remain visible and keyboard operable.
- [ ] Empty, loading, error and zero-results states are intentional.

## Pipeline

- [ ] Stage controls work with keyboard only.
- [ ] Mobile pipeline interaction does not clip stage/actions.
- [ ] State changes provide immediate feedback and persisted state after refresh/login.
- [ ] Destructive/rejection actions require an intentional confirmation path where appropriate.

## Visual regression discipline

- [ ] Review every changed Playwright screenshot intentionally.
- [ ] Never update snapshots just to make CI green.
- [ ] Investigate font, browser, animation and data nondeterminism before increasing screenshot tolerance.
- [ ] Keep timestamps/random content mocked or deterministic in screenshot fixtures.

## Accessibility manual checks

- [ ] Complete critical candidate and recruiter journeys with keyboard only.
- [ ] Screen-reader landmark structure is logical.
- [ ] Inputs have programmatic labels and errors are announced.
- [ ] Focus is trapped/restored correctly in modals.
- [ ] Icons/buttons expose meaningful accessible names.
