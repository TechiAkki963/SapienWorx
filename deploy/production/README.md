# SapienWorx production runtime

This directory defines the single-host production runtime. PostgreSQL is not containerized; all persistent database traffic goes to private RDS. Caddy is the only service that publishes host ports.

## Topology

`Internet -> Caddy :80/:443 -> frontend :3000 or backend :8080 -> private RDS :5432`

All containers share the explicit `172.28.0.0/24` bridge. The backend trusts forwarding headers only from that network. No Docker socket is mounted, no container is privileged, and application filesystems are read-only where practical.

## First deployment

1. Terraform creates the host and writes these reviewed files to `/opt/sapienworx`; it does not start the application.
2. Bootstrap the separate database roles and replace all four SSM SecureString placeholders using the documented procedures.
3. Run the manual GitHub production workflow with a full Git SHA from `main`. The protected `production` environment must require reviewer approval.
4. The workflow builds `linux/arm64` images, pushes immutable SHA tags, and sends the deployment through Systems Manager.
5. `deploy.sh` pulls exact tags, runs forward migrations once, starts backend/frontend, verifies health, and records `runtime/deployed-sha`.
6. Caddy remains disabled initially (`runtime/deployment.conf`: `CADDY_ENABLED=false`). Do not enable it until both domain names resolve to the Elastic IP and the DNS cutover is approved.
7. After DNS is confirmed, use Session Manager to set `CADDY_ENABLED=true`, retain `ACME_EMAIL=info@sapienworx.com`, and redeploy the same SHA. Caddy will then request/renew certificates and redirect HTTP to HTTPS.

## Rollback

Run `/opt/sapienworx/rollback.sh <known-good-40-character-sha>` through an authorized SSM command. It pulls and starts the previous application images, skips migrations, performs health checks, and updates the deployed-SHA record.

Rollback never runs reverse migrations. If a forward migration is incompatible with an older binary, stop and design a deliberate database recovery or forward-fix; automatic down migrations can destroy data.

## Runtime files

- `runtime/production.env`: application-only credentials/configuration generated from SSM at every deployment, mode `0600`; never commit or copy it.
- `runtime/migration.env`: separate migrator URL, mode `0600`, exposed only to the one-shot migration container.
- `runtime/deployment.conf`: non-secret Caddy enablement and ACME contact.
- `runtime/caddy-data`: certificate state; retained across container replacement.
- `runtime/deployed-sha`: last healthy release.

Deployment output deliberately avoids printing decrypted SSM values. Docker image and container logs are size-limited locally and collected by the CloudWatch Agent.
