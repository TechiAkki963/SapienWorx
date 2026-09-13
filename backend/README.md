# Backend

Reserved for the SapienWorx Go REST API.

Phase 2 will create the Go module and implement the HTTP server, PostgreSQL connection pool, configuration loading, health endpoints and JWT authentication middleware.

Planned package boundaries:

```text
cmd/api/
internal/auth/
internal/candidate/
internal/recruiter/
internal/company/
internal/job/
internal/admin/
internal/platform/
internal/storage/
internal/sms/
```

The API will not call third-party services. AWS SNS is the only allowed SMS delivery integration; S3 is the object-storage target.
