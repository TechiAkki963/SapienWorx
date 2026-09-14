# SapienWorx Phase D load testing

`load_test.js` models authenticated candidates performing highly faceted job searches against the Go API. The default profile ramps to **1,000 concurrently active virtual users** and holds the peak for five minutes.

## Requirements

- k6 installed on the load-generator host.
- A deployed SapienWorx API with `/health/ready` returning HTTP 200.
- Candidate access JWTs. For the full 1,000-candidate run, use 1,000 distinct candidate JWTs, one token per line in a file that is **not committed to Git**.
- PostgreSQL migrations through `000016_search_performance_indexes` applied before comparing production-like search latency.

No AWS S3 or SNS configuration is required for this candidate-search workload.

## Safe smoke test

Start with a small staging run before using the peak profile:

```bash
BASE_URL="https://staging-api.example.com" \
ACCESS_TOKEN="<candidate-access-jwt>" \
PEAK_VUS=20 \
RAMP_1=10s \
RAMP_2=10s \
RAMP_3=10s \
HOLD=30s \
RAMP_DOWN=10s \
k6 run performance/load_test.js
```

This validates routing, authentication, response shape, thresholds, and the load generator itself. A single token is acceptable only for a smoke run.

## 1,000-candidate staging test

Create a local file such as `/tmp/sapienworx-candidate-tokens.txt` containing one short-lived candidate access JWT per line. Do not put this file in the repository.

```bash
BASE_URL="https://staging-api.example.com" \
TOKENS_FILE="/tmp/sapienworx-candidate-tokens.txt" \
PEAK_VUS=1000 \
k6 run performance/load_test.js
```

Default ramp profile:

```text
50 VUs
  -> 25% of peak over 1m
  -> 50% of peak over 2m
  -> 100% of peak over 2m
  -> hold peak for 5m
  -> ramp to 0 over 1m
```

The workload rotates facets across keyword, location, company, work mode, experience, education, and pagination. Each virtual user is deterministically assigned a token from the supplied token pool.

## Acceptance thresholds

The script fails when any of these are breached:

```text
HTTP request failure rate      < 1.0%
Candidate search failure rate  < 1.0%
Malformed payload rate         < 0.5%
Candidate search p95           < 800 ms
Candidate search p99           < 1500 ms
```

A JSON k6 summary is written to `performance/summary.json` after the run.

## Tuning environment variables

```text
BASE_URL
TOKENS_FILE
CANDIDATE_TOKENS       comma-separated fallback for small tests
ACCESS_TOKEN           single-token fallback for smoke tests
PEAK_VUS               default 1000
THINK_MIN_MS           default 250
THINK_MAX_MS           default 1000
RAMP_1                 default 1m
RAMP_2                 default 2m
RAMP_3                 default 2m
HOLD                   default 5m
RAMP_DOWN              default 1m
```

## Operational rules

- Run the 1,000-VU profile against an isolated staging environment or a specifically approved performance environment.
- Do not run it against production without an explicit traffic window, rollback plan, and database monitoring.
- Monitor API CPU/RSS, PostgreSQL CPU/connections/slow queries, request latency, error rate, and pgxpool wait/acquire metrics if exposed.
- Use short-lived candidate JWTs and destroy the token file after testing.
- Do not include OTP/SNS endpoints in this load scenario; Phase C abuse limits and SMS cost controls are tested separately.
