# Frontend

Reserved for the SapienWorx Next.js App Router application.

Phase 3 will initialise the TypeScript application, Tailwind CSS, Framer Motion, design tokens and reusable components. Candidate-facing routes will be the public default; recruiter and master-admin experiences will use role-specific layouts.

Planned high-level route groups:

```text
app/
├── (public)/
├── (candidate)/
├── recruiter/
└── _admin/      # non-advertised admin entry; backend auth remains authoritative
```

No frontend runtime has been generated in Phase 1 so architecture can be approved before dependency installation.
