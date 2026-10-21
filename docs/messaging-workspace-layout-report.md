> Historical local report/plan: its original release status and test counts describe the dated work below. For the reconciled source scope, forward migration numbers and activation boundaries, see [the 22 October release note](UI_UX_BETA_RECONCILIATION_20261022.md).

# Messages workspace: bounded history and pinned composer

Date: 15 October 2026. Result: PASS locally.

Branch: `codex/recruiter-messages-layout`.
Base: `b00fab7ee80f7eb4791d64e2e85e95657643129e`.

## Outcome

Recruiter Messages and Candidate Inbox now occupy the available application height. The conversation header and composer remain in their conversation column; the history scrolls independently. The conversation list and desktop candidate context also scroll independently. Desktop does not use a composer fixed to the browser viewport.

New incoming and successfully sent messages scroll the history to the latest message without scrolling the document. The last bubble has bottom breathing room. A one-line desktop composer is within the requested 72–88 px range. Multiline input expands to a maximum of 144 px (or 25dvh on short viewports), then the textarea scrolls internally. Sending clears the draft and restores the one-line height; a failed send preserves the entire draft and presents an inline error.

## Root causes and changes

| Finding | Change |
| --- | --- |
| Minimum heights and an unconstrained grid allowed content to grow the page. | Bound the application frame and main region on Messages routes; propagate `min-height: 0` through the workspace, columns and history. |
| `scrollIntoView` could scroll ancestors. | Scroll the history element directly; observe history/content resizing and clean up observers when the active thread changes or unmounts. |
| Visually hidden read-receipt text could contribute document overflow outside the history clipping boundary. | Give history and individual message rows positioned containing blocks. The 100-message regression asserts the document remains viewport-height. |
| A long reply could leave the textarea expanded after clearing. | Reset to natural one-row height before measuring non-empty input; measure in a layout effect. |
| Repeated headings consumed conversation space. | Compact page title and list header; counterparty name leads the active conversation, followed by job context. |
| Bubbles stretched across a wide desktop canvas. | Center an 832 px maximum readable thread; cap desktop bubbles at 65% and tighten their spacing. |
| Candidate context competed with the conversation. | Use a 288 px desktop panel grouped into Candidate, Hiring for and existing navigation actions; add collapse/show controls. Retain the accessible contextual dialog on narrower screens. |
| Mobile context label crowded the candidate identity. | Use a compact, accessible Candidate Context icon on phones. |
| Message timestamps competed with message text. | Neutral secondary timestamps and readable dark-mode read indicators. |

Mobile layout keeps the composer above portal navigation, reserves safe-area spacing, and responds to visual viewport height changes. Short viewports hide redundant page chrome. History is keyboard-focusable and incoming content has a polite conversation log. Enter sends, Shift+Enter inserts a newline, and composing input methods do not submit on Enter.

## Verification

- **34/34 Chromium browser checks passed**, including 29 focused Messages checks and the five existing inbox/notification regression checks.
- **Production Next.js build passed**, including its TypeScript phase.
- **Standalone TypeScript check passed**, including a final run after restoring the generated `next-env.d.ts` file.
- **48 screenshots captured**: Recruiter and Candidate × eight viewports × Light, Dark and System. Representative desktop, tablet and phone views were visually inspected, including the narrow 360 px layout.
- Viewports: 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 428×926, 390×844, 360×800. Existing inbox regressions additionally cover a 320 px conversation.
- Tested 100-message histories: top-of-history scrolling, keyboard PageDown, incoming WebSocket frames, sending/persistence requests, latest-message visibility, stationary header/composer, document height and horizontal bounds.
- Tested 40-line replies: growth/cap, textarea overflow, failed-send draft preservation, retry and height reset.
- Tested thread switching, an empty thread, first message, mobile Back, a 40-conversation list, search/unread filters, context collapse/expand, dialog keyboard containment/Escape/focus return, and notification deep links.
- Tested a keyboard-sized 390×480 viewport. System appearance responds live to OS appearance changes. Leaving Messages restores the ordinary page shell.
- No page exceptions occurred in the focused visual matrix.

Commands, from `frontend` with isolated E2E ports 3367/18647:

```text
node node_modules/@playwright/test/cli.js test messaging-layout.spec.ts p2.2-messaging-inbox-visual.spec.ts --max-failures=2 --reporter=line
node node_modules/next/dist/bin/next build
node node_modules/typescript/bin/tsc --noEmit
```

Screenshot gallery: `frontend/visual-artifacts/messaging-layout/index.html`.
Local verification logs: `tmp/messages-acceptance.log` and `tmp/messages-production-build.log` (ignored).

## Scope and limits

This implements the requested composer/history fix and related layout polish from the Messages reference. Existing messaging APIs, authorization, persistence, WebSocket transport, typing and read-receipt logic are retained. No database or backend changes, new dependencies, or external integrations were added. The reference's proposed structured availability/slot-booking workflow, message attachments and new template composer actions are separate product features; they are not represented by nonfunctional buttons in this change. Existing profile/interview links remain available.

Browser verification uses the local application with synthetic API fixtures and simulated WebSocket delivery. It is not live beta acceptance. Physical iOS/Android keyboards, Safari/Firefox and assistive technology have not been manually tested; the reduced-height viewport test is a simulation, not a physical-device claim.

Release scope: local source commit only. No push, PR, merge, deployment, AWS, Caddy, TLS, DNS, production or beta data changes were performed. Pending AI foundation, parser contracts and recruiter sharing worktrees remain separate.

## Mobile conversation header refinement

The mobile Back control is now a single outline arrow in a 44×44 px button with the accessible name `Back to conversations`. It remains hidden on desktop. The shared component applies the same behavior to recruiter and candidate conversations.

All 9 focused browser checks passed, including restoring a scrolled 40-conversation list without losing search, selected conversation, or the recruiter unread filter. Captured 18 screenshots across 428×926, 390×844 and 360×800 in Light, Dark and System modes for both roles. Representative Light and Dark screenshots were visually inspected; the candidate identity has more header space and the composer remains visible. Screenshot gallery: `frontend/visual-artifacts/messaging-mobile-header/index.html`. Evidence: `tmp/mobile-header-tests.log` (ignored).
