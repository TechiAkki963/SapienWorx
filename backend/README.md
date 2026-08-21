# Sapienworx API

This Spring Boot module owns the PostgreSQL candidate/job models and the OTP/JWT security boundary. It is separate from the Next.js workspace, which remains the frontend.

## Core persistence model

- `Candidate` contains only core identity, dual-verification state, and DPDP consent/deletion flags. Education, experience, projects, certificates, and skills remain separate aggregate tables.
- `Job` uses a UUID `internalId` for relationships and an immutable public ID such as `SWX_NT_001` for recruiter and candidate URLs.
- `Organisation.jobSequence` is protected with a pessimistic database lock in `JobPublicIdAllocator`. `JobService.create` claims the sequence and assigns the ID in the same transaction before Hibernate persists the job. This is intentionally not a repository call from `@PrePersist`, which would be unsafe under concurrent requests.

## OTP and session flow

1. `POST /api/auth/request-otp` creates a random transaction ID outside the browser's public identifier fields. A controller should call `OtpChallengeStore.issue` once per requested channel and deliver the returned code through an `OtpDeliveryGateway` adapter.
2. The Redis key has a ten-minute TTL and only stores a BCrypt OTP hash. It must be rate-limited by transaction, recipient hash, IP, and device before calling the store.
3. `POST /api/auth/verify-otp` verifies and consumes a code. For a candidate registration, retain per-channel verification state with the transaction and create/activate the `Candidate` only after both `EMAIL` and `MOBILE` succeed. Recruiter registration must require the official-email channel; consultant registration requires both channels.
4. After the flow resolves a single role, call `AuthenticationCookieService.issue`. It creates an `SWX_AUTH` JWT cookie that is `HttpOnly`, `Secure`, `SameSite=Strict`, path-scoped to `/`, and expires with the JWT.
5. `JwtAuthenticationFilter` reads that cookie on later requests and adds the user and `ROLE_*` authority to Spring Security's context. The filter chain has no server session.

## Security configuration

`SecurityConfig` leaves `/api/auth/**` and `/api/public/jobs/**` public, limits recruiter/candidate/admin API trees by role, and disables basic/form login. Cookie-based authentication still receives CSRF protection: Spring exposes a separate `XSRF-TOKEN` cookie and protects authenticated unsafe methods. The two pre-auth OTP endpoints are intentionally ignored by CSRF but must be aggressively rate-limited and monitored.

Flyway migration `V1__core_candidate_and_job_schema.sql` creates the initial PostgreSQL schema; Hibernate is configured to validate it rather than mutate it. Set these environment variables before starting the API:

```text
DATABASE_URL=jdbc:postgresql://localhost:5432/sapienworx
DATABASE_USERNAME=...
DATABASE_PASSWORD=...
REDIS_URL=redis://localhost:6379
JWT_BASE64_SECRET=<Base64 encoding of at least 32 random bytes>
CORS_ALLOWED_ORIGINS=https://app.sapienworx.com
AUTH_COOKIE_SECURE=true
```

The workspace has Java 17 and Maven configured. Validate the API with:

```text
cd backend
mvn test
```

## CV parser queue

`RabbitMqCvParserConfig` declares the durable `cv.parser.exchange` direct exchange and the following topology:

| Workload | Queue | Routing key | Listener concurrency |
| --- | --- | --- | --- |
| Live candidate onboarding | `cv.parser.candidate.queue` | `parse.candidate` | 2–5 |
| Recruiter bulk uploads | `cv.parser.bulk.queue` | `parse.bulk` | 1–2 |
| Failed messages | `cv.parser.dlq` | `parse.dlq` | No consumer by default |

Both processing queues dead-letter to `cv.parser.exchange` with the `parse.dlq` routing key. The listener container attempts a parse three times, then rejects the message without requeueing so RabbitMQ routes it to the DLQ. `ParserPayload` carries only opaque IDs and an object-storage `fileKey`—never CV text, email, mobile, or OTP data. Provide concrete `DeterministicCvParsingService` and `CvParsingEventPublisher` adapters for storage/extraction/JPA and SSE delivery before enabling workers in production; the worker is deliberately not activated until the parser service bean exists.

Add `RABBITMQ_ADDRESSES=amqps://user:password@host:5671/vhost` to the deployed environment. Use AMQPS and least-privilege RabbitMQ credentials outside local development.

