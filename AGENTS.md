# SapienWorx Engineering Guardrails

These rules apply to all code generated or edited in this repository.

## Architecture

- Frontend: Next.js App Router + TypeScript.
- UI: Tailwind CSS + Framer Motion.
- Backend: Go REST API; prefer Go standard library unless a lightweight router materially improves clarity.
- Database: PostgreSQL with explicit migrations. Keep persistence behind repository/store interfaces.
- AWS target: EC2, RDS PostgreSQL, S3, SNS only unless the product owner explicitly changes the constraint.

## Integration constraints

- Do not add third-party APIs or SaaS integrations.
- AWS SNS is the only allowed SMS transport.
- Do not integrate Google Meet, Microsoft Teams, Google Calendar, Google Auth, Twilio, or external AI/model APIs.
- Interview meeting URLs are supplied manually by users and stored as data.

## Product UX

- Candidate-facing experiences are warm, human and spacious without wasting screen area.
- Recruiter workspaces are data-dense, table-first, filter-rich and optimized for keyboard/bulk workflows.
- Preserve the SapienWorx visual language: soft indigo, lavender, mint and peach; rounded surfaces; refined shadows; Human Signal artwork; approved human assets; restrained motion.
- All user-facing screens must be responsive and accessible.

## Security

- Never commit secrets.
- Passwords must be stored only as modern password hashes, never plaintext.
- JWT secrets and AWS credentials must come from runtime environment/secret storage.
- Apply role authorization server-side; hiding a route in the UI is never sufficient.
- Prefer least privilege and auditable state changes.

## Phase discipline

Do not pre-empt later phases by adding large frameworks or infrastructure before they are required. Keep each phase independently reviewable.
