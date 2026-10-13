# Full-height recruiter shell and shared Settings gear — local acceptance

13 October 2026. Committed baseline: `dd35b8db19150eea8fbbbe19e39ec952a6f8aaad`, branch `codex/recruiter-governed-workspace`.

**LOCAL ACCEPTANCE PASS.** The full-height sidebar specification and subsequent Settings-icon request are implemented and visually inspected. This report records local validation before the separately approved commit and beta rollout. The earlier PR's passing CI applies to its committed baseline; the release must pass fresh checks at its final head. Live release results are recorded separately from this local report.

## Implemented result

The desktop recruiter sidebar owns the left edge from top to bottom, with no inset-card radius. Its approved white wordmark appears once; the navbar has no brand. Collapsing the 248px sidebar to 68px moves the 64px navbar and content together, reclaiming 180px. A 32px edge chevron replaces the former Collapse sidebar row. Cookie state is read on the server. Transitions respect reduced motion.

The navbar retains the existing candidate search and submits to `/recruiter/pipeline`. Its desktop input uses 320–560px and shrinks on smaller screens. Appearance, notifications, Settings and account controls remain accessible. The sidebar navigation scrolls independently on short desktops; branding and chevron stay fixed. Collapsed tooltips render outside the scroll region.

Preferences is removed from both desktop and mobile sidebar configuration. My Profile remains. The existing `/recruiter/settings` route now has a labelled personal Preferences region with System/Light/Dark controls, separate from account, organization and recovery information. Mobile bottom navigation and More remain; More contains the recruiter brand.

The Jobs table preserves all existing operational columns. Compact widths at 1024–1279px keep titles readable and fit the complete table without horizontal scrolling at the requested viewports. This fixes title squeezing found during full-size visual review.

## Shared Settings gear

`components/ui/settings-icon.tsx` supplies one eight-tooth outline and central circle. `components/ui/settings-link.tsx` supplies the existing-route shortcut and current-page state.

| Property | Implemented value |
|---|---|
| SVG | 22×22px, 1.8px non-scaling stroke, round caps/joins, currentColor, no fill |
| Hit area | 40×40px, circular, transparent at rest |
| Light default | Navy/slate #0f172a |
| Dark default | Very light blue #eff6ff |
| Active Settings route | Royal Blue #2563eb |
| Light hover | Pale blue #dbeafe |
| Dark hover | Subtle blue #1e3a5f; active hover #101f37 preserves contrast |
| Keyboard | Accessible link names, visible focus, Enter navigation |
| Motion | Colour/background transition only when reduced motion is not requested |

Dark active-hover contrast measures **3.19:1**, passing the 3:1 non-text contrast threshold for this control. This scoped check is not a full WCAG certification.

| Portal | Existing destination | Access preserved |
|---|---|---|
| Recruiter | /recruiter/settings | Existing recruiter route authorization |
| Candidate | /candidate/settings | Navbar and account-menu link use the same gear |
| Company Admin | /company | Existing profile/setup settings; shortcut only for primary_admin |
| Command Centre | /swx-command-centre/content-settings | Existing canAdmin/control_plane.read rule and server guard |

The Command Centre Settings navigation item also uses the shared SVG. No new Settings route or permission was introduced. The Company Admin navbar uses its existing compact brand mark below 401px to avoid a two-row header after adding the gear.

## Acceptance evidence

| Area | Result |
|---|---|
| Full-height desktop sidebar | PASS — x=0, y=0, viewport height, 248/68px, single sidebar brand |
| Navbar/search | PASS — 64px, follows sidebar width, search submits, no action collisions |
| Chevron/persistence | PASS — Enter/Space, focus, expanded state, navigation/reload and server-response HTML |
| Short-height navigation | PASS — independent scroll, fixed brand, unclipped tooltips and Escape |
| Navigation regressions | PASS — active Jobs context, unread badges, My Profile, mobile More and access explanations |
| Preferences/recovery | PASS — existing Settings/recovery routes and verified-identity flow retained |
| Appearance | PASS — System Light/Dark, live OS changes, explicit modes against opposing OS schemes |
| Jobs/responsiveness | PASS — readable title/columns; no document overflow or Jobs table horizontal scroll in checked layouts |
| Shared gear | PASS — consistent SVG, size/stroke/hit area, hover/current/focus and dark contrast |
| Scoped access | PASS — collaborator has no Company Admin shortcut; Support Admin has no Command Centre Settings shortcut and direct navigation is rejected by the existing guard |
| Browser errors | PASS — final production matrix has zero page/console errors and failed shared-Settings HTTP responses |

