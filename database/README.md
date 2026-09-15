# Database

PostgreSQL migrations live in `migrations/` and are applied in ascending numeric order.

## Local development database

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Apply every migration, then load the realistic development dataset:

### macOS / Linux / Git Bash

```bash
export DATABASE_URL="postgres://sapienworx:sapienworx_local@localhost:5432/sapienworx?sslmode=disable"
for file in database/migrations/*.up.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seed.dev.sql
```

### Windows PowerShell

```powershell
$env:DATABASE_URL = "postgres://sapienworx:sapienworx_local@localhost:5432/sapienworx?sslmode=disable"
Get-ChildItem database/migrations/*.up.sql | Sort-Object Name | ForEach-Object {
  psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName
}
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f database/seed.dev.sql
```

The seed is deliberately development-only and creates enough realistic content to exercise the public job marketplace plus candidate and recruiter workspaces.

Demo credentials:

```text
Candidate: candidate.demo@sapienworx.local
Recruiter: recruiter.demo@sapienworx.local
Password for both: SapienDemo#2026
```

The seed includes multiple active jobs, candidate profiles, applications at different stages, saved jobs, notifications and upcoming interviews. It uses deterministic IDs and conflict-safe inserts so it can be rerun against the same local database.

Rollback the Phase 1 schema with:

```bash
psql "postgres://sapienworx:sapienworx_local@localhost:5432/sapienworx?sslmode=disable" -f database/migrations/000001_core_schema.down.sql
```

Production credentials must never use the local defaults or demo credentials above. Never execute `seed.dev.sql` in production.
