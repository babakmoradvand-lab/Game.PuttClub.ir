# PuttClub Golf — Club Edition

**Play:** https://babakmoradvand-lab.github.io/Game.PuttClub.ir/

A golf simulation with a unified premium interface, bilingual player setup, 13 clubs, four swing presets, putting, live scorecard and offline support. Vanilla JavaScript / Three.js; no runtime UI framework.

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for implemented changes, preservation checks, tested journeys and known engine/asset limits. The current golfer is a genuinely skinned GLB with 51 joints and five clips; Tehran currently uses a surface-presentation switch over the MIS layout. This release does not claim identity-exact/AAA character fidelity or independently reconstructed Tehran geography.

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