**23 unique focused scenarios passed across final applicable runs**, excluding repeats: nine existing governed recruiter scenarios, six sidebar/Preferences scenarios, four shared Settings scenarios, two existing recovery scenarios, one existing candidate account-menu keyboard/mobile/logout scenario and the final recovery/referral visual review. Final TypeScript validation and Next.js production build passed.

The first shared-Settings run exposed three harness issues: programmatic focus after hover was not keyboard focus, the candidate account dialog made a broad Settings selector ambiguous, and the mock lacked a control-plane read response. Final tests use actual Tab/Shift+Tab, a scoped navbar selector and a permission-checked synthetic fixture. Functional assertions were retained.

Published full-suite CI on `be52d01c736975b44aef01dae97c0c99cff369e6` exposed an additional stale visual-test selector: it expected the navbar to be a direct child of the workspace, before the full-height frame was introduced. The test now uses the page's banner landmark and retains its y=0 sticky-position assertion. The complete recovery/referral review and six sidebar scenarios passed locally, 7/7. This correction changes test selection only; the runtime UI is unchanged.

**148 production browser checks passed; 90 captures; zero errors.**

- Recruiter: 112 checks. Chromium covers 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 428×926 and 360×800. Firefox/WebKit cover 1440×900 and 360×800.
- Recruiter states: System Light, System Dark, explicit Light against dark OS and explicit Dark against light OS. Desktop includes expanded Jobs, collapsed Jobs and Settings; smaller views include Jobs and Settings.
- Other portals: 36 Settings checks across Candidate, Company Admin and Command Centre, Chromium/Firefox/WebKit, desktop/mobile and explicit Light/Dark against opposing OS schemes.
- Captures: 72 recruiter full-page images, six actual navbar default/hover/active details, and 12 other-portal Settings images. Five overview sheets and the combined Settings preview are derived and excluded from the 90.
- All 90 captures were reviewed in overview sheets, plus full-size desktop/tablet/mobile and Settings-state representatives.

The first combined production run found that the local Next-only harness lacked the deployed edge's same-origin /api proxy, causing candidate notification 404s. The harness now forwards that path to the isolated synthetic API. App API configuration was unchanged; the entire final matrix was rerun without suppressing errors.

## Artwork and release scope

Four approved PNG assets in `public/brand/recruiter` match their source SHA-256 hashes byte-for-byte. White wordmark/dark S tile serve the sidebar; the blue assets remain available. Other portal wordmarks, public branding and favicons were not replaced. The gear raster is a silhouette reference; the shipped icon is SVG.

No dependency, backend, migration, workflow, billing, entitlement, AWS, Caddy, TLS, DNS, www/apex or production-data change occurred. The new control-plane read fixture exists only in the test mock.

## Local artifacts

- Gallery: `frontend/visual-artifacts/recruiter-fullheight-shell/index.html`.
- Gear preview: `frontend/visual-artifacts/recruiter-fullheight-shell/settings-states.png`.
- Production results: `tmp/sidebar-fullheight-visual-results.json` — 148 PASS, 90 captures, 0 errors.
- Focused logs: `tmp/sidebar-fullheight-settings-functional.log` (15 recruiter passes; initial shared harness failures), `tmp/sidebar-settings-navigation-final.log` (4/4 final), `tmp/sidebar-settings-recovery-final.log` (2/2), `tmp/sidebar-settings-account-recovery.log` (1/1 candidate account).
- Published-CI selector regression: `tmp/governed-beta-banner-regression.log` (7/7, including the additional visual review).
- Build/typecheck: `tmp/sidebar-fullheight-build.log`, `tmp/sidebar-fullheight-typecheck.log`.

Evidence uses an isolated local production frontend and synthetic APIs. It does not certify live beta behavior, production data, native devices or a full screen-reader audit. This report establishes the local source-review checkpoint; subsequent publication and beta deployment require exact-head CI and separate live evidence.
