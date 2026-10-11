# Quality assurance

This report records automated desktop-browser verification. It is not a physical-iPhone certification.

## Verified so far

- TypeScript and Vite production build.
- 25 Vitest tests covering real data/transactions, local simulation, encrypted payload integrity and non-destructive backup restoration.
- Chromium production UI suite: onboarding; permission rejection; text/contextual replies; reactions; snap viewing/expiry; friendship requests/blocking; themes/text scaling; backup export/import; local profile isolation/switching; mocked photo/video/audio capture; Memories; Story publication; encrypted private storage; restart persistence; offline reload and messaging.
- WebKit production UI suite: onboarding, IndexedDB binary persistence, permission rejection, chats/replies/reactions, snap viewing, Stories, friendships, appearance, backups, accounts, restart and offline reload/messaging.
- PWA lifecycle suite in Chromium and WebKit: interrupted-update recovery, a consistent installed version while updates wait, reload activation, old-cache cleanup, preserved profiles, offline subpath navigation and refresh.
- Late microphone permission is safely released after leaving a conversation in Chromium. WebKit builds without MediaRecorder explicitly report unavailable recording and do not request microphone access.
- Screenshots and container overflow checks at 320, 375 and 390 CSS pixel widths, plus 150% text size on the smallest viewport.

## Deployment configuration

The initial GitHub Actions run passed unit/build and Chromium/WebKit UI tests. Pages activation failed with “Resource not accessible by integration”: a repository administrator must set **Settings → Pages → Source → GitHub Actions**. The workflow now preserves the tested production artifact independently of the deployment job.

## Physical iPhone checks still needed

- Safari/Home Screen installation, launch icon, status bar and Dynamic Island spacing.
- Front/rear physical camera selection, torch/zoom capability reporting, capture orientation and preview mirroring.
- Native permission denial/recovery, real microphone/audio/video codecs and interrupted recordings.
- Keyboard opening/closing, focus scrolling and Home indicator behaviour.
- Touch hold/pinch/swipe interactions under real iOS gesture handling.
- Share sheet/Save to Files/iCloud Drive destinations.
- Storage pressure, eviction, app removal and background suspension.

## Deliberate limits

- Map and Spotlight are informational, as requested.
- Calls, friends, social delivery, replies and Story views are local simulations.
- No AR lenses, drawing/stickers or advanced media editor.
- No real Snapchat authentication, network messages, backend, tracking, remote push or automatic cloud sync.
- Scoring/streak rules are defined local rules; the official proprietary algorithms are not reproduced.
- Browser/hardware focus/flash/zoom support is variable and explicitly reported.
