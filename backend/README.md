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

The workspace has Java 17 available, but Maven is not currently installed. Once Maven is available, validate with:

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
