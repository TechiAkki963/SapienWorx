<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Sapienworx engineering rules

The authoritative UI/UX and frontend architecture source of truth is `docs/MASTER_UI_UX_FRONTEND_BLUEPRINT.md`. Read it before changing public, authentication, candidate, recruiter, or Master Admin UI.

## Repository safety

- Work on `complete-v1` unless the user explicitly names another branch.
- Never modify `main` directly.
- Do not commit or push unless the user explicitly requests it for the current body of work.
- Audit active imports/routes before deleting versioned or legacy-looking files; filenames are not proof of dead code.

## Product architecture

- Do not create V3, `new-*`, `elite-*`, or another parallel UI generation.
- Extend the existing semantic token system and shared role shells.
- Do not add `!important` declarations.
- Use Space Grotesk for display headings, Inter for UI/body, and IBM Plex Mono only for functional data.
- Keep the four canonical responsive modes: <=639, 640-1023, 1024-1439, >=1440.
- Every API-backed view needs truthful loading, empty, filtered-empty where relevant, error/retry, mutation-busy, and success states.
- Never display raw Java/SQL/queue/infrastructure errors to end users.

## Integration guardrails

- Interview scheduling stores an externally created meeting URL only. Do not add Google Meet, Microsoft Teams, Zoom, calendar-sync, or other scheduling APIs/SDKs.
- Do not add external AI/model APIs at the current stage.
- Preserve DPDP consent, privacy rights, audit evidence, RBAC/permission enforcement, recruiter official-work-email restrictions, and secure session behavior.
- Never expose a frontend permission/action that the backend does not actually enforce or support.

## Contract migrations

- Email-OTP-only authentication is a cross-stack migration. Do not hide password/mobile requirements only in the UI while Spring Boot still requires them. Update backend activation/session/data assumptions and tests first, then simplify the UI.
- Granular Master Admin permissions must be persisted and enforced by backend policy before enabling an editable permission picker or colleague-invite flow.
