# PuttClub Golf — Club Edition

**Play:** https://babakmoradvand-lab.github.io/Game.PuttClub.ir/

A golf simulation with a unified premium interface, bilingual player setup, 13 clubs, four swing presets, putting, live scorecard and offline support. Vanilla JavaScript / Three.js; no runtime UI framework.

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for implemented changes, preservation checks, tested journeys and known engine/asset limits. The current golfer is a genuinely skinned GLB with 51 joints and five clips; Tehran currently uses a surface-presentation switch over the MIS layout. This release does not claim identity-exact/AAA character fidelity or independently reconstructed Tehran geography.

## Selectable PuttClub course — course19

A third, independently playable course **زمین باشگاه پات کلاب** is now included: 18 holes, 54 Blue/White/Red tees, triangle terrain, tree collision, sand and golf-style penalty-area relief. See [Persian release notes and measured tests](COURSE19_RELEASE_FA.md) and [`audit/course19`](audit/course19). The source package contains one playable bunker, not thirty. The existing player/rig, legacy airborne equations, original tracer and offline worker are preserved.

## Free practice — practice1

The game-mode screen now includes a separate **Free Practice** flow alongside the existing full-round and scored single-hole modes. Range practice lets players choose a course, one of its 18 holes, and an available tee; the ball returns to that tee after each shot by default, with an optional continue-from-landing setting. Putting practice starts on the selected green, supports click/tap placement anywhere on that green, and animates the golfer walking toward the new ball position. Both practice modes allow repeat shots, do not write to the round scorecard or saved round, and return to the prior round/setup state when one exists.

Run the data and score-isolation contract with `node tests/practice-mode-contract.cjs`.

## Run

```sh
python3 -m http.server 8080 --bind 0.0.0.0
```

Open http://localhost:8080/. GitHub Pages serves the repository root, with all paths relative to `Game.PuttClub.ir/`.

## Files

- `index.html` — accessible screen structure and existing embedded course data.
- `game.js` — preserved simulation, renderer and small UI integration hooks.
- `ui.css` — shared tokens, component styling and responsive layout.
- `ui.js` — setup, overlays, settings and game-state presentation.
- `sw.js`, `manifest.json` — offline precache / PWA.
- `fonts/` — local Inter / Vazirmatn with licenses.
- `tests/` — browser and mathematical regression tests (development only).

## Offline / home-screen installation — rig11

Open the game in Safari over HTTPS and keep the first visit open until **All 48 files saved · offline ready** appears. The complete runtime (48 files) is about **14.1 MiB**: local fonts, libraries, both courses/data, textures, GLB, UI and engine. Then use **Share → Add to Home Screen**. Open once from the installed icon too, and wait for its own offline-ready message; storage sharing between Safari and standalone can vary by iOS version. Airplane mode can be used to verify offline reopening.

- On every cold opening, and on foreground resume, play is gated while the release is checked. Unchanged openings fetch only the small release descriptor and service-worker update check; game assets are served locally.
- All initial/new files are SHA-256 verified. Only a complete candidate runtime replaces the active cache. Unchanged assets are reused by hash. Failed updates keep the complete previous runtime; a failed initial install exposes Retry, not an unverified game.
- Foreground updates preserve idle round state. If an update interrupts a moving ball/swing, the pre-strike checkpoint is restored and the unfinished shot must be repeated. Scores remain session-only across ordinary cold page closures.
- iOS can evict website storage under pressure; Add to Home Screen and a best-effort persistent-storage request are not promises of permanent storage. An online check cannot be guaranteed while the phone is offline or the update server is unreachable.
- Gameplay uses compact bounded glass surfaces; setup and pre-game preferences use sculpted green neumorphic surfaces. The map and shot estimates expand on demand; the existing map tap still recenters the camera.

### Releasing another runtime build
Change `index.html`'s `putt-release` meta to a new unique version, update its runtime files, then run `python tests/build-runtime-manifest.py`. Add new required URLs to the `release.json` inventory before generating. Publish the whole build together. Never reuse a version name for different runtime content.

### Additional tests
`node tests/pwa-runtime.cjs` uses an isolated port-8081 HTTP fixture to exercise real CacheStorage, broken first installs, integrity failures, offline cold starts, transactional updates, session restoration, and migration from the previous worker under the Pages subpath. `node tests/pwa-presentation.cjs` checks all five entrance/setup screens with axe and 44px gameplay targets against port 8080. Evidence is headless Chromium / SwiftShader, not a physical iPhone/Safari hardware test.

## New rigged golfer

See [CHARACTER.md](CHARACTER.md) for the real 3D asset, five skeletal clips, grip/foot constraints, attribution and limits. The former unrigged model and whole-body rotation have been replaced. [Download GLB](pro_golfer_character.glb) · [Packed Blender source](pro_golfer_character.blend). The in-game renderer selects one head alternative; raw asset viewers may show all three available heads.

## Detail18 — model, units and after-shot view

Latest: `detail18-20261016` (2026-10-16), preserving look17 aim controls. Fixed unit scales and regulation ball, individually planted feet, natural hip reach on turf, no giant idle golfer during camera return, stale floating yardage hidden after rest. Actual cap/collar/cloth geometry refinement; face still approximate. 48 required offline resources, about 15 MiB. See RELEASE_NOTES and CHARACTER for evidence and hardware limits.

## Course19 verification / source regeneration

Run browser tests **sequentially**, especially on 2 GB machines. Requires Node and
`npm install --no-save playwright@1.51.1 axe-core@4.10.2`, then install Chromium
with `npx playwright install --with-deps chromium`. Serve this root on port 8080.

```sh
node scripts/course19-tests.cjs
node scripts/course19-rules-a11y.cjs
node scripts/course19-aim-regression.cjs
COURSE=puttclub node scripts/course19-aim-regression.cjs
node scripts/course19-look-aim.cjs
node scripts/course19-flight-regression.cjs
node scripts/course19-upgrade.cjs
node scripts/start-flow-test.cjs
node scripts/tracer-restore-test.cjs
```

The upgrade test reads the genuine previous commit `b1338d5` (git history needed).
Tests use disposable browser profiles; controlled physics fixtures are explicitly
labelled and are not claimed to be normal user shots or real player statistics.

Optional source rebuild requires the **original supplied package**, not another
copy of the already patched GLB. Install Python `numpy`, `shapely>=2` and
`mapbox-earcut`. Run `python scripts/build-course19-assets.py /path/to/original/puttclub_luxury_resort_100ha`.
This clips overlaps, fixes winding and normalized colors, exports portable PBR/UVs,
indexes geometry and matches lower-layer edges to higher surfaces. It validates all
54 tee interiors. Never feed patched output back into that builder. Finally run
`python scripts/runtime-manifest.py course19-20261016` and repeat the tests.
The original ZIP/Blender course is not redistributed. See integrated asset credits
for the distinction between supplied license claims and independently verified facts.

## Source-derived visual rebuild — quality22

The PuttClub course now uses recovered same-asset original textures, source shader fields, six authored grass-family bakes, original near-tree geometry / multi-view source atlases at distance, source nature scatters, HDR/AgX grading and bounded planar water reflections. No generic cone-tree replacements are used for this course. See [scope, offline size and limitations](QUALITY22_RELEASE_FA.md) and `audit/quality22`. The physics collision mesh and rigged player are byte-identical to course19. Target: iPhone 15 or newer; browser emulation is not a measured physical-iPhone performance result.
