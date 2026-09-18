# SapienWorx test/staging deployment

This is the deployment rehearsal stack. It uses the same compiled frontend and backend artifacts that should later be promoted to production.

## Topology

```text
Browser -> nginx gateway :8080
             |         |
             v         v
        Next.js     Go API
                         |
                         v
                   PostgreSQL 17
```

Browser API and WebSocket traffic is same-origin through the gateway. Next.js Server Components use the private `INTERNAL_API_URL=http://backend:8080`.

## Start

Copy `test.env.example` outside source control and replace all placeholder secrets.

```bash
docker compose --env-file /path/to/sapienworx-test.env -f deploy/compose.test.yml up -d --build
```

Verify:

```bash
curl --fail http://localhost:8080/health/live
curl --fail http://localhost:8080/health/ready
curl --fail http://localhost:8080/
curl --fail http://localhost:8080/jobs
docker compose --env-file /path/to/sapienworx-test.env -f deploy/compose.test.yml ps
```

Stop:

```bash
docker compose --env-file /path/to/sapienworx-test.env -f deploy/compose.test.yml down
```

Add `-v` only when intentionally deleting the test database.

## Migration policy

The migration image runs before the API and records each applied migration plus SHA-256 checksum in `schema_migrations`.

- already-applied migrations are skipped;
- changed historical migrations fail as drift;
- a failed migration prevents the API from starting;
- `seed.dev.sql` is excluded from the migration image.

After a shared environment exists, never edit an already-applied migration. Add a new migration instead.

## Internet-facing staging

Terminate TLS at the cloud load balancer or edge proxy and set:

```text
PUBLIC_ORIGIN=https://staging.example.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_DOMAIN=staging.example.com
```

Do not expose PostgreSQL or the backend service publicly.

## Production promotion

This stack is deliberately a test-deployment gate, not the final AWS topology. Production should promote the same application images, use RDS PostgreSQL with TLS, S3 with least-privilege IAM, TLS at the edge, centralized logs, backups, monitoring and GitHub branch protection.
