# Beta runtime deployment result: blocked at merge gate

The owner-approved runtime request requires **STOP BEFORE MERGING** when main is needed. No merge, release dispatch, runtime installation, proxy activation or production application cutover occurred in this review. This branch is suitable for review; deployment prerequisites remain unresolved.

## Scope and source

- Branch: `p3/beta-production-readiness`, base main `6e8325730150d8a3835e2874a2cc0ff18466f512`.
- Prior commits: `05da2b7`, `3513a6e`, `775f239`, `efd5906`, `105c74a`, `21aedd7`, `9cdcee9`, `c8aede0`, `8aa6333`; this report adds review evidence only.
- Exact file manifest: `evidence/runtime-merge-review/changed-files.txt`.
- Only existing application source edits are beta config validation/defaults and the dedicated intelligence database requirement. No frontend feature edits, original migration edits, production Terraform edits or unrelated P2 work are included.
- Historical unused `modules/runtime-environment` definitions remain in this branch. The active beta root references only `modules/shared-host-beta`; it reuses the existing EC2/RDS.

## Verification

Fresh backend `go vet ./...` and `go test -race ./...`: PASS. Fresh frontend typecheck and production build: PASS. Runtime isolation unit tests, adapted hostname routing and disposable shared-edge checks: PASS. Existing offline Terraform and database rehearsal evidence remains applicable; no additional live Terraform apply was attempted.

All 214 new-history blobs were scanned against actual beta and production SSM secret values in memory: zero matches. AWS credential/private key pattern scan: zero matches. No tracked Terraform state, binary plan, runtime environment file or production credentials. Next.js generated two tracked frontend configuration edits during the build; both were restored to their original branch contents and are excluded.

The public HTTPS HTML exactly matches the approved holding page SHA256 `d35c4a69f4858622a5e561b4a38414b22f74f2481a08a2990014a29fb80b8188`.

## Prerequisites and risks

1. **Merge approval required.** The protected release workflow requires a full immutable SHA in main history and `environment: beta`. Opening this PR does not deploy the application.
2. **GitHub environment FAIL.** All three actual environment variable values differ from the approved role, existing instance and beta bucket. Exact correction approval is pending; automatic approval review rejected overwriting them because the request described them as already configured. No correction executed. The environment also has no reviewer rules or deployment branch policy; workflow checks constrain main, but environment protections need review.
3. **Graceful proxy reload unresolved.** Live/pinned Caddy 2.10.2 has `admin off`; the existing prepared activation script uses container recreation, which does not meet this request's graceful reload requirement. Do not run that script under this approval. A reviewed proxy transition is needed before TLS activation. Caddy documents signal-based reload only from 2.11.0: https://caddyserver.com/docs/running ; permissioned local admin socket alternative: https://caddyserver.com/docs/api . No live proxy changes were made.
4. **Shared-host capacity.** The existing m6g.medium has one vCPU and 4 GiB RAM. Beta introduces application load on the holding page's host; verify resource usage and credential-refresh/metadata-isolation controls before declaring readiness. Existing production recovery containers and data remain preserved.
5. **Live acceptance pending.** Private runtime, beta TLS, authentication, portal, WebSocket, responsive and security tests cannot pass until the reviewed application is deployed. Email testing must remain SES Sandbox and use a verified recipient; no production access request is authorized.

## Requested result classification

| Check | Result |
|---|---|
| Beta workflow | PASS static review; live OIDC execution pending |
| GitHub environment | FAIL: mismatched variables; correction pending |
| OIDC | PASS trust configuration; actual token/release pending |
| Existing EC2 reused | PASS infrastructure; no additional EC2 |
| `/opt/sapienworx-beta` | BLOCKED: runtime not installed |
| `sapienworx_beta` | PASS prior 53-migration bootstrap and isolation evidence |
| Beta runtime / frontend / backend / intelligence / background jobs | BLOCKED: not deployed; local build/tests PASS |
| Realtime / WebSockets | BLOCKED: live test pending |
| HTTPS / certificate / HTTP redirect | BLOCKED: beta site not activated |
| Candidate / Recruiter / Command Centre login | BLOCKED: live tests pending |
| RBAC | PASS local tests; live acceptance pending |
| SES Sandbox | MANUAL TEST PENDING: verified recipient and runtime required |
| Responsive / security smoke | BLOCKED: live application unavailable |
| www unchanged | PASS exact public holding HTML hash and HTTPS |
| beta.sapienworx.com | BLOCKED |
| Production cutover performed | NO |

## Rollback

After an initial successful beta release, retain its immutable four-image SHA. Application rollback uses `/opt/sapienworx-beta/rollback.sh <previous-full-40-character-SHA>` or the reviewed beta workflow with `action=rollback`, that SHA and `confirm_beta=BETA`. It skips migrations; never reverse production/beta data or alter www DNS. Before a first release exists, stop beta containers only and preserve database/uploads. Proxy rollback remains a separately reviewed transition because the prepared first-edge script recreates Caddy.

GitHub CI status must be reported from the actual PR after publication; local passing checks are not a substitute. Final classification: **BETA RUNTIME BLOCKED — MERGE APPROVAL REQUIRED**, with environment correction and graceful proxy transition also unresolved.
