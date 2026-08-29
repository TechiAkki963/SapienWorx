# QA accounts, OTPs, and RabbitMQ

This runbook applies only to the isolated local QA profile. It must never be
enabled in an environment containing real accounts or production data.

## Start the local QA environment

The Compose configuration activates the `qa` Spring profile by default. It
creates the accounts below each time the API starts, without overwriting an
existing account. To use different values locally, set `QA_TEST_ACCOUNT_PASSWORD`
and `QA_STATIC_OTP` in `.env` before starting Compose.

## Seeded sign-in accounts

All seeded accounts use password `SapienworxQA!2026` and the QA-only OTP
`999999`.

| Role | Email | Password | OTP requirement | Expected destination |
| --- | --- | --- | --- | --- |
| Recruiter | `recruiter.alex@sapienworx.qa` | `SapienworxQA!2026` | Email: `999999` | Recruiter workspace |
| Recruiter | `recruiter.sam@sapienworx.qa` | `SapienworxQA!2026` | Email: `999999` | Recruiter workspace |
| Candidate — Tech | `candidate.tech@sapienworx.qa` | `SapienworxQA!2026` | Email and mobile: `999999` | Candidate workspace |
| Candidate — Unassigned | `candidate.unassigned@sapienworx.qa` | `SapienworxQA!2026` | Email and mobile: `999999` | Candidate domain selection |
| Master Admin | `master.admin@sapienworx.qa` | `SapienworxQA!2026` | Email: `999999` | Master Access control plane |

The two recruiters belong to **Sapienworx QA Organisation**. The candidate
mobile values are test-only and are never delivered to a real handset.

Open Master Access at <http://localhost:3001/admin/login>. This account is
seeded only by the isolated `qa` profile and has the `SUPER_ADMIN` role.

## Signup testing

- Candidate signup: use a unique `@sapienworx.qa` email and mobile number, a
  password of at least eight characters, accept the terms, then submit `999999`
  for both verification controls.
- Recruiter signup: use a unique non-public work email, such as
  `new.recruiter@sapienworx.qa`. Employer registration uses the email OTP;
  consultant registration uses both email and mobile OTPs. The QA OTP works
  for each requested channel after the OTP request has created its transaction.

The normal 30-second request cooldown and 10-minute transaction expiry remain
in force. `999999` does not bypass credentials, role selection, transaction
creation, required OTP channels, or rate limits.

## Account security walkthrough

- Candidate signup always requires both email and mobile OTPs.
- On candidate sign-in, selecting **Trust this personal device for 30 days**
  stores an HttpOnly device token. A recognised, unrevoked device uses the
  email OTP only; new or revoked devices still require both channels.
- Candidate **Settings → Devices and sessions** can generate eight single-use
  recovery codes. A recovery code replaces only the mobile OTP and can be used
  only after the email OTP for that sign-in transaction is verified.
- Candidate and recruiter Settings list active sessions and can revoke one
  device or every other device. Password reset revokes every existing session.
- **Forgot password?** sends a reset OTP to the verified account email through
  `auth.otp.email.queue`. In QA, confirm it with `999999` and set a password of
  at least eight characters.
- Recruiter company lookup checks the selected organisation against the work
  email domain before sending an OTP. Verified signup opens the workspace
  immediately and records a company review due within one business day.

## RabbitMQ Management UI

For local Compose, open <http://localhost:15672> and sign in with:

| Field | Local QA value |
| --- | --- |
| Username | `sapienworx` |
| Password | `sapienworx-local` unless `RABBITMQ_PASSWORD` is set in `.env` |
| Virtual host | `/` |

Relevant queues:

| Purpose | Queue |
| --- | --- |
| Email OTP deliveries | `auth.otp.email.queue` |
| Mobile OTP deliveries | `auth.otp.mobile.queue` |
| Bulk recruiter email dispatch | `email.bulk.queue` |
| Bulk email failures | `email.bulk.dlq` |
| Candidate CV parsing | `cv.parser.candidate.queue` |
| Bulk CV parsing | `cv.parser.bulk.queue` |
| CV parsing failures | `cv.parser.dlq` |

OTP payloads are delivered through the two `auth.otp.*` queues — not
`email.bulk.queue`. In the Management UI, inspect the appropriate OTP queue
after requesting an OTP. Use the QA-only `999999` code for fast authentication
tests; only retrieve a real queued OTP when specifically testing dispatch
payloads. Never copy OTP payloads or recipient data out of the QA environment.

## Shared staging

This repository cannot provision staging credentials. A staging operator must
create a dedicated RabbitMQ user with a separate QA vhost and least-privilege
permissions, then set `SPRING_PROFILES_ACTIVE=qa` only on its disposable QA
deployment. Do not activate the profile, reuse these credentials, or expose
the Management UI in shared staging with real data.
