# GoDaddy DNS cutover to AWS

Do not make these changes until the Terraform plan has been approved/applied, the Elastic IP exists, an immutable release is healthy, and a rollback owner is present.

## Preserve before changing anything

Export or screenshot the complete GoDaddy DNS zone. Record the exact current value and TTL of the apex `A` record; it currently targets GoDaddy WebsiteBuilder. Keep all NS records, SES DKIM records, GoDaddy DKIM records, MX/email records including `email.secureserver.net`, verification records, and unrelated records unchanged.

## Planned change

1. Confirm `www` is still `CNAME www -> sapienworx.com`.
2. Change only the apex record to `A @ -> <Terraform ec2_public_ip output>`.
3. Leave the existing TTL (currently approximately 30 minutes) unless the authorized cutover plan explicitly changes it.
4. Wait for public DNS to resolve both `sapienworx.com` and `www.sapienworx.com` to the Elastic IP from multiple public resolvers. Verify the exact Elastic IP with commands such as `dig @8.8.8.8 sapienworx.com A +short`, `dig @1.1.1.1 sapienworx.com A +short`, and the equivalent lookups for `www`. Do not start Caddy while either resolver still returns the previous WebsiteBuilder address; this avoids repeated failed ACME challenges and Let's Encrypt rate limits.
5. Through Session Manager, set `CADDY_ENABLED=true` in `/opt/sapienworx/runtime/deployment.conf` and redeploy the same known-good SHA only after the multi-resolver DNS checks pass. This is the first point at which Caddy should request public certificates.
6. Verify HTTP-to-HTTPS redirect, canonical `www` redirect, publicly trusted certificates, `/health/ready`, candidate/recruiter/admin login, email OTP, and CV upload/download.

## GoDaddy Website Builder lock

GoDaddy may lock the apex `A` record while the domain is attached to Website Builder. If it is locked, do not delete or disconnect anything automatically. Record the current Website Builder association and rollback values, explain that disconnecting or unpublishing will take the previous site offline, and obtain explicit owner approval before using **Unpublish** or **Disconnect Domain**. After approval, confirm the DNS record is editable before continuing with the single planned apex change.

## Rollback

If the application or certificate validation is unhealthy, disable Caddy promotion, restore `A @` to the exact WebsiteBuilder value recorded immediately before cutover, and wait for the TTL. Do not invent the old value. Do not modify mail/DKIM/NS records during rollback.

DNS rollback cannot undo user writes made after launch. If production accepted traffic, coordinate database/application recovery separately and preserve audit logs.
