# Public job sharing

Public `/jobs/{uuid}` pages emit server-rendered, job-specific title, description,
canonical, Open Graph and Twitter large-image metadata. `/jobs/{uuid}/social-card`
returns a 1200×630 PNG with the compact SapienWorx logo tile, job title/company,
location/work mode/experience/skills and the current public domain.

The public Go job-detail response adds company logo and required skills from the
existing company/job records. Its public/active/deadline filter is unchanged.
Metadata, page and image all use that anonymous endpoint, without session cookies.
403/404 are controlled not-found responses; server failures remain errors. Images
use `no-store`, so unpublishing a job cannot leave an app-cached public image.

The Jobs listing loading screen lives in `(browse)` so it does not wrap individual
job details. Shared job pages return full HTML without JavaScript, including the
correct HTTP error status when unavailable. Existing job URLs and share actions
are unchanged; sharing a link creates no referral record.

Canonical/image URLs accept only the existing SapienWorx public Host names and
loopback development hosts. Forwarded host/protocol values are ignored. Beta links
remain on beta; no public-domain promotion or DNS change is part of this feature.

Company logo retrieval supports public HTTPS PNG/JPEG assets. It rejects private,
loopback and link-local addresses, credentials and nonstandard ports; verifies all
DNS answers and pins the socket; does not follow redirects; and bounds total time,
bytes and decoded dimensions. Missing, blocked, invalid or unsupported logos use
company initials. Missing title/details retain a branded SapienWorx Jobs fallback.
Regular/bold image fonts and their open license are bundled under
`frontend/public/fonts/job-card`; the existing Docker public-assets copy includes
them in the standalone image.

Tests cover three social crawler user agents with metadata in the initial head,
anonymous access, canonical poisoning, JavaScript-disabled rendering, escaping,
image dimensions, reference/long/incomplete cards, lifecycle denial, upstream
errors, public logo embedding, DNS pinning and unsafe-logo fallback. The guarded
real-PostgreSQL job-security test verifies public logo/skills and private, draft,
closed, archived and expired jobs remain unavailable.

After the release is live, verify an anonymous job URL and its image on beta before
using [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) to refresh
LinkedIn's cache. This affects new shares; existing posts retain their prior
preview ([LinkedIn documentation](https://www.linkedin.com/help/linkedin/answer/a6269011)).
LinkedIn controls the surrounding native share-card layout. A local image preview
does not certify that LinkedIn has refreshed its cache.
