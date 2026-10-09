# Seven recruiter and candidate refinements

Reviewed locally on 9 October 2026, on `codex/job-social-previews`, based on commit `303ef06c`.

The seven supplied references were implemented in their supplied order. The changes are uncommitted. No release workflow, live migration, AWS operation or deployment was performed.

## 1. Typography

Inter is now self-hosted through Next.js, with its licence and source recorded alongside the font. Recruiter operational titles use the same sans-serif family and shared header. The semantic scale uses 28px desktop/24px mobile page titles, 18px section headings, 14px body/table text and 13px labels. Operational 10px/11px text was removed or raised; table headings use title case. Muted colours were adjusted for light and dark recruiter workspaces.

Editorial and public branding retain their existing visual language. This work does not introduce a new public-site design.

## 2. Applications icon

Applications uses a shared document-and-check outline icon. Its accessible name remains “Applications”, including compact navigation. The glyph is 20px inside a target of at least 44px.

## 3. Interview operations

Upcoming is the default queue. Status tabs and operational summary links carry counts. Search, date range, stage, interviewer and timezone filters retain route state. The calendar supports day/week views; mobile defaults to day. Empty states match the current queue.

Scheduling uses candidate/job names, verified active company interviewers, an explicit timezone, video/phone/in-person formats, manually supplied meeting details and internal notes. Panel responses and feedback progress are separate from the interview status. Same-company panel conflicts and cross-company candidate conflicts are rejected, including concurrent scheduling races, without disclosing another employer's data.

The detail drawer supports structured rating/recommendation/evidence feedback, panel responses, candidate messaging and interview history. The service records each feedback revision. Failed feedback submissions preserve input. A page refresh after saving no longer discards the form while keyboard focus is wrapping. The shared drawer confines Tab/Shift+Tab to the current modal, supports Escape and returns focus to its opener.

Current defaults are a standard scorecard and a 30-minute in-app reminder. Configurable reminder schedules, custom scorecard templates and suggestions of alternative times remain future extensions. This implementation does not integrate external calendars or meeting services. Feedback revisions are recorded by the service; the audit table is not independently protected against privileged database updates.

## 4. Password recovery

Both recovery steps have top Back and bottom Return links. Destinations are validated against exact internal role-appropriate routes; external and unapproved paths fall back to sign-in. Authenticated recovery obtains only the signed-in active, verified candidate/recruiter's email from a protected, uncached endpoint and uses it as the locked identity. Password-reset success returns to the correct role's sign-in route because the session has been revoked.

## 5. Notification centre

The global recruiter bell opens `/recruiter/notifications`, with a 99+ badge for large unread counts. Opening the centre does not mark everything read. It supports grouped categories, unread filtering, pagination, per-item read/unread/dismiss actions, explicit mark-all-read and in-app category preferences.

Native applications, jobs, interview panels/changes, offers, candidate messages and referral events produce recipient/company-scoped records. Upcoming reminders and missing-feedback notices are derived from the current interview state. Muting a category changes the in-app feed only. No new external delivery channel was added.

Opening an individual notification re-authorizes the referenced resource on the server. Deleted, inaccessible and foreign-company resources return controlled not-found behaviour. Offer/referral notifications open the authorized detail drawer; messages open the authorized conversation; application updates lead to the appropriate job's applicants. Talent/company/security category support does not invent events for unimplemented workflows.

## 6. Candidate referrals

Refer someone remains visible after applying or saving, when the job and referral window permit invitations. Employer job settings control referrals, an optional closing date, optional reward programme, terms and eligibility rules. The API enforces the same eligibility and closing-date rules.

The candidate supplies limited contact details, an optional relationship/message and explicit permission to share those details. No other person's CV or profile is constructed. The invited person owns their account and must explicitly apply. Existing candidate/application records are reused; later invitations never overwrite the canonical first valid attribution.

Referral, broad hiring progress and reward progress are separate. Referrers receive no private recruiter notes, interview feedback, compensation or rejection reasons. Reward processing for candidate referrals requires canonical attribution and successful hiring; merely inviting someone never promises a payment. Existing recorded reward states remain visible. Company eligibility/terms are reviewed by the employer; they are not automatically interpreted and no payment integration was added.

Recruiter referrals remain a tracking/review workflow. Candidate invitations use the existing verified email path. The supported attribution policy is first valid referral wins; configurable policy engines and delivery preferences are future extensions.

## 7. Talent navigation

One shared outline icon vocabulary represents each destination. Talent tabs adapt to their available container width: full labels, short labels, compact icons with an active label, or six icons with the active destination named beneath the row on the narrowest screens. Accessible names remain available at every width. Selected tabs use a royal-blue container and white glyph/text, with `aria-current` and visible keyboard focus.

## Validation

All checks below passed after their affected fixes. Browser checks use a local Next.js app and a synthetic API; database checks use a disposable local PostgreSQL database, not beta RDS.

| Check | Result |
| --- | --- |
| TypeScript compilation | PASS |
| Next.js production build | PASS |
| Go package tests (`go test ./...`) | PASS |
| Clean database migration rehearsal through migration 61 | PASS |
| Recruiter database security suite, 19 subtests | PASS |
| Candidate referral consent, privacy, attribution and reward integration | PASS |
| Readability visual sweep, 1 browser case | PASS |
| Talent navigation and job-builder visual regression, 4 browser cases | PASS |
| Recruit/Talent workspace regression, 5 browser cases | PASS |
| Candidate jobs/referrals regression, 45 browser cases | PASS |
| Existing interview dashboard/timezone regression, 4 browser cases | PASS |
| Interview operations, 4 browser cases | PASS |
| Recovery routes and identity, 2 browser cases | PASS |
| Notification centre, 3 browser cases | PASS |
| Recovery/referral-settings final visual review, 1 browser case | PASS |
| Interview feedback keyboard regression repeated three times | PASS |
| Whitespace diff check | PASS |

There are 69 distinct targeted browser cases across these suites. These are not a claim of full application, cross-browser or live beta acceptance. The final notification visual test also checks console errors, hydration, keyboard operation and focus return. An earlier screenshot-time hydration warning caused by capturing before hydration completed was eliminated by confirming client interaction before capture.

Responsive coverage includes 1920, 1440, 1366, 1024, 768, 428, 360 and 320px widths where applicable, with System/Light/Dark modes. The gallery contains 212 synthetic screenshots. Representative desktop/mobile light/dark screenshots were visually inspected, including interviews, messages, notifications, Talent, recovery, referrals and employer referral configuration.

Review gallery: `http://127.0.0.1:3231/recruiter-improvements/index.html`.

Local evidence is under `tmp/`; screenshot originals are under `frontend/visual-artifacts/`. Generated screenshots and local QA helpers are not release source.

## Release implications

The release adds migrations 59–61: interview operations, recruiter notifications and job referral programmes. A future beta rollout must apply and verify these migrations using the existing controlled Stage A process. The interview down migration intentionally refuses to restore the legacy mandatory-video-link constraint while phone/in-person records with empty meeting URLs remain; reconcile those records before rollback. Notification/referral down migrations remove their new data, so they are not a routine rollback path after real use.

The existing public holding page, beta edge, Caddy, DNS, TLS, production data and infrastructure were not modified by this work. Deployment is outside this local implementation task.
