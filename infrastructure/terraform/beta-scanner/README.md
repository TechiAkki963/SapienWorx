# Private beta CV scanner — review only

Do not apply this stack, deploy a task, publish signatures or modify host firewall
rules without separate approval. This independent stack never imports/modifies
the production or shared-host Terraform state. Default desired_count=0.

## Proposed configuration

Account 327301848391, ap-south-1, VPC vpc-0bd9180256c8ce970. One Linux x86 Fargate
task, 1 vCPU, 4 GiB RAM, included 20 GiB ephemeral storage. No autoscaling/Spot.
One scanner-owned subnet 10.42.20.0/24 in ap-south-1a and its own route table.
Live read-only inventory found this CIDR unused, no NAT and no existing endpoints.
There is no default internet route, public IP, public listener, load balancer or
public DNS. No new EC2/RDS. Single AZ is a deliberate beta availability tradeoff;
scanner downtime means parser unavailable, never an unscanned acceptance.

ClamAV 1.4.6 LTS upstream base is digest-pinned in deploy/beta/scanner/Dockerfile.
The eventual custom ECR scanner image must be reviewed and digest-pinned too.
Initial bootstrap needs a separately reviewed registry-only creation, approved
image publication, then a full fresh plan using that actual immutable digest.
Do not invent a digest or deploy a placeholder image to satisfy the variable.
Existing ScanClamD is reused, with exact backend contract:
`CV_CLAMD_ADDRESS=tcp://clamd.beta-scanner.sapienworx.internal:3310`.
This PR does not enable backend/frontend parser flags or change the app release.

Three interface endpoints (ECR API, ECR registry, CloudWatch logs) and one S3
gateway endpoint provide private image/signature/log paths. Only the scanner's
new route table is associated with S3. ECR private DNS applies VPC-wide; endpoint
SG explicitly preserves the existing shared host's HTTPS image pulls. Before
apply, review this DNS effect and rehearse old production and beta ECR pulls;
no public DNS/TLS/Caddy change is involved. No production route table is edited.

Port 3310 allows only the existing host's private /32, not all VPC sources.
Because beta and production share a host, that SG alone is insufficient process
isolation. Prepared isolate-backend-egress.sh must be separately reviewed/applied
and proven before parser/task activation: only current beta backend container IP
may forward to scanner subnet TCP3310; other containers and host OUTPUT denied.
Refresh those scanner-owned rules after each backend container replacement.
This PR never executes the script or modifies current host/network rules.

Scanner has no document/database/JWT permissions; task role reads only its own
signature prefix. There is no database egress. Task execution role reads only
the beta scanner ECR repository and writes only scanner health logs. Payloads,
CV text, malware bytes and secrets are never logged; ClamD stdout/stderr are
suppressed. Read-only root, dropped capabilities, ephemeral data/tmp volumes.
ClamD concurrency 1, queue 2; stream/file 1,536,000 bytes, recursive scan 12 MiB,
100 files/depth8, MaxScanTime4s; existing backend deadline6s. Limit/error/timeout,
unreachable/indeterminate responses all fail closed. Temporary scan files are
removed by ClamD; ephemeral volumes disappear with the task. Normal application
parsing remains in-memory; OCR stays off.

## Signature maintenance and health

The isolated subnet cannot contact ClamAV's public signature CDN. A separately
approved maintenance runner performs FreshClam verification, then uses the
new signature-publisher OIDC role (PutObject to this beta signature prefix only).
`publish-signatures.py` uploads immutable generation files followed by atomic
current.json. Scanner fetches over private S3 every five minutes; hash and CVD
validation precede replacement, ClamD checks for updates every60s. Non-concurrent
reload avoids double-engine memory peaks. Local PING plus verified freshness
is required for task health; >36h stale definitions terminate ClamD, fail closed.
Only health-state messages are logged, retained7days.

Maintenance scheduling is **not activated by this PR**. Before approving live
scanner use, approve a daily runner/job and demonstrate initial + subsequent
verified updates, outage/stale/malformed manifest failure and recovery. A manual
script alone is not unattended maintenance. The publisher role cannot deploy.

## Cost review (730 hours/month, USD before taxes)

Official Mumbai AWS ECS price offer inspected 2026-10-05:
https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonECS/current/ap-south-1/index.json
Linux x86 vCPU $0.04256/h, RAM $0.004655/GB-h. One task:
`730 * (0.04256 + 4*0.004655) = $44.66/month`.
Three single-AZ PrivateLink endpoints at $0.01/h each: approximately $21.90/month,
plus data at $0.01/GB. Cloud Map one registered resource ~$0.10/month, Route53 private
zone ~$0.50/month; S3/ECR/log storage, DNS requests, maintenance runner usage and
image pulls are usage-dependent. Budget **roughly $70–75/month additional** for
continuous low-volume beta operation; this is an estimate, not a spending cap.
Two-AZ endpoint redundancy would add ~$21.90/month. Stopping the task saves its
compute charge but leaves provisioned endpoint/discovery/storage charges.

Sources: https://aws.amazon.com/fargate/pricing/,
https://aws.amazon.com/privatelink/pricing/,
https://aws.amazon.com/cloud-map/pricing/.

## Validation and activation boundaries

Run Terraform fmt/validate/test (mocked offline plan) and scanner/Go unit tests.
Review a fresh live plan separately before any apply. Local tests do not prove
live Fargate routing, signature freshness, EICAR or CV onboarding acceptance.
Actual activation needs separate approval, reviewed backend-only host firewall,
scheduled signature maintenance and successful private scanner acceptance.
No new frontend/backend flags or live release are activated by this PR.

Rollback: disable beta parser flags/frontend availability through a reviewed
beta release first; set desired_count=0 after separate approval. Preserve S3
definition versions/log evidence. Restore prior scanner image digest if a task
regression occurs. Never fall back to unscanned parsing. Remove only scanner-owned
firewall rules/resources after verification, without touching Caddy/prod tables.
