# SapienWorx Frontend Architecture Audit

Status: implementation audit prepared against `complete-v1` at `9e4bb962029db636ef80cc44604d08611d926813`.

This document is intentionally branch-safe: it records the dependency map and migration decisions before any deletion. No legacy/elite/V2 file is considered removable solely because of its filename.

## 1. Runtime foundation

`app/layout.tsx` currently loads six global CSS files in order:

1. `ui-v1.css`
2. `public-auth-v1.css`
3. `candidate-v1.css`
4. `complete-v1.css`
5. `ui-v1-final.css`
6. `rebuild-v2-first.css`

The code already has a useful canonical foundation in `components/ui.tsx`: `WorkspaceShell`, shared role navigation, `Button`, `Badge`, `Icon`, shared typography hooks and access/session behavior. The repair should extend this foundation rather than create a V3 component system.

The main inconsistency is that later feature modules bypass those semantic tokens. For example, the recruiter pipeline and recruiter interview CSS modules hard-code a separate blue/steel palette instead of the recruiter `--indigo`/semantic token system.

`complete-v1.css` also contains a global `html, body { ... overflow-x: clip; }` rule. That masks overflow rather than proving individual components fit. It should be removed when the active route migration reaches the foundation stylesheet; until then, route-specific overflow defects must be fixed at source rather than adding another global clipping rule.

## 2. Active route -> component map

### Public / auth

- `/` -> `PublicLandingRebuildV2` (`components/public-landing-rebuild-v2`)
- `/login` -> `LoginPortal` (`components/auth`)
- `/recruiter/login` -> recruiter auth implementation under the recruiter auth route
- `/recruiter/register` -> recruiter registration implementation under the recruiter auth route
- `/admin/login` -> admin login implementation

Multiple older marketing/auth components exist in `components/`, but they must not be deleted until branch-specific import tracing proves they are unreferenced.

### Recruiter

- `/recruiter` -> `RecruiterDashboard` (`components/recruiter.tsx`)
- `/recruiter/jobs` -> `RecruiterJobs` (`components/recruiter.tsx`)
- `/recruiter/jobs/manage` -> `RecruiterJobList` (`components/recruiter.tsx`)
- `/recruiter/candidates` -> `RecruiterPipelineV2` (`components/recruiter-pipeline-v2.tsx`)
- `/recruiter/pipeline` -> `RecruiterPipelineV2` (`components/recruiter-pipeline-v2.tsx`)
- `/recruiter/sourcing` -> `RecruiterSourcingV2` (`components/recruiter-sourcing-v2.tsx`)
- `/recruiter/interviews` -> `RecruiterInterviewsV2` (`components/recruiter-interviews-v2.tsx`)
- `/recruiter/communications` -> `RecruiterCommunications` (`components/recruiter-tools.tsx`)
- `/recruiter/reports` -> `RecruiterReports` (`components/portal-reports.tsx`)
- `/recruiter/settings` -> `RecruiterSettings` (`components/recruiter-settings.tsx`)
- `/recruiter/workbench` -> `RecruiterWorkbenchV1` (`components/recruiter-workbench-v1.tsx`)

Recruiter routes therefore span a large legacy monolith plus several later feature modules. This is a primary source of interaction and styling drift.

### Candidate

- candidate layout -> `CandidateDomainGate` (`components/candidate-domain.tsx`)
- `/candidate` -> `CandidateDashboard` (`components/candidate.tsx`)
- `/candidate/jobs` -> `CandidateJobs` (`components/candidate.tsx`)
- `/candidate/applications` -> `CandidateApplications`
- `/candidate/interviews` -> `CandidateInterviews`
- `/candidate/messages` -> `CandidateInboxV1`
- `/candidate/profile` -> `CandidateProfile`
- `/candidate/settings` -> `CandidateSettingsV1`

The candidate portal already uses the common `WorkspaceShell` visual language in multiple feature components, but implementation is split between a monolith and standalone files.

