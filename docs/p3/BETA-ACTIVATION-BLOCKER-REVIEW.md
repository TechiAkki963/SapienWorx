# Beta activation blocker review

Prepared on `p3/beta-edge-transition` from merged main `f74706361f587f196ffa5d3c4622cdc7ffb98b70`. No deployment workflow, live proxy/TLS change, service restart, DNS edit, database change or infrastructure expansion was performed. Merge and activation require separate approval.

## GitHub: fresh verification, not the earlier assumption

The main workflow references exactly `vars.AWS_DEPLOY_ROLE_ARN`, `vars.BETA_INSTANCE_ID` and `vars.BETA_DOCUMENTS_BUCKET`, and its release job uses `environment: beta` with OIDC. Workflow names: **PASS**.

Current values were read again at **2026-10-03 22:48:47 UTC**. All three exact comparisons were false. No values were replaced. This is fresh evidence, not reliance on the prior report. **MANUAL VERIFICATION REQUIRED**: open GitHub repository Settings → Environments → beta → Environment variables and confirm/save:

| Variable | Exact expected value |
|---|---|
| AWS_DEPLOY_ROLE_ARN | arn:aws:iam::327301848391:role/sapienworx-beta-github-deployment |
| BETA_INSTANCE_ID | i-0356b55e3d7eaf72a |
| BETA_DOCUMENTS_BUCKET | sapienworx-beta-documents-327301848391-ap-south-1 |

Ensure these are environment variables, without quotation marks, extra whitespace or name/value text pasted together. The inspection suppresses unexpected stored values to avoid inadvertently publishing sensitive content. Evidence: `evidence/edge-transition/github-variables.json`.

## Actual live edge and supported alternatives

Caddy **2.10.2**, `admin off`, starts with `caddy run --config /etc/caddy/Caddyfile --adapter caddyfile`. It mounts `/opt/sapienworx/holding/releases/775f239/Caddyfile` as a read-only single file. Host ports 80/443 belong to this container. The internal health listener is 127.0.0.1:2019; it is not an admin API. Only the approved holding hosts are currently served. Existing public content hashes match exactly.

The merged activation method recreates this public container for configuration changes. That interrupts listeners, and a read-only single-file bind mount cannot reliably follow atomic host file replacement. `caddy reload` cannot work while admin is off. Upgrading just for signal reload adds unnecessary version-change risk; signal reload is documented only from 2.11.0. A permissioned Unix socket is supported, but requires additional socket/mount ownership management. This correction chooses a dedicated **127.0.0.1:2020 admin listener inside the isolated Caddy container**, never a host-published or all-interface listener.

Supported reload behavior: [Caddy API](https://caddyserver.com/docs/api), [CLI reload](https://caddyserver.com/docs/command-line), [version-specific signal support](https://caddyserver.com/docs/running).

## Prepared two-stage transition

1. After a separate explicit approval, install reviewed scripts/configs beneath `/opt/sapienworx-beta`. Existing cached Caddy 2.10.2 image and certificate directories are retained. Beta network must already exist. Verify exact public HTML and mascot hashes and blocked public application paths.
2. Run `CONFIRM_INITIAL_EDGE_TRANSITION=APPROVED_ONE_TIME_RESTART ./activate-shared-edge.sh --bootstrap-admin`. It validates the holding-only admin configuration, then recreates the edge **once**, with a read-only directory config mount and local admin enabled. It verifies public HTTPS/content before recording `edge/managed`. It does not activate beta. Failure automatically restores the original holding compose using its cached image.
3. Once reviewed beta containers are healthy, a separately approved normal `./activate-shared-edge.sh` validates DNS and the candidate Caddyfile, backs up the active file, atomically replaces it and invokes `docker exec ... caddy reload --address 127.0.0.1:2020`. It never recreates/restarts Caddy. Existing www/apex site content, headers, certificate storage and DNS are preserved. Only beta proxies to frontend/backend, including WebSocket upgrade. Caddy manages beta ACME issuance/renewal; acquisition may take minutes while public sites remain served.
4. If TLS/readiness or public checks fail, the activation exit trap restores the preceding file and reloads it. `rollback-shared-edge.sh` explicitly returns to holding-only via the same supported API. Neither rollback changes application containers, database, uploads or DNS. If Docker/host/Caddy itself is unavailable, supported reload recovery cannot operate; restore original holding compose as a separately authorized emergency fallback.

**One-time interruption required: YES.** Expect a few seconds for the cached-image listener replacement; reserve approximately 30 seconds for normal transition/recovery. This is an estimate, not a measured production guarantee. A rollback after startup failure may add another brief gap. Subsequent successful config reloads require no container restart. Long-lived WebSocket clients may reconnect on a proxy configuration reload; continuous WebSocket sessions are not promised.

## Host capacity and exposure

Read-only inspection at 22:48:51 UTC: one CPU; load 0.10/0.17/0.10; 3790 MiB RAM, 550 MiB used and **3051 MiB available**; no swap; 20 GiB disk, 4 GiB used, **16 GiB free**. Caddy/backend/frontend were healthy, using approximately 13/4/62 MiB RSS and near-zero measured CPU. Beta steady-state memory limits total 2176 MiB; migration is transient and capped at 256 MiB. Existing edge cap remains 256 MiB and 0.25 CPU. **EC2 capacity: PASS for bounded initial beta startup/smoke**, not certification of concurrent production/beta peak loads. Keep at least 512 MiB available and monitor CPU/RAM/disk during any later approved rollout. One CPU can throttle under sustained load; private production recovery containers remain running and their future demand is not represented by this idle sample.

Networks: `sapienworx-holding_default`, `sapienworx_proxy`, bridge/host/none; beta networks are not installed yet. Running Caddy publishes TCP 80/443; frontend 3000/backend 8080 are internal. SSH listens on host 22 but the previously reviewed application SG exposes only 80/443. No admin port will be published. No EC2/RDS resize or new instance is proposed. Full selective inspection is in `evidence/edge-transition/host-inspection.txt`; no environment/credential values were inspected or logged.

## Automated verification and remaining gate

Disposable local Caddy 2.10.2 tests verify exact public HTML/mascot, blocked public API/health/admin/recruiter/candidate/WebSocket paths, beta frontend/API/live/ready routing, real WebSocket handshake and echo, unknown-host isolation, container-network denial of admin access, validation, graceful reload, invalid-config rejection and holding-only rollback with the same Caddy start time. Static hostname boundary tests and shell syntax validation pass. Public preservation and beta routing: **PASS in rehearsal**. Live beta TLS remains unactivated and untested.

The PR must run CI and remain unmerged. Final status: **BLOCKED** pending exact GitHub variable confirmation, CI/review, separate merge approval, and explicit review/approval of the one-time interruption and later beta activation. No production application cutover is included.
