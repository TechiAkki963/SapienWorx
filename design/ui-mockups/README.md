# SapienWorx responsive UI review

This folder contains 139 PNG concept mockups mapped one-to-one to the visual files in the supplied snapshot index. The original snapshots were not modified. Open `index.html` for a thumbnail gallery or `manifest.json` for the exact source-to-output mapping and viewport size.

## Findings

- Mobile workspace navigation occupies valuable space near the top of several reference screens. The signed-in mobile concepts use a persistent five-item bottom bar; desktop retains a labeled sidebar, and tablet uses a compact icon rail.
- Dense desktop tables become readable record cards on narrow screens. Search/filter controls collapse into a single mobile entry point so the first result appears sooner.
- Repeated KPIs, headings, buttons, spacing, and color treatments now use one visual system across Admin and recruiter concepts.
- Public landing and unauthenticated security/login screens do not receive the signed-in bottom bar. The Admin login concept uses the existing dog asset.

## Scope and limitations

These are viewport-sized **design concepts**, not screenshots of implemented application changes. Example counts and names are illustrative; do not interpret them as live data. No frontend, backend, database, or deployment behavior was changed by this mockup set.

The supplied snapshot index covers Master Admin, recruiter job/discovery workflows, and public landing/Knowledge Hub references. It does not contain a candidate-portal screen set, so candidate workspace concepts are not represented here.

The generator uses local Playwright and the existing SapienWorx image assets. Re-run from the repository root with `node design/ui-mockups/generate.mjs` while the supplied snapshot directory remains at its listed path.
