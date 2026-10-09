# Company governance implementation and local acceptance

Reviewed on 9 October 2026 in the existing `codex/job-social-previews` checkout, based on `303ef06c`. These changes remain local and uncommitted. The earlier seven recruiter/candidate refinements are preserved.

The three references were addressed in order: subscription continuity (`What if.txt`), company administration (`Company Onboard.txt`), and independent company reviews (`Company Review.txt`). This document distinguishes the implemented foundation from enterprise and commercial extensions.

## Subscription continuity and entitlements

A company subscription has explicit feature, capacity and period-usage allocations. Access is resolved from the policy and unexpired, audited overrides; code does not derive permissions from a plan-name string.

- A failed-payment state receives seven days of grace by default, with an optional explicit grace deadline. Voluntary cancellation keeps the already-paid period and receives no failed-payment grace.
- Expiry resolves to SapienWorx Recruit Free. It preserves company ownership, jobs, applications, interview and offer records, messages, referrals and historical sourcing data.
- Talent discovery stops, smart-pool evaluation and alerts pause, and outreach delivery checks the current entitlement inside its transaction. Stored campaigns and searches are retained rather than deleted. Stored campaign status is retained for renewal; entitlement checks pause execution.
- Existing applicants and established conversations remain accessible through the existing privacy rules. A historical conversation does not grant an unrelated recruiter unrestricted candidate contact or CV access.
- No user is selected automatically for removal after a downgrade. Existing objects above a new limit remain stored. Capacity is checked when new resources, allocations or reactivations add consumption.
- Commercial examples in the references are not treated as approved pricing. Existing tenants remain unmanaged with their previous access preserved. Limits are configurable, and `limits_approved` controls enforcement. The new UI does not silently approve commercial limits.
- Authorized Command Centre staff can update policy and grant time-limited allocation increases, with a reason and audit event. A temporary allocation does not restore an expired subscription or extend its paid period.

Capacity checks cover Sub-admins, Recruiters, Talent seats, active jobs, saved searches, smart pools and outreach sequences. Pending accepted registrations consume seat capacity; expired, unaccepted invitations do not. Usage meters cover Talent profile unlocks and outreach messages.

Profile unlocks are deduplicated by company, candidate and paid billing period, including concurrent requests. Outreach retries use period-qualified idempotency keys. The usage ledger is immutable except for restricted identity anonymization needed by privacy deletion. Dashboard usage displays remaining allocation, period reset and 70/85/100-percent status messages; capacity does not reset monthly.

## Controlled company onboarding and access

The Command Centre can provision a pending or manually verified company, configure its policy, and queue an initial owner invitation. Manual business/domain verification is attested by the platform administrator and audited; this is not an automated DNS or business-registry verification service.

Initial ownership still requires the existing organization-invitation approval workflow, with two distinct active Master Admin reviewers different from its requester. The approval must identify this company and the exact owner email. It is consumed once. No company owner is inferred for existing tenants.

Invitations are official-domain scoped, signed, stored by token hash, expire after seven days, and are single use. Delivery uses the existing email mechanism. Registration and invitation acceptance retain password hashing, consent and email OTP requirements. An invitation cannot bypass email verification or move an unrelated account between companies.

Company roles remain separate from platform/JWT roles:

| Company role | Implemented authority |
| --- | --- |
| Primary Company Admin | Company profile/setup, team and Talent-seat assignment, ownership handoff, plan/usage view, review responses, audit history and full company hiring access |
| Sub-admin | Hiring work within delegated scopes; invite, edit, deactivate and revoke Recruiter/Collaborator access contained entirely within those scopes |
| Recruiter | Hiring work allowed by their scopes; premium work also requires a Talent seat and the company entitlement |
| Hiring Collaborator | Assigned job/application/interview summaries and actual panel response/feedback; no job/stage/ownership/billing or broad sourcing mutations |
| Existing recruiter | Previous access retained until an owner explicitly changes or deactivates the account |

Scopes combine departments, locations and selected job IDs as an explicit union. Delegation uses the same exact-value comparison as resource queries. Sub-admins cannot grant ownership, create another Sub-admin, allocate/release premium seats, manage billing, or widen a teammate beyond their own scope. Their team response filters out owners and out-of-scope identities and invitations.

Broad legacy collections fail closed for scoped members. The scoped workspace supplies authorized job/application summaries, stage changes, manual-link interview scheduling and panel feedback. Job assignees and interview panels must be active, verified company members whose scope permits that work. Tenant/resource authorization is enforced on the server.

The owner is protected from deactivation and self-service account deletion until ownership transfers to an active, verified teammate. A resource handoff can accompany explicit deactivation: assigned jobs, private searches, pools, templates, sequences, campaigns and conversations move atomically to an authorized active teammate with company-wide access. Original creators, historical messages, audit and usage attribution remain preserved; running campaigns pause. Invalid recipients and conflicting campaign idempotency keys roll back the entire handoff.

### Company screens

`/company` provides a six-step, saved-draft setup wizard: public profile, optional structure, team, hiring guidance, privacy acknowledgement and review. Owners land in company administration at sign-in; scoped members and collaborators land in their assigned hiring workspace. Other screens provide team/invitations, plan/usage, company review responses and audit history.

