# Snapchat · Local Edition

An unofficial, personal Snapchat iPhone PWA recreation. **Not affiliated with Snap Inc.** It never authenticates with Snapchat or connects to Snapchat services. All friends, messages from friends, calls and social activity are fictional and simulated on your device.

**App URL:** https://manikiel.github.io/snap-cap/

## Install on iPhone

1. Open the app URL in **Safari**.
2. Tap **Share → Add to Home Screen → Add**.
3. Open Snapchat from your Home Screen, create a local profile and optionally add fictional demo conversations.
4. Enable the camera when ready. Camera and microphone permissions are separate.
5. Open the app online once and let its app shell finish caching before using it offline.

No computer, subscription, server or external account is needed to use or install the app. Installation and hardware behaviour still require verification on a physical iPhone; desktop emulation is not equivalent to iOS Safari.

## What works

| Area         | Implementation                                                                                                                                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation   | Camera-first, five tabs, horizontal touch navigation, safe areas, viewport-aware keyboard layouts, full-screen views and accessible modal sheets. Map and Spotlight intentionally explain their exclusion.                                                                          |
| Camera       | Genuine `getUserMedia`, front/rear selection, live preview, canvas photo capture, tap/hold capture, MediaRecorder video with audio, permission recovery, recording timer and supported hardware zoom/torch controls. Unsupported hardware is identified explicitly.                 |
| Capture      | Retake, save to Memories, search/select multiple fictional recipients, local snap delivery and local Story publication.                                                                                                                                                             |
| Chats        | Search, unread states, pinned chats, text, contextual deterministic replies, typing indicators, delivery/opened states, replies to messages, reactions, deletion, conversation clearing, wallpapers, per-chat activity preferences, snap viewing and genuine microphone recordings. |
| Profiles     | Local profile creation/switching, names/usernames/bios/birthdays, original SVG avatar creator, scores, milestones and settings. Profiles have separate records, **not secure authentication**.                                                                                      |
| Friends      | Fictional directory, suggestions, requests, local acceptance, removal, blocking, friendship profiles, birthdays, anniversaries, Best Friends indicators and coherent daily streaks.                                                                                                 |
| Stories      | Multiple photo/video snaps, progress bars, timed advancement, previous/next controls, hold/pause, swipe-down dismissal, replies into chats, simulated viewers, 24-hour expiry, item/Story deletion and private/custom audience settings.                                            |
| Memories     | IndexedDB media, JPEG photo compression, thumbnails, date groups, imports from Files, search, video/favourite filters, collections, metadata editing, exports/sharing and deletion. No advanced editing or AR toolkit.                                                              |
| My Eyes Only | AES-256-GCM encrypted media and thumbnails; PBKDF2-SHA-256 with a random 16-byte salt and 600,000 iterations. Non-extractable key in memory only. No stored plaintext PIN/key.                                                                                                      |
| Activity     | Persisted local notifications and unread indicators for messages, snaps, requests, Story views and achievements. No remote push infrastructure.                                                                                                                                     |
| Calls        | Clearly labelled fictional incoming/outgoing voice/video call simulations, accept/decline controls and local conversation activity. No real calls or transmission.                                                                                                                  |
| Settings     | Light/dark/system themes, text scaling, reduced motion, simulation controls, local privacy/audience preferences, retention, blocked friends, storage estimates, persistence requests, backups, cache cleanup and profile reset.                                                     |
| Offline      | Content-hashed app-shell cache, local database/media access, offline simulation and update-ready reload prompt. No external images, fonts, trackers, analytics or backend.                                                                                                          |

## Architecture

- **React + TypeScript + Vite**, custom mobile CSS and Lucide icons.
- **Dexie/IndexedDB**, versioned schemas, indexed account queries and atomic multi-table changes. `src/data/types.ts` defines profiles, fictional users, friendships, messages, media, Stories, activity and simulation events.
- Media metadata and binary payloads live in separate stores. The payload adapter stores efficient **ArrayBuffers** and exposes **Blobs** to camera, crypto and playback APIs. This avoids Blob serialization failures in some WebKit builds without base64 or localStorage media storage.
- `src/data/engine.ts` is the shared simulation service. Sending a snap creates media/message records, schedules persisted events, updates score/streak state and records activity coherently. Blocking cancels interactions. Timers resume from persisted due times when the app reopens.
- A clock can be injected into the engine for deterministic testing. The UI subscribes through Dexie `liveQuery`. The service/data boundary can be replaced by a backend implementation later.
- Original fictional avatar and Story SVG assets are bundled. Camera media and recordings are genuine device captures.
- Production uses a restrictive Content Security Policy. React renders user text as text, never raw HTML.

### Simulation rules

- Texts receive local delivery after roughly one second. With simulation enabled, opened status and a contextual fictional reply follow a few seconds later.
- Replies use deterministic keyword/context rules and each friend's interests; there is no AI service. Fictional activity occasionally begins while the app is open. Disabling simulation stops generated replies and views.
- Sending a snap awards one local score point per recipient. Opening a received fictional snap awards one point once.
- A streak grows at most once per **UTC day** when a snap is sent and the fictional friend opens it. Consecutive days extend it; a missed day resets it. This deliberately simple local model does not reproduce Snapchat's private scoring algorithms.
- Best Friends reflects persisted interaction counts. Achievements reflect actual local actions.
- Snaps expire after viewing by default; optional 24-hour or keep-until-deleted retention is available. Stories expire after 24 hours. Expiration removes accessible references; unreferenced temporary media is collected separately. **Deletion is not guaranteed forensic erasure.**
- Story audience/privacy and notification controls affect fictional local behaviour only; there is no network privacy to configure.

