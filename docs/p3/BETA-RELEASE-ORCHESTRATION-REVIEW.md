# Beta release orchestration review

Focused branch `p3/beta-release-stages`, based on merged main `641bd6bf63115d5116ab38e15374a44ce9555b1a`. No live deployment, workflow dispatch, Caddy restart/reload, TLS change, DNS change, www change or production cutover was performed. This PR must remain unmerged until separately approved.

## Stage A: private runtime deployment

`beta-deploy.yml` remains manual and confirms `BETA`, a full immutable SHA and main ancestry. Its AWS job retains `environment: beta`, OIDC and the exact approved three environment variable names. It builds/pushes immutable images, deploys only beta containers and performs beta migrations. The post-deploy SSM command now runs `verify-private-runtime.py` and `verify-public-edge.sh`; public beta health checks were removed. `health-check.sh` now checks private containers exclusively, even when an older deployment configuration contains `CADDY_ENABLED=true`.

Private verification checks all three container health statuses and exact immutable images, the deployed SHA marker, runtime parameters against beta SSM, backend/worker beta configuration, actual database target and role, PostgreSQL TLS, denied production CONNECT/TEMP privileges and the complete migration version/checksum ledger against the release's beta migration image. The database probes are read-only. No secrets, cookie values or detailed credential-bearing subprocess errors are printed.

Stage A does not require public beta TLS or routing and does not invoke any edge activation/reload/restart. Its success means **private runtime ready**, not public beta live. It additionally verifies exact public HTML/mascot and unavailable public application routes. A manual first-host runtime-profile/credential-refresh/metadata-firewall setup is still a prerequisite; this focused correction does not perform that installation.

## Stage B: separately approved edge activation

New `beta-edge-activate.yml` is manual only, requires `confirm_edge_transition=BETA_EDGE`, main execution and a full main-history SHA already deployed by Stage A. Its AWS job uses `environment: beta`, short-lived OIDC, the same approved deployment role, fixed existing EC2 and exact beta bucket. Both workflows share a concurrency group so they cannot overlap. No static AWS keys or new IAM/infrastructure resources are introduced.

The host orchestrator `activate-beta-edge.sh` holds the runtime deployment lock and re-verifies Stage A and the unchanged public sites. If `edge/managed` is absent it also requires `confirm_initial_restart=APPROVED_ONE_TIME_RESTART`; without that explicit input it stops before restarting anything. The reviewed holding-only bootstrap then enables container-local admin once. Already-managed deployments bypass bootstrap and use graceful reload only.

After route activation, `verify-edge-access.py` verifies valid HTTPS/public live+ready health, synthetic Candidate/Recruiter/Master Admin login, secure cookies, current session role, API dashboard, actual portal access and logout. Non-admin accounts must be denied the admin dashboard. Credentials are read from beta SSM into memory only. MFA/access-policy failures remain failures and are never bypassed. This initial access smoke does not replace complete visual/portal/security acceptance before launch.

The wrapper exit trap restores holding-only routing through `rollback-shared-edge.sh` if activation or health/access/public checks fail. Interrupt/termination triggers the same recovery. Failed initial bootstrap retains its existing original-holding-compose recovery. Rollback does not delete beta containers, database, uploads, images or release artifacts. Host/Docker loss can prevent automatic recovery and still needs emergency owner intervention; no promise of recovery from an unavailable host is made.

## Review result

| Requirement | Prepared result |
|---|---|
| Runtime deployment workflow | PASS |
| Public beta dependency removed from Stage A | PASS |
| Separate edge activation gate | PASS |
| One-time restart separately guarded | PASS |
| Graceful reload after bootstrap | PASS |
| Holding-only rollback | PASS in fault-injection and Caddy rehearsals |
| www/apex isolation | PASS in exact-content/routing/WebSocket rehearsals |

Focused tests include successful private verification and rejection of ledger drift, production access or mismatched images; the Stage A public-route boundary; refusal of missing Stage B confirmation/private health/initial restart approval; failed access rollback; and subsequent reload-only activation. Existing actual Caddy/WebSocket/admin-isolation/invalid-config tests continue to pass. Beta safety CI, backend tests, frontend build/typecheck, E2E, Terraform validation and database rehearsal must be reported from actual CI.

Final status is **BLOCKED until CI and PR review are complete**, then **READY FOR RUNTIME DEPLOYMENT REVIEW**. Neither status authorizes merge, Stage A dispatch or Stage B activation. The owner previously confirmed the GitHub beta variable values; this sequencing-only task does not overwrite or re-inspect them.
