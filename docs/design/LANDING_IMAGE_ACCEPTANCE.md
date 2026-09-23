# Workstream 2 — Landing-page image acceptance plan

## Source of truth

The approved desktop-and-phone *Image 2* is the composition and art-direction reference. The composite is not an archive of independent source photographs. **Do not crop faces from the composite and ship them as production images:** text/overlays, compression and insufficient native resolution make this unsuitable.

The live application must not be represented as pixel-identical to the reference until approved full-resolution photos have been supplied or separately generated and reviewed.

## Intended image mapping and acceptance criteria

| Section | Reference subject and framing | Production state | Image requirements |
| --- | --- | --- | --- |
| Hero | Smiling professional with glasses, pale workspace, face unobstructed | Bundled hero portrait | Landscape 3:2, subject to right, space for copy/search; desktop and phone crop checked |
| Discover | Woman independently working on laptop | Bundled recruiter-review photograph is **temporary** | Landscape 3:2, natural light, subject looking down at laptop |
| Grow | Smiling man in calm bright workspace | Bundled branded man portrait | Landscape 3:2, friendly expression; no duplicate of another card |
| Belong | Professional with glasses/headphones | Bundled recruiter-team photograph is **temporary** | Landscape 3:2, warm human context, no unnatural crop |
| Knowledge: résumé | Thoughtful candidate with laptop | Control Centre-owned published cover | Landscape 3:2; unique from journey and other covers |
| Knowledge: interview | Interview preparation/conversation | Control Centre-owned published cover | Landscape 3:2; no repeat subject/crop from other cards |
| Knowledge: skills | Working/learning with laptop | Control Centre-owned published cover | Landscape 3:2; purposeful work context |
| Knowledge: humans + AI | Professional with tools, subtle tech context | Control Centre-owned published cover | Landscape 3:2; do not suggest unimplemented AI functionality |
| Final CTA | Same human portrait as hero, integrated into dark-blue banner | Intentionally reuses hero | Same approved asset, distinct crop and clear copy |

Editorial cover paths are persisted in PostgreSQL and editable in the Control Centre. Do not hardcode article covers in the homepage or overwrite auth/role-photo files when updating landing assets. New covers require a safe allow-list update and a deliberate data migration or editor selection.

## Release gates

- Asset ownership and permissions documented; original source at least 1600px wide for desktop heroes and at least 1000px for editorial cards.
- Preserve skin tone, transparent boundaries and natural cropping; no visible overlay blocking faces or text.
- Validate 320, 360, 375, 390, 430, 768, 1024, 1280, 1440 and 1920px.
- No accidental reused image between Discover/Grow/Belong or between Knowledge Hub cards.
- Load actual final image URLs, verify nonzero decoded width and render desktop/mobile screenshots before approval.
- Keep PR #31 in draft and do not merge/deploy without product-owner review.
