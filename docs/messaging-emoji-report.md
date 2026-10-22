> Historical local report/plan: its original release status and test counts describe the dated work below. For the reconciled source scope, forward migration numbers and activation boundaries, see [the 22 October release note](UI_UX_BETA_RECONCILIATION_20261022.md).

# Professional emoji in Messages

15 October 2026 · **PASS locally** · `codex/recruiter-messages-layout`

This change extends the Messages layout fix in the same isolated worktree. Release scope: local source commit only; no push, merge or deployment.

## 1. Existing architecture found

Recruiter Messages and Candidate Inbox share `MessagingWorkspace`, a controlled plain-text textarea, `useSapienChat`, and `MessageBubble`. Sending uses authenticated REST; confirmed messages are delivered through the existing Gorilla WebSocket hub. The Go service stores message content in PostgreSQL `text` columns. History, thread previews, typing/read events and reconnect handling already exist.

The actual reply composer has text and Send. Templates live in the existing Outreach/Bulk InMail tools, and scheduling lives in Interviews. There is no reply-attachment transport in this implementation. This feature does not add placeholder Attachment, Templates, Schedule or mobile + controls. Existing template and interview workflows were regression-tested.

The service's existing limit is **5,000 UTF-8 bytes of trimmed message content**, rather than 5,000 visible characters. No backend policy, database schema, permission or anti-spam rule was changed.

## 2. Files changed for this increment

| File | Purpose |
| --- | --- |
| `frontend/components/messaging/emoji-picker.tsx` | Lazy Unicode picker, curated categories, recent preferences, keyboard interaction and bounded overlay positioning. |
| `frontend/lib/message-emoji.ts` | Grapheme-safe cursor/selection insertion and UTF-8 byte counting. |
| `frontend/components/messaging/messaging-workspace.tsx` | Outline smile button, picker integration, restored caret/focus and pre-submit length feedback. |
| `frontend/components/messaging/messaging-workspace.css` | Subtle toolbar control and Light/Dark picker surfaces, focus/hover/selected states. This file also contains the preceding layout fix. |
| `frontend/tests/e2e/messaging-emoji.spec.ts` | 25 emoji acceptance cases, including the responsive/theme screenshot matrix. |
| `frontend/tests/e2e/mock-api.mjs` | Make synthetic message validation reflect the existing backend UTF-8 byte limit. |
| `backend/internal/platform/httpserver/messaging_unicode_integration_test.go` | Isolated PostgreSQL, real authenticated HTTP and WebSocket Unicode verification. |
| `docs/messaging-emoji-report.md` | Implementation, measurements, evidence and limitations. |

The preceding layout change is documented in `docs/messaging-workspace-layout-report.md` and included alongside this increment. The emoji increment adds no production Go changes or migrations. The separate professional recruiter profile feature in this commit is documented in `docs/recruiter-professional-profile-report.md` and includes migration 68.

## 3. Implementation approach

- A monochrome 21 px outline smile sits beside the textarea, with a 44×44 px hit area and secondary hover/open styling. Send remains the primary action.
- The picker is a compact overlay, at most 320 px wide and 344 px high, positioned above the **entire composer**, including expanded drafts. It does not occupy layout space or move the composer. Size observers update its position when categories, notices or composer dimensions change; visual viewport listeners keep it bounded when viewport space changes.
- The 32-entry curated catalog uses native Unicode. Categories are Smileys, People, Work / Objects and Symbols. Recent appears first once available. People includes several skin tones and combined technologist emoji. There is no large dataset, image sprite, search service, GIF or sticker support.
- Selecting inserts at the saved cursor position or replaces the selected text. Grapheme boundaries protect existing skin-tone/ZWJ sequences. Multiple insertions preserve text and return focus/caret to the textarea. Selection never submits a message.
- Recent preferences retain at most 12 known catalog entries, scoped by portal/account. They contain no message content, credentials or tokens. Unknown/corrupt values and unavailable browser storage are handled safely.
- Insertions exceeding the existing byte budget are rejected whole, with feedback. Oversize typed/pasted drafts remain editable, show an inline error and cannot be sent. No emoji is sliced to fit the limit.
- Rendering remains escaped React text at the existing message typography, including emoji-only messages. There is no rich HTML renderer or special oversized emoji treatment.

## 4. Dependency decision

**No dependency added.** Reused Next.js dynamic imports and React; used browser `Intl.Segmenter`, `TextEncoder`, `ResizeObserver` and visual viewport APIs. The picker/catalog load on first open. There are no external API requests, CDN emoji assets or new integrations.

## 5. Production bundle impact

Measured against the production build of the pending layout fix immediately before this emoji change. Values sum unique Recruiter Messages entry chunks, with gzip level 6; these are comparative route-entry measurements, not an entire-page network waterfall.

| Measurement | Before | After | Increase |
| --- | ---: | ---: | ---: |
| Route-entry JavaScript, raw | 252,161 B | 258,150 B | 5,989 B |
| Route-entry JavaScript, gzip | 81,061 B | 83,539 B | **2,478 B / 2.42 KiB** |

The separate picker chunk is **5,980 B raw / 2,565 B gzip (2.50 KiB)**. Its catalog marker is absent from the initial route-entry chunks. No package or large initial dataset was introduced. The measured initial increase is about 3.1% of these entry chunks.

Evidence: ignored `tmp/emoji-route-before.json`, `tmp/emoji-bundle-comparison.json`, and the before/after static bundle reports.

## 6. Accessibility validation

