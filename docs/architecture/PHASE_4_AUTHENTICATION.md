# Phase 4 — Authentication

Phase 4 adds end-to-end authentication for candidates, recruiters and provisioned Master Admin users.

## Security model

- Passwords are bcrypt-hashed using the existing backend password helper.
- Access sessions use short-lived HS256 JWTs stored in `HttpOnly`, `SameSite=Lax` cookies.
- Refresh sessions are 256-bit opaque random tokens. Only SHA-256 hashes are stored in PostgreSQL.
- Refresh tokens rotate on every refresh. The previous session is revoked transactionally.
- Logout revokes the current refresh token; logout-all revokes all refresh sessions for the authenticated user.
- OTP values are never stored in plaintext. They are HMAC-SHA256 hashed with a dedicated server-side secret and bound to user + purpose.
- OTP challenges expire, have an attempt ceiling and enforce a resend cooldown.
- Password-reset responses do not reveal whether an email exists.
- Password reset revokes all active refresh sessions.
- Recruiter signup rejects a maintained set of common public/free email providers and associates the recruiter to the company email domain.
- Recruiter access requires both verified mobile and Master Admin approval.
- Master Admin has no public registration endpoint.

## SMS

Production SMS uses Amazon SNS only. `SNS_SMS_ENABLED=true` initializes the AWS SDK SNS client with the configured `AWS_REGION`. Development mode uses a logger sender and returns `development_otp` only outside production so local auth flows can be exercised without SMS spend.

## Endpoints

```text
POST /api/v1/auth/candidate/register
POST /api/v1/auth/recruiter/register
POST /api/v1/auth/login
POST /api/v1/auth/otp/verify
POST /api/v1/auth/otp/resend
POST /api/v1/auth/password/forgot
POST /api/v1/auth/password/reset
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/logout-all        authenticated
GET  /api/v1/auth/me                authenticated
POST /api/v1/admin/recruiters/{userID}/verify  master_admin only
```

## Account lifecycle

Candidate: register -> phone OTP -> active -> login.

Recruiter: register with official work email -> phone OTP -> pending admin verification -> Master Admin verifies recruiter/company -> active -> login.

Master Admin: provision directly in the database/secure administrative process -> login through the non-advertised `/_admin/login` route.

## Frontend routes

```text
/login
/signup
/verify-phone
/forgot-password
/candidate             candidate protected
/recruiter/login
/recruiter/signup
/recruiter             recruiter protected
/_admin/login
/_admin                master_admin protected
```

Protected frontend pages call the backend `/auth/me` endpoint server-side with the incoming auth cookie, keeping backend role validation authoritative.