## Data safety

All profiles, messages and media remain in this browser's local storage. Only small selected-profile/camera preferences use localStorage. Browser storage is **not permanent**: iOS can evict website data, and clearing site data or removing the app may erase it.

Use **Settings → Export complete JSON backup**. On iPhone, the share/download flow can save to **Files → iCloud Drive** if available. There is **no automatic iCloud synchronisation**.

Backups contain all local profiles, preferences, friendships, messages, media, Stories, activities and pending events. Private payloads remain ciphertext. Import validates formats, identifiers, enum values, media MIME types, references and account ownership, then previews counts. Restore creates separate “restored” profiles and never silently overwrites existing records. Restore is atomic.

To bound mobile memory usage, JSON backups support **32 MB of binary media** and **48 MB total file size**. Importing individual media supports up to **80 MB per file**. Export larger videos individually; remove them only after checking the exported copies before making a smaller complete backup. Public backups contain readable messages and public media: keep them somewhere you trust.

### Private Memories recovery

Private media/thumbnail bytes use authenticated encryption. A six-digit minimum PIN is supported; longer PINs are stronger against offline guessing. Basic metadata such as timestamps, type and file size remains visible in the database. Moving a Memory into My Eyes Only does not encrypt copies already sent to fictional conversations, published in local Stories or exported.

The key is discarded on lock, profile switch and when the page is hidden. There is **no PIN recovery**. Resetting deletes private media for that profile. A backup preserves ciphertext and requires the original PIN. Encryption is not protection against a compromised device or malicious extensions. Local profile switching is not a security boundary.

## Browser limitations

- Safari camera access requires HTTPS and permission. Rear/front camera choice is requested through browser constraints; hardware/browser selection varies.
- Physical flash/torch, zoom and tap-to-focus capabilities are not consistently exposed. Unsupported controls do not simulate real hardware. A brief white capture animation is visual feedback, not a claim of physical flash.
- Recording uses the browser's supported codecs. Videos are limited to **30 seconds**, voice messages to **60 seconds**. Microphone denial allows a clearly indicated silent camera video. HEIC import/playback support varies.
- iOS Safari does not support `navigator.vibrate()` haptics. Feedback is visual; no fake haptic claims are made.
- Notifications are in-app records. No remote push or closed-app simulated replies/calls are promised. Background timers may be suspended by iOS.
- File sharing/downloading is browser-dependent. iCloud Drive is a user-selected Files destination, not an app integration or automatic sync.
- Camera/media hardware, keyboard position, Dynamic Island/safe areas, codecs, screen locking, Files sharing and Home Screen installation require physical-iPhone testing.
- Layouts follow the selected five-tab Snapchat design. Snapchat's interface varies by version, region and rollout; this is not a pixel-identical official client. Original SVG avatars/scenes replace proprietary Bitmoji/Story artwork. Filters, drawing/stickers, AR lenses, real location modules and Spotlight feeds are intentionally excluded.

## Develop and test

Requires Node 22+ for development:

```sh
npm ci
npm run dev
npm test
npm run build
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

The browser test starts its own production HTTP server, runs mobile workflows and stops the server to verify genuinely cached offline reloads. Screenshots and temporary backups are generated in ignored `test-results/`. `CHROMIUM_EXECUTABLE` optionally selects a preinstalled Chromium binary; `TEST_ENGINES=chromium` or `webkit` selects one engine. Camera/audio are mocked, so these tests do **not** constitute real-device hardware testing.

Unit coverage includes account isolation, deterministic delivery/replies, blocking, score/streak rules, snap retention, Story privacy/expiry, media persistence, quota rollback, encryption integrity and backup validation/restoration.

A hidden local testing panel opens by tapping **Settings → Local edition version seven times**. It can regenerate demo conversations (with confirmation), trigger fictional activity/calls/snaps, process delivery/expiry and inspect record counts/feature support. It never prints private media or PINs.

## GitHub Pages

The Vite base, manifest scope and service worker are all `/snap-cap/`. Tabs use fragment URLs so GitHub Pages does not need server-side route rewriting. The default launch destination is always Camera.

`.github/workflows/deploy.yml` installs dependencies, runs unit tests, type-checks/builds, runs Chromium/WebKit production UI tests, uploads `dist/` and deploys with the official Pages actions. Repository **Settings → Pages → Source** must be **GitHub Actions**. Automatic enablement is attempted, but GitHub may require an administrator to enable Pages first because workflow tokens cannot always change repository administration settings.

Updates precache a new content-hashed shell, display a reload prompt and activate only when the user selects Reload. Activation removes old app-shell caches while preserving IndexedDB data. Keep the app open online to receive updates.

## Branding and assets

Snapchat and the ghost mark belong to Snap Inc. This project uses a recreated vector ghost/icon and Snapchat naming for an unofficial personal recreation; it does not represent an official client. Avatars and Story scenes are original code-generated SVGs. Lucide icons and software dependencies retain their respective licences.
