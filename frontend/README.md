# SapienWorx Frontend

Phase 3 establishes the shared UI foundation for every SapienWorx surface.

## Runtime

- Next.js 16.3.3 App Router
- React 19.3
- TypeScript 6
- Tailwind CSS 4.3
- Motion 13.1.1 (`motion/react`)

## Design principles

- Candidate-facing screens are warm, human, expressive and mobile-first.
- Recruiter workspaces can become significantly denser without changing the underlying design tokens.
- Core palette: soft indigo, lavender, mint and peach with a dark ink neutral.
- Human Signal artwork, organic portrait masks and floating product cards are first-class brand primitives.
- Motion is subtle, quick and automatically respects the user's reduced-motion preference.
- Every interactive primitive has keyboard-visible focus treatment and touch-friendly sizing.

## Structure

```text
app/                        App Router shell, metadata and global tokens
components/brand/           Human Signal, wordmark, organic portrait primitives
components/layout/          responsive layout primitives
components/motion/          shared Motion configuration and reveal utilities
components/product/         floating SapienWorx product UI cards
components/ui/              reusable controls and surfaces
lib/                        dependency-free frontend utilities
```

## Local development

```bash
cd frontend
npm install
npm run typecheck
npm run build
npm run dev
```

The root route currently acts as a visual foundation preview. It is **not** the final candidate landing page; Phase 5 will replace/expand it with the complete candidate-centric homepage and portal experience.

## Asset policy

`OrganicPortrait` supports approved human photography through `next/image`. Until approved role-specific assets are placed in the repository/S3 flow, it intentionally renders a branded silhouette fallback rather than pulling arbitrary external stock imagery.
