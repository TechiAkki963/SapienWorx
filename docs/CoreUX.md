# Core UX launch checks

## Candidate time-to-value

- A new candidate can complete OTP verification, add a CV, and see a profile preview within 30 seconds on a standard connection.
- Capture `candidate_cv_profile_previewed` with `durationMs` and `warningCount`, then capture `candidate_onboarding_verified` with `timeToValueMs` and registration method. Events must never include CV content or contact details.
- Invalid OTPs must say that the code did not match, explain what to do next, and offer a 30-second resend timer. The backend enforces the same cooldown.
- A `MIXED_AMBIGUOUS` parser result must present the candidate-owned “Your profile, your choice” decision modal instead of an error state.

## Recruiter sourcing loop

- Search criteria and quick refinements are encoded in the URL. Opening a candidate and using Back must restore the same search.
- Candidate result cards must show role, company, education, matching skills, activity, and the highest-value actions without unnecessary scrolling.
- A zero-result search with an experience constraint must suggest removing that constraint before asking the recruiter to rebuild the search.

## Compliance and outreach telemetry

- `recruiter_bulk_email_opened` measures the search-to-outreach intent event, using only selected-candidate count and data-source mode.
- `recruiter_bulk_email_queued` measures successful queued outreach, using only the queued count.
- Contact-reveal audit evidence must capture the public Job ID as well as actor, candidate, action, and immutable timestamp. Contact values and message content must not be stored in analytics or audit context.
