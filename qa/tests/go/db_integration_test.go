package qatests

import (
	"context"
	"database/sql"
	"strings"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
)

func startPostgres(t *testing.T) (*sql.DB, func()) {
	t.Helper()
	ctx := context.Background()
	c, err := postgres.Run(ctx, "postgres:17-alpine",
		postgres.WithDatabase("sapienworx_test"),
		postgres.WithUsername("postgres"),
		postgres.WithPassword("postgres"),
		postgres.WithWaitStrategy(wait.ForLog("database system is ready to accept connections").WithOccurrence(2).WithStartupTimeout(45*time.Second)),
	)
	if err != nil {
		t.Fatal(err)
	}
	dsn, err := c.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.PingContext(ctx); err != nil {
		t.Fatal(err)
	}
	return db, func() {
		_ = db.Close()
		_ = c.Terminate(ctx)
	}
}

func TestForeignKeyIsolationAndCascade(t *testing.T) {
	db, cleanup := startPostgres(t)
	defer cleanup()

	_, err := db.Exec(`
CREATE TABLE candidates(id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL);
CREATE TABLE recruiters(id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL);
CREATE TABLE jobs(id BIGSERIAL PRIMARY KEY, recruiter_id BIGINT NOT NULL REFERENCES recruiters(id) ON DELETE CASCADE, title TEXT NOT NULL);
CREATE TABLE applications(id BIGSERIAL PRIMARY KEY, candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT, job_id BIGINT REFERENCES jobs(id) ON DELETE SET NULL);
`)
	if err != nil {
		t.Fatal(err)
	}

	var recruiterID, candidateID, jobID int64
	if err := db.QueryRow(`INSERT INTO recruiters(email) VALUES('r@qa.test') RETURNING id`).Scan(&recruiterID); err != nil { t.Fatal(err) }
	if err := db.QueryRow(`INSERT INTO candidates(email) VALUES('c@qa.test') RETURNING id`).Scan(&candidateID); err != nil { t.Fatal(err) }
	if err := db.QueryRow(`INSERT INTO jobs(recruiter_id,title) VALUES($1,'Go Engineer') RETURNING id`, recruiterID).Scan(&jobID); err != nil { t.Fatal(err) }
	if _, err := db.Exec(`INSERT INTO applications(candidate_id,job_id) VALUES($1,$2)`, candidateID, jobID); err != nil { t.Fatal(err) }
	if _, err := db.Exec(`DELETE FROM recruiters WHERE id=$1`, recruiterID); err != nil { t.Fatal(err) }

	var jobs, candidates int
	if err := db.QueryRow(`SELECT count(*) FROM jobs WHERE recruiter_id=$1`, recruiterID).Scan(&jobs); err != nil { t.Fatal(err) }
	if err := db.QueryRow(`SELECT count(*) FROM candidates WHERE id=$1`, candidateID).Scan(&candidates); err != nil { t.Fatal(err) }
	if jobs != 0 { t.Fatalf("expected recruiter jobs to cascade delete; got %d", jobs) }
	if candidates != 1 { t.Fatalf("candidate data must remain isolated; got %d", candidates) }
}

func TestFacetedSearchUsesIndexAndMeetsLatencyBudget(t *testing.T) {
	db, cleanup := startPostgres(t)
	defer cleanup()

	_, err := db.Exec(`
CREATE TABLE candidates(id BIGSERIAL PRIMARY KEY, location TEXT NOT NULL, notice_period INT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX idx_candidates_location_notice_updated ON candidates(location, notice_period, updated_at DESC);
INSERT INTO candidates(location, notice_period, updated_at)
SELECT CASE WHEN i%3=0 THEN 'Mumbai' WHEN i%3=1 THEN 'Pune' ELSE 'Bengaluru' END,
       i%90,
       now() - (i || ' seconds')::interval
FROM generate_series(1,100000) i;
ANALYZE candidates;
`)
	if err != nil { t.Fatal(err) }

	started := time.Now()
	rows, err := db.Query(`SELECT id FROM candidates WHERE location=$1 AND notice_period <= $2 ORDER BY updated_at DESC LIMIT 50`, "Mumbai", 30)
	if err != nil { t.Fatal(err) }
	defer rows.Close()
	for rows.Next() {}
	if err := rows.Err(); err != nil { t.Fatal(err) }
	if elapsed := time.Since(started); elapsed > 300*time.Millisecond {
		t.Fatalf("faceted query exceeded 300ms: %s", elapsed)
	}

	planRows, err := db.Query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT id FROM candidates WHERE location='Mumbai' AND notice_period <= 30 ORDER BY updated_at DESC LIMIT 50`)
	if err != nil { t.Fatal(err) }
	defer planRows.Close()
	var plan strings.Builder
	for planRows.Next() {
		var line string
		if err := planRows.Scan(&line); err != nil { t.Fatal(err) }
		plan.WriteString(line)
		plan.WriteByte('\n')
	}
	p := plan.String()
	if !strings.Contains(p, "Index") && !strings.Contains(p, "Bitmap") {
		t.Fatalf("expected indexed plan, got:\n%s", p)
	}
}

func TestMigrationPatternIsIdempotent(t *testing.T) {
	db, cleanup := startPostgres(t)
	defer cleanup()
	migration := `CREATE TABLE IF NOT EXISTS qa_migration_probe(id BIGSERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`
	if _, err := db.Exec(migration); err != nil { t.Fatal(err) }
	if _, err := db.Exec(migration); err != nil { t.Fatalf("second migration run must be safe: %v", err) }
}
