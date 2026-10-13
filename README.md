# PuttClub Golf — Club Edition

**Play:** https://babakmoradvand-lab.github.io/Game.PuttClub.ir/

A golf simulation with a unified premium interface, bilingual player setup, 13 clubs, four swing presets, putting, live scorecard and offline support. Vanilla JavaScript / Three.js; no runtime UI framework.

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for implemented changes, preservation checks, tested journeys and known engine/asset limits. The current golfer is an unrigged GLB; Tehran currently uses a surface-presentation switch over the MIS layout. This UI release does not claim AAA character fidelity or independently reconstructed Tehran geography.

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
