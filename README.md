# Fruits Cut AR

A browser game that turns your webcam into the play surface. Fruit arcs across a live camera feed and you slice it by sweeping your index finger through the air — MediaPipe tracks 21 hand landmarks per frame, and both hands work at once for two independent blades. Built with plain JavaScript and HTML5 Canvas, with the hand-tracking model vendored locally so it runs fully offline.

## Preview

![Fruits Cut AR](Thumbnail.png)

## Live Demo

🔗 [HandPlay – Live Website](https://handplayy.vercel.app/)

## Features

- Slice fruit in mid-air with **webcam hand tracking** — no controller, no touchscreen
- Index fingertip becomes a glowing blade, with a tapered motion trail
- **Two-handed play** — each hand drives its own independent blade
- Touch and mouse fallback for phones and laptops without a camera
- 23 original fruits, each with pre-sliced halves that separate along your cut angle
- Three-layer juice effect — mist, directional streaks, and falling droplets, coloured per fruit
- Bombs, with an explosion sprite and screen shake
- **Three game modes** — Classic, Arcade, Zen — each with its own high score
- Single-stroke combo scoring: several fruit in one continuous sweep is worth more
- Camera on/off toggle, and the camera releases itself when you leave the tab
- Pause on Esc, window blur, or tab switch
- High scores saved to localStorage
- Self-diagnosing camera errors — names the exact cause and how to fix it
- Runs fully offline: no CDN, no runtime dependencies

## Game Modes

| Mode | Rules |
|---|---|
| **Classic** | Endless. +2 a fruit, −2 a bomb. Score below zero ends the run — the score is the health bar, so there are no lives. |
| **Arcade** | 60 seconds, dense waves, double points on fruit. Bombs still cost 2. |
| **Zen** | 90 seconds. No bombs, nothing to lose. Just fruit. |

## Getting Started

This project was built with **Vite, HTML5 Canvas, and MediaPipe Hands**. There are no runtime dependencies — Vite is the only package installed.

In the project directory, you can run:

### `npm install`

Installs Vite, the only dependency.

### `npm run dev`

Runs the app in development mode.
Open [http://localhost:5291](http://localhost:5291) to view it in your browser.

The camera works on `localhost` over plain HTTP — browsers treat localhost as a secure context, so there is no certificate warning.

### `npm run build`

Builds the app for production in the `dist` folder.

### Running without npm

The project also runs with nothing installed:

```
node serve.js       # or  python serve.py
```

Then open [http://localhost:8790](http://localhost:8790). On Windows, use `python`, not `python3` — the latter is a Microsoft Store alias.

> Opening `index.html` directly will not work. A `file://` URL has no `navigator.mediaDevices`, so the camera fails before it can request permission.

## Project Structure

```text
index.html                       # the entire app — 956 lines
├── <style>    lines 6–157       #   all CSS, inline
└── <script>   lines 224–956     #   ~730 lines of vanilla JS game logic

package.json                     # ESM, zero runtime dependencies
vite.config.js                   # dev :5291, preview :5292, host:true, es2020
vercel.json                      # build config + wasm/tflite MIME and cache headers
Thumbnail.png

serve.js                         # Node fallback server — no build, no npm install
serve.py                         # the same server in Python
start-windows.bat                # picks node → py → python, whichever exists
start-mac-linux.command

certs/                           # local TLS for phone testing (gitignored)
├── cert.pem
└── key.pem

public/
├── mediapipe/                   # 24 MB — MediaPipe Hands vendored locally
│   ├── hands.js
│   ├── hands.binarypb
│   ├── hand_landmark_full.tflite
│   ├── hand_landmark_lite.tflite
│   ├── hands_solution_packed_assets.data / _loader.js
│   ├── hands_solution_simd_wasm_bin.js / .wasm / .data
│   └── hands_solution_wasm_bin.js / .wasm
│
└── sprites/                     # 71 PNGs, ~1 MB
    ├── 23 fruits × 3 each       # whole, -left, -right
    └── bomb.png, bomb-blast.png
```

## Tuning

All near the top of the `<script>` block in `index.html`:

| Constant | Effect |
|---|---|
| `GRAVITY` 1500 | Higher = fruit falls faster |
| `BASE_R` 0.100 | Hitbox radius as a fraction of `min(width, height)` |
| `FILL` 1.18 | Drawn size — sprite width is `2 × r × FILL` |
| `HIT` 1.0 | Collision radius as a fraction of `r` |
| `HAND_SMOOTH` 0.45 | Raise if the blade jitters, lower if it lags your finger |
| `FRUIT_POINTS` 2 | Points per fruit |
| `BOMB_PENALTY` 2 | Points lost per bomb |

Per-fruit size and juice colour live in the `FRUITS` array. Juice colours were sampled from the centre of each fruit's own cut face.

## Notes

**Sprite alignment.** Each half is exported on the same canvas bounds as the whole fruit, so the two pieces separate cleanly along the blade angle instead of jumping apart. Halves are rotated so their split line matches your actual cut direction.

**Coordinate mapping.** Landmarks arrive normalised to the video frame, but the video renders with `object-fit: cover` — scaled and cropped. `videoToScreen()` undoes that transform, including mirroring for the front camera, which is what keeps the blade under your fingertip.

**Offline by design.** Most MediaPipe examples fetch the model from Google's CDN at runtime. This project uses the legacy `@mediapipe/hands` package, which ships its weights in the tarball, vendored into `public/mediapipe/`.

## Deployment

Deployed on **Vercel**. `vercel.json` forces `application/wasm` on the MediaPipe binaries — a `.wasm` served as the wrong MIME type refuses to instantiate and hand tracking fails silently.

Hosted over HTTPS, phones work with no certificate warning.
