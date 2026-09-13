# Database

PostgreSQL migrations live in `migrations/` and are applied in ascending numeric order.

For local architecture validation:

```bash
docker compose up -d postgres
psql "postgres://sapienworx:sapienworx_local@localhost:5432/sapienworx?sslmode=disable" -f database/migrations/000001_core_schema.up.sql
```

Rollback the Phase 1 schema with:

```bash
psql "postgres://sapienworx:sapienworx_local@localhost:5432/sapienworx?sslmode=disable" -f database/migrations/000001_core_schema.down.sql
```

Production credentials must never use the local defaults above.
