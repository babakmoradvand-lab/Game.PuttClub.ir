# PuttClub Golf — Club Edition

## Implemented
- Shared forest / charcoal / ivory / champagne design system; locally hosted Inter and Vazirmatn, licensed under OFL.
- New golfer-led title screen using an existing image asset (not a replacement GLB).
- Single setup wizard: player level → course presentation → full round or practice hole.
- Handicap distance readouts calculated from the existing bag and rules, not hard-coded promises.
- Compact course-first HUD, actual wind readout, 13-club drawer, four-position swing preset slider, putting meter.
- Semantic, session-only scorecard with true completed-hole totals and clear unplayed states.
- Unified overlay controller: Escape, focus containment/restoration, accessible labels, minimum 44px primary touch targets.
- Working audio, reduced-motion and rendering quality settings; title/resume preserves the current session.
- Local fonts, updated manifest and verified offline precache.
- Correct texture/output color spaces, budgeted DPR / mobile shadow size, no GPU scene redraw behind opaque setup/title.
- Camera framing keeps the ball above the shot dock. Starting a hole clears stale camera transition state.

## Preservation
`GOLF_BAG`, `calculateShotSpecs`, `executeGolfShot` and `stepPhysics` were compared against the audited source and are byte-for-byte unchanged. All original course data blocks, geometry creation and GLB assets remain. No UI framework or runtime third-party dependency was added. Vendor scripts now load once from the existing local files; the main engine was extracted into `game.js`.

## Verification
- 110 browser assertions plus 5 recorded shot outcomes; no JavaScript exceptions, failed requests or HTTP errors in the complete regression run.
- 55 setup layout cases and gameplay / panel bounds at 11 viewport sizes: 360×800, 390×844, 430×932, 768×1024, 1024×768, 1366×768, 1920×1080, 2560×1440, 3440×1440, 800×360, 844×390.
- Mouse journey, synthesized touch journey, keyboard preset slider, focus trap and Escape.
- Full / 3/4 / Half / Chip / Putt launch callbacks and finite trajectories through actual engine physics, advanced deterministically to avoid dependence on GPU speed.
- Practice replay, next hole, final-hole scorecard and aggregate score calculations verified with explicit cup-collision fixtures. This is NOT a claim that an entire 18-hole round was manually played.
- Whole-game offline reload and GLB loading after all 46 precache entries completed.
- Zero axe WCAG 2 A/AA violations on the sampled title/setup screens (390 and 1366 widths), active gameplay and four mobile dialogs. Automated checks do not constitute accessibility certification.
- 2,160 address-direction cases plus coincident pin case.

## Remaining engine / asset limitations
1. The existing golfer has distorted UVs and no skeletal skin/rig. The redesign does not make it a photorealistic or articulated AAA character.
2. Tehran selection still changes the surface presentation and hides sand browns; actual terrain, tees, pins and layout use MIS geometry. This is explicitly disclosed in the course selector and HUD. An independently georeferenced Tehran rebuild is outside this UI release.
3. Scores are session-only, matching the original in-memory architecture. They do not survive a page reload.
4. Real iOS/Safari, actual mid-range mobile hardware, native browser zoom and a naturally played full 18-hole round were not verified. Pinch zoom is no longer disabled; safe-area handling and responsive layouts are implemented.
5. Headless SwiftShader showed substantial rendering stalls during an active shot (26 samples, median 16.7 ms, p95 983.3 ms). Software-GPU timings are not representative of device performance; no 60fps claim is made. UI blur/glow work was removed and rendering budgets reduced, but hardware profiling remains necessary.

## Key files
`index.html`, `game.js`, `ui.css`, `ui.js`, `sw.js`, `manifest.json`, `fonts/`.

## Run locally
```sh
python3 -m http.server 8080 --bind 0.0.0.0
```
Open http://localhost:8080/ (do not use file://; the GLB and service worker require HTTP).

## Browser tests
Test dependencies are not application dependencies:
```sh
npm install --no-save playwright axe-core
npx playwright install --with-deps chromium
mkdir -p audit screenshots/after
node tests/address.cjs
node tests/regression.cjs
node tests/layout-setup.cjs
node tests/panel-accessibility.cjs
```
The browser suites assume the game is served at http://localhost:8080/.