### Admin

- `/admin` -> `AdminGuardrailLayer` -> `MasterAdminConsole`

Admin is presently much thinner as a route surface and relies on in-page console sections rather than a broad nested route IA.

## 3. Confirmed architectural defects

1. **Multiple CSS generations are loaded globally.** Most newer CSS is scoped, but the runtime still depends on ordering between six global files. This increases regression risk and makes the cascade difficult to reason about.
2. **Feature modules bypass semantic tokens.** Pipeline/interview modules use hard-coded colors, radii and shadows that do not match the recruiter shell.
3. **Operational UI has inconsistent interaction grammar.** Pipeline has its own toolbar/filter/bulk/state vocabulary while sourcing, communications, jobs and interviews each implement similar patterns separately.
4. **Large feature monoliths remain active.** `components/recruiter.tsx`, `components/candidate.tsx`, `components/auth.tsx` and `components/candidate-profile.tsx` contain many concerns and make route-level visual migrations risky.
5. **Candidate and recruiter pages use different generations of feature naming (`V1`, `V2`, unversioned) even when active.** The filename itself is not a bug, but it reflects incomplete consolidation.
6. **Global overflow clipping masks layout defects.** Page-level overflow should be fixed in the component responsible.
7. **Loading fallbacks are inconsistent.** Some routes use `Suspense fallback={null}`, producing blank space instead of a meaningful loading state.
8. **No external icon package is installed.** `components/ui.tsx` already defines the shared SVG icon family; this should remain the canonical iconography rather than introducing another dependency.

## 4. Repository hygiene

`.gitignore` already excludes `.next/`. A tree search against the current branch did not find tracked `.next/` or `.next-backup/` paths, so no generated directory deletion is justified by the current evidence.

## 5. Consolidation decisions

- Keep and strengthen `components/ui.tsx` as the canonical UI foundation.
- Use existing semantic tokens (`--ink`, `--muted`, `--line`, `--paper`, `--cloud`, `--indigo`, `--indigo-deep`, `--indigo-soft`, `--amber`, `--good`, `--warn`) rather than inventing another palette.
- Migrate active feature CSS away from raw hex values first.
- Standardize recruiter data workflows around the same toolbar / advanced-filter / active-filter / selection / bulk-action / content / pagination / async-state grammar.
- Keep pipeline list/table oriented and default to 10 records per page.
- Preserve external-meeting URL behavior; do not integrate meeting-provider APIs.
- Preserve backend routes, auth, consent and RBAC behavior.
- Do not delete legacy/elite/versioned components until branch-specific import tracing proves no active route or component references them.

## 6. First implementation slice

The first safe code slice focuses on the currently active recruiter pipeline and interview surfaces because they visibly diverge from the canonical shell despite being core operational workflows:

- convert their CSS modules to semantic design tokens;
- normalize control height, focus state, surfaces, radii and responsive behavior;
- remove feature-local brand colors;
- make interview notification behavior explicit in copy (`Schedule & notify`) because the existing backend schedule endpoint performs notification delivery;
- keep external meeting URLs external-only;
- improve non-blank loading/error/empty states without changing API contracts.

## 7. Later migration order

1. Finish shared workflow primitives and recruiter shell normalization.
2. Recruiter dashboard and sourcing.
3. Job management / posting.
4. Communications templates and selection hand-off.
5. Candidate dashboard/jobs/applications/interviews/profile/settings.
6. Admin IA and access-management surfaces.
7. Public/auth consolidation.
8. Only then remove proven-dead UI/CSS.
9. Run visual QA at 360, 390, 768, 1024, 1280 and 1440 plus typecheck/build/e2e where the environment allows.

## 8. Quality-gate note

The current execution environment cannot resolve `github.com` from the local shell, so the repository cannot be cloned locally and build/Playwright checks cannot honestly be reported as executed from this workspace. Source changes should remain uncommitted until explicit approval, and automated verification must be run once a real working tree/build environment is available.
