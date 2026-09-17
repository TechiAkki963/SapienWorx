# SapienWorx release scope — 17 September 2026

This release consolidates the September 16 implementation work onto current `main` and preserves the current platform constraints.

## Authentication boundary

- Email OTP is the only OTP channel in the current product phase.
- Do not add SMS OTP, SMS verification routes, SMS consent, or mobile OTP.
- Mobile numbers may remain optional profile/contact data where already supported, but they must not activate an SMS verification flow.

## Release workstreams

1. DPDP/GDPR Compliance V3
   - purpose-specific, versioned consent evidence
   - privacy rights requests and fulfilment state
   - safe export allow-list; partial exports never become complete
   - erasure orchestration with review/hold guards and idempotent fulfilment
   - incident/breach records, subprocessors and processing activities (ROPA)
   - admin privacy operations and public privacy/subprocessor surfaces

2. Bulk InMail Anti-Spam V3
   - server-authoritative 14-day recruiter/candidate cooldown
   - transactional duplicate/race protection
   - bulk endpoint with per-recipient sent/skipped outcome
   - existing frontend multi-select and composer remain the client surface

3. 4K Role Assets Integration
   - source-controlled role-asset mapping and `next/image` AVIF/WebP optimisation
   - approved 4096×4096 master binaries are a release dependency and must not be replaced with upscaled placeholders

4. Anonymous Pitch Mode
   - server-side redacted DTO
   - identity/contact fields must never be loaded into the anonymous response contract

5. Global realtime stage events
   - authenticated `/api/v1/events/ws`
   - `STAGE_CHANGE` event emitted after committed recruiter stage updates
   - candidate UI bridge refreshes application state without a manual reload

6. Enterprise audit/testing package
   - Playwright audit contracts
   - destructive opt-in erasure integration test
   - k6 load audit and search-plan verification
   - sub-minute smoke test
   - vulnerability and QA report

## Existing integration constraints

- Go + pgx + PostgreSQL backend.
- Next.js App Router + TypeScript frontend.
- No external AI/model API in this phase.
- No Google Meet or Microsoft Teams API/SDK integration; interviews keep externally created meeting URLs.
