# Public mascot holding bundle

Prepared for owner review; not deployed. `public/mascot.png` is the original
3D woodpecker reference `1000185808.png` retrieved from the owner's
“Create Sapienworx Mascot” chat. CSS frames its central banner without modifying
the original image. No generated image is included. The page is self-contained
HTML/CSS with no JavaScript or external URLs.

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