Company profile fields include about, industry, size, headquarters, website, public logo/banner URLs, locations, benefits, culture and social links. Assets use supplied HTTPS URLs in this phase. Hiring guidance records timezone, interview/referral guidance; existing job-specific referral terms and manually supplied meeting links remain authoritative. Saving a company preference does not activate a new job-approval, retention, MFA or session-policy engine.

## Independent company reviews

Public company pages and the company directory show verified public profiles, open jobs, and separate employee/interview review counts and ratings. Empty ratings display no invented score. Category averages exclude N/A answers.

Candidate review submission includes relationship, role, location, dates, anonymity, overall/category ratings, pros, cons, advice and interview-specific answers. Employee claims need human relationship verification; interview reviews require an actual completed interview associated with this company. All submissions still await platform moderation.

- Public and employer payloads exclude private author IDs, email and relationship evidence. Candidate exports include only that candidate’s own review data.
- Authors can edit or delete their own reviews. Edits return to moderation and increment a revision; the original publication date is retained. Only one non-deleted review of each kind is allowed per company/author. A deleted review can be replaced.
- Company owners can respond and report concerns. They cannot edit, delete or approve the reviewer’s words.
- Helpful votes are deduplicated and exclude self-voting. Rejected authors can appeal. Command Centre moderation handles pending reviews, reports and appeals with a reason, revision check and audit trail.
- Basic text signals flag contacts, links, threats and spam-related content for review. Known contact/link disclosures cannot be published. These signals support human moderation and do not establish employment proof or provide comprehensive automated fraud detection.
- Review deletion and account erasure clear written content and identifying review metadata, including public name, role, location and dates. Existing internal audit/report retention remains governed by the existing privacy process.

## Database changes

The new migrations are `000062_company_entitlements`, `000063_company_administration`, and `000064_company_reviews`. They are unapplied on beta/production. Migration 63 also adds nullable original-creator references to handoff-capable sourcing/messaging records. The earlier uncommitted migrations 59–61 belong to the preserved recruiter refinements.

A disposable local PostgreSQL 16 database named `sapienworx_ci` was used. Tests refuse a non-local host or another database name. All 64 migrations applied cleanly; migrations 62–64 were rolled back and reapplied successfully. No RDS, EC2, S3, Caddy, TLS, DNS or deployment workflow was changed.

## Acceptance evidence

| Check | Result and scope |
| --- | --- |
| Complete Go package suite | PASS, including configured isolated recruiter/database regressions |
| Company database integration | PASS, 13 scenarios: governance, concurrent metering/capacity, expiry, scopes, review privacy/moderation, handoff, deletion/export and immutable constraints |
| Company HTTP/auth integration | PASS: signed sessions, scoped/foreign access, delegated escalation denial, Talent-seat preservation, legacy deactivation, owner protection, active panels, invitation registration/OTP, token replay and password hashing |
| TypeScript | PASS |
| Next.js production build | PASS |
| Company browser acceptance | PASS, 11 distinct cases; ten-case suite plus four affected cases after the mobile action-bar correction |
| Earlier candidate/recruiter regressions | PASS, 21 additional cases in the earlier combined 26-case run |
| Responsive visual captures | 176 PNGs at 1920, 1440, 1366, 1024, 768, 428 and 360px widths, Light/Dark plus focused live System appearance checks |
| Accessibility checks | PASS for tested drawer focus containment/return, Escape, mobile field/action visibility, live System appearance and status contrast; not a full WCAG conformance certification |
| Browser errors and horizontal overflow | No page errors or document overflow in the tested screen sweep |

Browser checks use Chromium with synthetic local API fixtures; backend integration uses the disposable real PostgreSQL database. Visual review corrected scoped-team counts, dark status contrast, and the candidate review footer overlapping mobile navigation. These are local acceptance results, not a live beta/RDS/TLS or real-device/cross-browser certification.

Review gallery: `http://127.0.0.1:3231/company-administration/index.html`. Capture sources: `frontend/visual-artifacts/company-administration`. Machine logs and the gallery package are under ignored `tmp` directories; no real credentials belong in the report or source.

## Deliberate phase boundaries and remaining decisions

This change implements the controlled foundation. It does not claim the complete enterprise product described by every example in the references.

- Pricing, approved free/paid allocations, add-on contracts, top-ups, renewal request handling and notification delivery at usage thresholds still require product decisions. Renewal is currently an audited staff operation; no payment gateway or invoicing SaaS was added.
- Named Sub-admin groups, reporting-manager relationships, multi-group membership management, custom permission presets, supporting-recruiter ownership graphs and scoped aggregate performance reports are later enterprise extensions. Combined scopes are supported now, without a large group framework.
- Scoped users have the dedicated hiring-summary workspace. It is not a complete duplicate of every company-wide recruiter collection, Candidate 360 screen or advanced offers/analytics UI.
- Setup hiring/privacy/security preferences do not replace the existing approved workflow, retention or security mechanisms. Custom approval pipelines, retention automation and optional company MFA policies need separate implementation and review.
- Company asset uploads, rich review trend/recommendation analytics, verified employment evidence collection, event-triggered review invitations and coordinated-abuse analysis remain later extensions. Moderation is manual; no external AI/API integration was introduced.
- Deployment, CI publication and applying the new migrations require a reviewed release step. No source was committed/pushed and no live rollout was performed in this work.