The trigger has `aria-label="Add emoji"`, expanded state and dialog association. The picker uses a named nonmodal dialog, labelled categories, pressed category state, and individually named emoji buttons. Controls have visible theme-aware focus indicators; emoji choices have 44 px hit targets.

Verified Tab reaches the trigger; Enter/Space opens it; first-choice focus waits for the lazy content to become visible; arrow keys/Home/End browse choices; Escape and Close restore trigger focus; selection restores textarea focus; Tab can leave the picker. Outside dismissal does not force focus back to the trigger. There is no incorrect modal focus trap.

Keyboard focus-ring screenshots are included. This is browser accessibility verification, not a claim of a complete WCAG audit or manual screen-reader certification.

## 7. Storage, API and realtime validation

A disposable PostgreSQL 17 database loaded the 67 existing migrations. The integration gate refuses non-loopback hosts and any database name except `sapienworx_emoji_test`. Both server and client encodings were explicitly verified as `UTF8`.

Real authenticated HTTP sends were observed on both participants' real WebSockets. Verified exact content in HTTP JSON, socket payloads, persisted rows, subsequently fetched history and conversation previews. Cases included text + emoji, newline + URL, skin-tone variants, a ZWJ sequence, emoji-only content, and HTML-looking text. Database message counts confirmed no duplicate persistence.

The gate also verified outsider read/write rejection, the existing byte-limit rejection and Unicode template storage. Notification bodies continue to use the conversation subject, preserving the existing privacy behavior; an emoji-bearing subject was checked without changing notifications to expose full messages. No message-email fallback is invoked in the inspected reply path. Existing SES serializers specify UTF-8, but no real email was sent or claimed as tested.

Browser tests separately verified both directions' incoming rendering, HTTP/WS echo deduplication, persistence after reload, Unicode thread previews and recovery after reconnect. The task-owned disposable database was removed after testing. Beta/RDS and production data were not accessed.

## 8. Test results

| Gate | Result |
| --- | --- |
| Combined browser acceptance/regressions | **65 passed** |
| Emoji suite rerun after final overlay positioning | **25 passed** |
| Go race-enabled messaging/API verification | **8 top-level tests + 6 Unicode subtests passed** |
| Next.js production build, including TypeScript phase | **PASS** |
| Standalone TypeScript check | **PASS** |
| Diff whitespace/error check | **PASS** |

The 65 unique browser checks comprise 25 emoji cases, 29 bounded-layout cases, five inbox/notification regressions, two Bulk InMail/template checks and four interview-operation checks. The final 25-case rerun refreshed the emoji screenshots after the final placement correction; it is not counted as 25 additional unique scenarios.

Coverage includes cursor/selection replacement, empty input, newlines, multiple emoji, skin tones/combined Unicode, byte boundaries, no automatic submit, keyboard/focus, safe rendering, recent preferences and unavailable storage, send/reload/preview/reconnect, mobile bounds, sticky composer, and existing template/scheduling behavior.

Reproduce from `frontend` with local E2E ports 3367/18647:

```text
node node_modules/@playwright/test/cli.js test messaging-emoji.spec.ts messaging-layout.spec.ts p2.2-messaging-inbox-visual.spec.ts p2-messaging-visual.spec.ts recruiter-interview-operations.spec.ts --max-failures=2 --reporter=line
node node_modules/next/dist/bin/next build
node node_modules/typescript/bin/tsc --noEmit
```

The backend gate requires a disposable isolated database and `MESSAGING_UNICODE_TEST_DATABASE_URL`. No GitHub-hosted CI or push was performed.

## 9. Visual QA results

Checked Recruiter and Candidate at **1440×900, 1366×768, 768×1024, 428×926, 390×844 and 360×800**, in Light, Dark and System. Automated geometry assertions cover viewport/document bounds, picker bounds, separation from the composer, and an unchanged composer position on opening. Long drafts retain textarea scrolling and do not push the conversation outside its bounded region.

Representative desktop, tablet and phone screenshots were visually reviewed, including a visible keyboard focus ring, mobile Light picker, Dark/System picker and expanded drafts. The final correction keeps taller categories above the expanded typing area. A 390×480 keyboard-sized viewport also passed; this is a simulation, not a physical keyboard test.

## 10. Screenshots

**146 emoji screenshots:** both portals × six viewports × three appearances × four states (closed, open, inserted, long draft) = 144, plus two keyboard focus captures. System captures use a dark OS appearance.

Gallery: `frontend/visual-artifacts/messaging-emoji/index.html`, with portal/appearance/state filters. Images and test/build logs remain ignored local artifacts.

## 11. Remaining risks and limits

- Physical iOS/Android keyboards, Safari/Firefox and manual screen-reader behavior still need device acceptance. Native emoji artwork varies by OS/font.
- Existing supported modern browsers must provide `Intl.Segmenter`. No legacy-browser polyfill was added.
- The existing byte-based limit can fit fewer visible emoji than ASCII characters; the UI now handles this before submission rather than relying on a server failure.
- Reply attachments and embedded template/schedule menus do not currently exist; no attachment transmission or invented UI was claimed as tested. Existing Outreach templates and Interviews remain available and passed regressions.
- Live beta acceptance, RDS encoding verification and real email delivery were not performed. No deploy or activation is authorized by this task.

## 12. Recommendation for Phase 2 reactions

Keep reactions separate. Reuse the picker selection interface with a restricted set such as 👍 ✅ 🎉 ❤️ 👏. Add a participant-authorized persistence model/API, idempotent per-user toggles, realtime reaction events, and accessible reaction names/counts. Review tenancy, notification behavior and audit requirements before implementation. No reaction schema, endpoints or UI were added now.
