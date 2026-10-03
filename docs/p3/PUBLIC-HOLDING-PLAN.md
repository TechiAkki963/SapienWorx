# Public holding page and beta-first releases

Owner decision: preserve the production database and uploads; replace the public
application with a mascot holding page. Production deployment remains a separate,
manual release after complete beta acceptance. Do not merge this branch or apply
beta infrastructure automatically.

## Inspected resources and cost

Read-only AWS inspection in ap-south-1 found one running production m6g.medium
EC2 instance, one private db.t3.micro PostgreSQL instance with 20 GiB storage and
deletion protection, one encrypted 20 GiB gp3 EC2 disk, one Elastic IP, and the
production documents bucket. No beta instance/database/bucket exists yet.

At the previously retrieved regional on-demand rates and 730 hours/month, the
production EC2 compute costs approximately $18.47/month. Stopping that instance
after moving the holding page saves that compute charge. Keeping its RDS database,
disk and Elastic IP costs approximately $27.07/month before uploads, backups,
other usage and tax ($18.98 database compute + $2.62 database storage + $1.82 disk
+ $3.65 IPv4). These are estimates from configured sizes, not measured invoices.

| Arrangement | Estimated monthly planning budget, before tax/usage |
| --- | --- |
| Current production application alone | $55–75 |
| Production application plus full beta | $110–150 |
| Beta plus public static page on its EC2, production EC2 stopped, production database/uploads/disk/IP retained | $82–102 |

The holding-page arrangement saves about $18.47/month against leaving both
identically sized EC2 servers running. It does not reduce costs below today's
single application stack. Serving a static page while leaving production EC2
running yields no EC2 saving. Keeping production data live means its database
bill continues. Do not promise large savings or delete data to reach them.

AWS explains stopped-instance storage/IP charges at
https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html
and IPv4 pricing at https://aws.amazon.com/vpc/pricing/.

## Concrete target

- `www.sapienworx.com` and `sapienworx.com`: static public mascot page only.
- `beta.sapienworx.com`: beta application on its own EC2, database, private bucket,
  credentials, JWT issuer/audience and cookies.
- Preserve production RDS, S3 contents/versions, secrets, VPC access and deletion
  protections. Beta must never connect to production RDS or production uploads.
- The public static virtual host can share beta's Caddy/EC2 without routing any
  public path, including `/api`, to the application. Domain-specific routing must
  be tested before DNS changes. A public holding page does not make beta private;
  beta access policy remains a separate acceptance requirement.

## Ordered cutover and recovery

1. The original 3D woodpecker reference has been retrieved from the owner's
   “Create Sapienworx Mascot” chat and included in `deploy/holding/public`.
   Visually review the static page at mobile and desktop sizes. Assets are
   served locally, with no tracking, external integrations, login or API proxy.
2. Complete the beta infrastructure approval gate (`APPROVE BETA INFRA APPLY`),
   apply only the reviewed beta plan, configure beta secrets and isolated data,
   and deploy the reviewed main SHA through the protected beta workflow.
3. Verify production recovery before taking the public app offline: identify the
   running image SHA, record existing DNS, ensure recoverable RDS backup and S3
   versions, and confirm restart/deployment access. Retain production EC2 disk/IP
   and production Caddy certificates; never run `terraform destroy` on production.
4. Serve the reviewed holding bundle from beta's Caddy with explicit apex/www
   static hosts and the beta-only application host. Test TLS, both public hostnames,
   `/api` returning no application response, and continued beta operation.
5. Change only apex/www DNS to the beta EC2 IP once readiness is confirmed. Keep
   production running through DNS propagation and external HTTPS checks.
6. Once public traffic reaches the holding page, stop production application
   services and then its EC2 instance. Preserve its RDS, uploads, disk and IP.
   Record the intentional pause; Terraform reconciliation or a production release
   must not accidentally restart the application during the holding period.
7. Recovery: start the preserved production EC2, restore its recorded runtime
   revision if necessary, verify private database connectivity and HTTPS, then
   restore the recorded apex/www DNS. Do not overwrite production data with beta.

Changing DNS and stopping production are not implemented or executed by this
document. Existing production deployment is already manual; leave it available
for controlled recovery and eventual release rather than deleting the capability.

## Launch after beta acceptance

Finish the P3 audits and full deployed beta regression/visual acceptance matrix.
Deploy the exact tested source SHA into production with production configuration,
preserved production database and uploads. The current production workflow builds
production repository images for that SHA; inspect build-time configuration before
claiming byte-for-byte image promotion. Never rename beta into production or copy
synthetic beta users/data/secrets. Verify production health and critical journeys
before restoring public DNS. Retire or pause beta separately after release if
its running cost is no longer justified.
