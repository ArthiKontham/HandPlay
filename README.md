# HandVerse (React + Vite)

Webcam hand-tracking playground — four games controlled entirely with your hands, running in the browser via MediaPipe Hands. No Unity, no native plugins.

## Run it

```bash
npm install
npm run dev
```

Vite prints a local URL (usually http://localhost:5173) and opens it. **Allow camera access** when prompted, raise a hand, and pick a game. Works best in Chrome on a laptop.

```bash
npm run build      # production build into dist/
npm run preview    # serve the production build
```

## Games
- **Live Puzzle** — pinch to snap a webcam photo, then point + pinch to slide the tiles. 3×3 / 4×4 / 5×5, timer, move counter. (Clicking works too.)
- **Particle Storm** — move to lead the swarm, open palm to repel, fist to swirl, pinch to burst.
- **Light Trails** — glowing 21-point hand skeleton with light trails off each fingertip (both hands).
- **AirDraw** — draw over the live camera with your index finger; complete a circle, star, heart, or lightning to trigger bursts and score.

## How it works
- `src/hands/HandTrackingProvider.jsx` opens the webcam once and runs MediaPipe `HandLandmarker` (Tasks API), publishing the latest landmarks via React context. The model + WASM load from the jsDelivr CDN on first run (needs internet).
- Each game is a `<canvas>` with its own animation loop reading the shared landmarks — React handles UI, the canvas handles per-frame drawing.

## Notes
- Circle and star recognition are robust; heart and lightning are heuristic (free-air drawing is noisy) — tune the thresholds in `src/hands/handUtils.js` (`recognizeShape`).
- Camera + model need HTTPS or localhost; `npm run dev` serves localhost, so it works locally out of the box.
