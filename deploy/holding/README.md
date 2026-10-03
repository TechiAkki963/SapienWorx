# Public mascot holding bundle

Published on 2026-10-04 (Asia/Calcutta) following the owner's explicit instruction
to push the existing local page unchanged. `public/mascot.png` is the owner's
original `SapienWorx Mascot Asset Sheet.png`, supplied on 2026-10-04. CSS frames
the welcome pose (x=20, y=344, width=196, height=230 in the 1536x1024 sheet)
without modifying its pixels or displaying the sheet's labels. The companion
`SapienWorx Woodpecker Mascot System.png` is preserved in
`references/woodpecker-system.png`, outside the served public directory.
No generated image is included. The page is self-contained HTML/CSS with no
JavaScript or external URLs. The printed filenames in the asset sheet are
reference labels; individual PNG files were not supplied.

`Caddyfile` serves only apex/www static files and returns 404 for API/health paths.
Other missing paths return 404 rather than falling through to a live application.
This is a standalone configuration, not a replacement for beta's Caddyfile.

For shared hosting, preserve beta's existing global/local-health blocks and its
`beta.sapienworx.com` application block, append only this file's apex/www block,
and mount this directory's `public` at `/srv/holding:ro` in the beta Caddy service.
That combined configuration and revised runtime archive must be validated and
externally tested before DNS changes. Do not paste a second global block into
beta's configuration. Production Compose/Caddy and workflows remain unchanged.

Publication readiness requires the mascot file, mobile/desktop visual review,
adapted Caddy host/upstream checks, HTTP checks proving public `/api` is 404,
beta login verification and the backup/DNS/recovery steps in
`../../docs/p3/PUBLIC-HOLDING-PLAN.md`.

## Current production deployment

Both `https://www.sapienworx.com/` and `https://sapienworx.com/` serve the exact
approved HTML and image bytes; public API paths return 404. External HTTPS and
visual checks are recorded in `../../docs/p3/evidence/holding-live.txt` and
`holding-live.png`. DNS was unchanged. Beta infrastructure was not created.

The existing production EC2 serves the static page through a separate Compose
project/network. Its application frontend/backend containers remain running
without a public Caddy route, for recovery. RDS, S3 uploads, certificates, secrets
and the original application release `4e41999fb1bf4ec352da037e7d39e140191ff70c`
are preserved. This publication does not stop EC2 billing.

Release: `/opt/sapienworx/holding/releases/775f239`.
Preserved edge container: `sapienworx-caddy-pre-holding-775f239`.
Recovery metadata: `/opt/sapienworx/runtime/holding-backup-775f239`, mode-restricted
on the host; never export its container inspection file because it can contain
runtime environment values. Original production Caddyfile remains untouched.

To recover the public application, send `rollback-775f239.sh` through an authorized
SSM RunShellScript command to instance `i-0356b55e3d7eaf72a`, then verify public
application HTTPS and `/health/ready`. No reverse migration or data restore is
needed for this static-page change. Rollback is prepared, not executed.

The manual production application workflow must remain paused during the holding
period; running it can conflict with or replace the static edge container.
Before eventual production launch, perform the deliberate holding rollback or
prepare a reviewed application-edge replacement.