To verify the live broker topology without publishing any CV data, set `RUN_RABBITMQ_INTEGRATION_TEST=true` and run `mvn test`. The opt-in test uses `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, and `RABBITMQ_PASSWORD` when set; its local defaults are `localhost:5672` with the standard local `guest` account.

## Live event stream

`GET /api/events/stream` is an authenticated Server-Sent Events endpoint. It accepts the existing `SWX_AUTH` HttpOnly JWT cookie and supports multiple browser connections per user, so a recruiter can safely have several tabs open. A connection receives `CONNECTED` followed by a `HEARTBEAT` every 25 seconds; the browser's native EventSource reconnect behaviour is requested after five seconds.

The RabbitMQ CV parser worker now emits `CV_PARSING_COMPLETE` to the relevant candidate with `status`, `candidateId`, `parserVersion`, `warnings`, and `timestamp`. A future pipeline workflow can call `SseNotificationService.publishPipelineUpdate(recruiterUserId, event)` to send the documented `PIPELINE_UPDATE` payload to the responsible recruiter. Internal failure details are not sent to the browser.

The companion frontend hook is [`hooks/use-server-events.ts`](../hooks/use-server-events.ts). It accepts callbacks for parser completion and pipeline changes, preserves EventSource reconnection, and sends credentials. For a separate API origin during development, set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`; leave it unset when the frontend proxies `/api` to the same origin.

## Recruiter sourcing database layer

Flyway migration `V2__recruiter_audit_and_candidate_sourcing.sql` adds tenant-scoped `Recruiter` membership, append-only `AuditLog` evidence, candidate skills/education, and a maintained PostgreSQL `tsvector` index. The database trigger refreshes that index whenever a candidate's searchable profile fields, skills, or education change; its GIN index is queried through the native Spring Data query in `CandidateRepository`.

`CandidateSourcingService` deliberately returns ten records per page and accepts Boolean web queries such as `React AND "Node.js"`, additional mandatory terms, excluded terms, experience, salary, location, Bachelors/Masters institution, qualification, notice-period, and the exact active-status windows required by the recruiter workspace. Its result projection excludes email and mobile so the separate audited contact-reveal flow remains the only source of those details.

`AuditLog` is immutable in JPA and protected by a PostgreSQL trigger that rejects any update or delete. When a candidate is erased, PostgreSQL preserves the audit event but clears the candidate foreign key rather than retaining a relational link to personal data.

## Deterministic CV parsing

The candidate parser uses Apache PDFBox for PDF files and Apache POI for DOCX files, with UTF-8 TXT support. `DocumentExtractionService` enforces a configurable size limit before extraction, and `DeterministicProfileMappingService` only maps explicit emails, mobiles, labelled location/headline fields, a fixed skills taxonomy, date-bearing experience lines, and recognised education records. Missing evidence results in a review warning rather than a guessed value.

To activate processing, configure an application bean implementing `CvDocumentStorage` for the chosen private S3-compatible object store. The worker accepts a trusted upload MIME type on `ParserPayload` and otherwise safely falls back to the opaque key's extension. It then writes an immutable `CandidateParseResult` with structured JSON, warnings, parser/schema versions, source file key, and processing duration. It never stores raw CV text and never overwrites the candidate profile: every result begins in `REVIEW_REQUIRED` for the candidate's confirmation flow. A terminal failure event is emitted only after all three parser attempts fail and RabbitMQ routes the request to its DLQ. Set `CV_PARSER_MAXIMUM_DOCUMENT_BYTES` to adjust the 20 MiB default limit.

## Recruiter communications and DPDP audit

Recruiter email is queued through `communication.email.exchange` and the durable `email.bulk.queue`; it is never sent on an API request thread. The worker sends from `COMMUNICATION_EMAIL_FROM` using Spring Mail, retries three times, and puts terminal failures in `email.bulk.dlq`. RabbitMQ must be treated as an in-scope processor: use TLS, restricted credentials, message TTL/retention controls, and never log queue payloads because they include the delivery address and rendered email.

`@AuditAction` and `AuditLoggingAspect` create an immutable `audit_logs` entry after successful sensitive operations. The annotation explicitly identifies target argument positions, while the aspect reads the actor UUID from the JWT principal—rather than guessing from a method argument or authentication name. The audit record contains only IDs, action, and resource type; it does not contain contact details, message subjects, or message bodies.
