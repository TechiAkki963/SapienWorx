# Beta UI/UX reconciliation release — 22 October 2026

The beta audit found the deployed images correctly matched main at
`711efb1160515f95d28827e8e153ecb595c50bc2`, while later approved UI work remained
outside main. This release reconciles those source changes; it does not introduce
another redesign.

## Included behavior

- Recruiter Messages and Candidate Inbox use the bounded conversation workspace:
  history/list/context scroll independently, the composer stays in its pane,
  mobile uses an accessible icon-only Back button, and the emoji picker respects
  the existing server byte limit. Both candidate message entry URLs share it.
- My recruiter profile becomes a professional identity/details dialog with owned,
  validated partial updates, stale-write protection and a content-free audit.
- Recruiter job sharing explains unavailable/private states, verifies anonymous
  availability, and uses canonical public URLs. A separately confirmed,
  permission-checked visibility operation cannot publish or reactivate a job.
  Candidate sharing retains its established modal and three destinations.
- Existing CV/JD provider APIs gain their reviewed browser proposal/import flows,
  capability-aware manual fallback and explicit field review. CV profile changes
  require a distinct preview/confirmation and owner/revision/timestamp checks.
- Command Centre Dark accents use the scoped contrast correction. Intelligence
  baseline evaluation remains bound to the exact historical synthetic evidence
  and model/task/cohort policy; evaluation does not activate a runtime model.

## Database compatibility

The release gate also identified two baseline issues: the Go 1.26.9 toolchain
was affected by GO-2026-6809, and a fast sign-in before hydration could natively
POST back to the login page without authenticating. Operational Go pins are now
1.26.10 ([official release history](https://go.dev/doc/devel/release#go1.26.10)).
The sign-in submit control stays disabled until its client handler is ready;
regressions hold hydration scripts, preserve autofill and verify the API flow.

The clean Linux CI gate also caught the preserved evaluation source hash using
Windows CRLF bytes. Its hash now uses the exact LF bytes stored in Git; only
CRLF line endings are normalized, and regressions reject content/other whitespace
changes. Historical baseline content and provider results are unchanged.

All existing migration pairs 1–71 are unchanged.

- `000072_recruiter_professional_profile` adds optional recruiter identity fields.
  It supersedes the never-released local migration numbered 68. The integration
  test rehearses this exact migration rather than assuming it is the last file.
- `000073_intelligence_event_reschedule_permission` grants only UPDATE on the
  `available_at` column to the API role. It supersedes the never-released local
  migration numbered 54. CI checks that payload/status/attempt/deletion authority
  remains denied. The beta image maps grants to the isolated beta role names.

Apply forward migrations only after confirming `current_database()` is
`sapienworx_beta` and taking a protected beta backup. Normal application rollback
retains the forward schema; it must not drop users' new profile values.

## Release boundary

Deliver through the normal reviewed PR/CI/main flow and the existing Beta Stage A
workflow at the final immutable main SHA. Reuse the existing EC2/RDS and beta
database. Verify the three images, health, PostgreSQL TLS/isolation, complete
migration ledger, capacity, public beta UI and unchanged www/apex holding pages.

AI/provider/task activation, secret loading, model promotion, paid provider calls,
scanner infrastructure, Stage B, Caddy reload/restart, DNS/TLS, production data,
production SES and production cutover are excluded. Existing AI controls stay OFF;
the new AI surfaces must present an honest unavailable/manual state until a
separately approved activation meets its safety and governance gates.

Historical local acceptance reports retain their original dates and results.
They are reference evidence, not proof that this release has deployed. Current CI
and live verification evidence belongs to the release run and final deployment
report.
