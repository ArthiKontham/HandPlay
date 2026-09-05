import { useRef, useState } from 'react';
import { useHands } from '../hands/HandTrackingProvider.jsx';
import { useCanvasLoop, toPx } from '../hands/useCanvasLoop.js';
import { LM, CONNECTIONS, isPinching } from '../hands/handUtils.js';
import HowToPlay from '../components/HowToPlay.jsx';

export default function PuzzleGame() {
  const { handsRef, videoRef, showVideoBg } = useHands();
  const [ui, setUi] = useState({ mode: 'aim', moves: 0, secs: 0, won: false, n: 3 });
  const G = useRef({ N: 3, mode: 'aim', tiles: [], empty: 8, snap: null, pinchPrev: false, startT: 0, moves: 0 });

  const neighbors = (i, N) => {
    const r = (i / N) | 0, c = i % N, o = [];
    if (r > 0) o.push(i - N); if (r < N - 1) o.push(i + N);
    if (c > 0) o.push(i - 1); if (c < N - 1) o.push(i + 1);
    return o;
  };
  const shuffle = () => {
    const N = G.current.N, count = N * N;
    G.current.tiles = [...Array(count).keys()];
    G.current.empty = count - 1;
    for (let i = 0; i < count * 40; i++) {
      const nb = neighbors(G.current.empty, N);
      const m = nb[(Math.random() * nb.length) | 0];
      [G.current.tiles[m], G.current.tiles[G.current.empty]] = [G.current.tiles[G.current.empty], G.current.tiles[m]];
      G.current.empty = m;
    }
    G.current.moves = 0; G.current.startT = performance.now(); G.current.mode = 'play';
  };
  
  const capture = () => {
    const v = videoRef.current;
    if (!v || v.readyState < 2) return;
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const cx = c.getContext('2d');
    cx.translate(c.width, 0); cx.scale(-1, 1);
    
    // Perfect square crop from center of webcam feed
    const vW = v.videoWidth, vH = v.videoHeight;
    const size = Math.min(vW, vH);
    const cropX = (vW - size) / 2;
    const cropY = (vH - size) / 2;
    
    cx.drawImage(v, cropX, cropY, size, size, 0, 0, c.width, c.height);
    G.current.snap = c; shuffle();
  };
  
  const solved = () => G.current.tiles.every((v, i) => v === i);
  const slide = (cell) => {
    const g = G.current;
    if (g.mode !== 'play' || cell < 0) return;
    if (neighbors(g.empty, g.N).includes(cell)) {
      [g.tiles[cell], g.tiles[g.empty]] = [g.tiles[g.empty], g.tiles[cell]];
      g.empty = cell; g.moves++;
      if (solved()) g.mode = 'won';
    }
  };
  const boardRect = (W, H) => {
    const size = Math.min(W, H) * 0.78;
    return { bx: (W - size) / 2, by: (H - size) / 2, size, cell: size / G.current.N };
  };
  const cellAt = (x, y, W, H) => {
    const { bx, by, size, cell } = boardRect(W, H);
    if (x < bx || y < by || x > bx + size || y > by + size) return -1;
    const cc = Math.floor((x - bx) / cell), cr = Math.floor((y - by) / cell);
    return cr * G.current.N + cc;
  };

  const canvasRef = useCanvasLoop((ctx, W, H) => {
    const g = G.current;
    ctx.fillStyle = '#040308'; ctx.fillRect(0, 0, W, H);
    const hand = handsRef.current[0];
    const cursor = hand ? toPx(hand[LM.INDEX_TIP], W, H) : null;

    // pinch edge detection
    const pinching = hand ? isPinching(hand) : false;
    if (pinching && !g.pinchPrev) {
      if (g.mode === 'aim') capture();
      else if (g.mode === 'play' && cursor) slide(cellAt(cursor.x, cursor.y, W, H));
    }
    g.pinchPrev = pinching;

    const { bx, by, size, cell } = boardRect(W, H);

    if (g.mode === 'aim') {
      const v = videoRef.current;
      if (showVideoBg && v && v.readyState >= 2) {
        ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, W, H); ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '16px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Camera feed background off. Enable camera to frame.', W / 2, H / 2 - 40);
      }
      
      // Draw glassmorphic darkened blur outside the camera target box
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, by);
      ctx.fillRect(0, by + size, W, H - (by + size));
      ctx.fillRect(0, by, bx, size);
      ctx.fillRect(bx + size, by, W - (bx + size), size);
      
      // Draw neon camera corner brackets
      ctx.strokeStyle = 'rgba(57,231,255,0.9)'; ctx.lineWidth = 3;
      const len = 25;
      ctx.beginPath();
      // top left
      ctx.moveTo(bx, by + len); ctx.lineTo(bx, by); ctx.lineTo(bx + len, by);
      // top right
      ctx.moveTo(bx + size - len, by); ctx.lineTo(bx + size, by); ctx.lineTo(bx + size, by + len);
      // bottom right
      ctx.moveTo(bx + size, by + size - len); ctx.lineTo(bx + size, by + size); ctx.lineTo(bx + size - len, by + size);
      // bottom left
      ctx.moveTo(bx + len, by + size); ctx.lineTo(bx, by + size); ctx.lineTo(bx, by + size - len);
      ctx.stroke();

      // Blinking REC icon
      const flash = (performance.now() % 1000) > 500;
      if (flash) {
        ctx.fillStyle = '#ff4fb0';
        ctx.beginPath(); ctx.arc(bx + size - 24, by + 24, 6, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(255, 79, 176, 0.4)';
        ctx.beginPath(); ctx.arc(bx + size - 24, by + 24, 12, 0, 6.283); ctx.fill();
      }
      
      // Center crosshair
      ctx.strokeStyle = 'rgba(57,231,255,0.3)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W/2 - 10, H/2); ctx.lineTo(W/2 + 10, H/2);
      ctx.moveTo(W/2, H/2 - 10); ctx.lineTo(W/2, H/2 + 10);
      ctx.stroke();

      if (hand) {
        const ti = toPx(hand[LM.INDEX_TIP], W, H), th = toPx(hand[LM.THUMB_TIP], W, H);
        ctx.fillStyle = 'rgba(57,231,255,0.9)'; ctx.beginPath(); ctx.arc(ti.x, ti.y, 8, 0, 6.283); ctx.fill();
        ctx.fillStyle = 'rgba(255,79,176,0.9)'; ctx.beginPath(); ctx.arc(th.x, th.y, 8, 0, 6.283); ctx.fill();
      }
    } else {
      // Draw live feed blurred in background
      const v = videoRef.current;
      if (showVideoBg && v && v.readyState >= 2) {
        ctx.save();
        ctx.translate(W, 0); ctx.scale(-1, 1);
        ctx.filter = 'blur(16px) brightness(28%)';
        ctx.drawImage(v, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.fillStyle = '#040308'; ctx.fillRect(0, 0, W, H);
      }

      // Draw puzzle board container border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 2;
      ctx.strokeRect(bx - 3, by - 3, size + 6, size + 6);

      const N = g.N, snap = g.snap;
      if (snap) {
        const sw = snap.width / N, sh = snap.height / N;
        for (let cellIdx = 0; cellIdx < N * N; cellIdx++) {
          const piece = g.tiles[cellIdx];
          const dc = bx + (cellIdx % N) * cell, dr = by + ((cellIdx / N) | 0) * cell;
          if (piece === N * N - 1 && g.mode === 'play') {
            ctx.fillStyle = 'rgba(176,107,255,0.12)'; ctx.fillRect(dc, dr, cell, cell);
          } else {
            ctx.drawImage(snap, (piece % N) * sw, ((piece / N) | 0) * sh, sw, sh, dc, dr, cell, cell);
          }
          ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(dc, dr, cell, cell);
        }
      }
      
      // Target hover highlighting
      if (cursor && g.mode === 'play') {
        const cl = cellAt(cursor.x, cursor.y, W, H);
        if (cl >= 0 && neighbors(g.empty, N).includes(cl)) {
          const dc = bx + (cl % N) * cell, dr = by + ((cl / N) | 0) * cell;
          ctx.strokeStyle = 'rgba(57,231,255,0.95)'; ctx.lineWidth = 4; ctx.strokeRect(dc + 2, dr + 2, cell - 4, cell - 4);
        }
        ctx.fillStyle = 'rgba(57,231,255,0.95)'; ctx.beginPath(); ctx.arc(cursor.x, cursor.y, 8, 0, 6.283); ctx.fill();
      }
      
      if (g.mode === 'won') {
        ctx.fillStyle = 'rgba(5, 4, 10, 0.65)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.font = '600 76px "Instrument Serif", serif';
        ctx.fillText('Solved!', W / 2, H / 2);
      }
    }

    // Draw hand skeleton overlay
    if (hand) {
      const pts = hand.map((lm) => toPx(lm, W, H));
      ctx.globalCompositeOperation = 'lighter';
      for (const [a, b] of CONNECTIONS) {
        ctx.strokeStyle = 'rgba(57, 231, 255, 0.35)';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke();
      }
      for (const pt of pts) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, 6.283); ctx.fill();
      }
      
      // Pinch animation
      if (pinching) {
        const th = pts[LM.THUMB_TIP];
        const it = pts[LM.INDEX_TIP];
        const px = (th.x + it.x) / 2;
        const py = (th.y + it.y) / 2;
        
        const t = (performance.now() % 500) / 500;
        ctx.strokeStyle = `rgba(57, 231, 255, ${1 - t})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(px, py, 8 + t * 25, 0, 6.283); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // sync UI
    const secs = g.mode === 'play' ? Math.floor((performance.now() - g.startT) / 1000) : 0;
    setUi((u) => (u.mode === g.mode && u.moves === g.moves && u.secs === secs && u.n === g.N
      ? u : { mode: g.mode, moves: g.moves, secs, won: g.mode === 'won', n: g.N }));
  });

  const handleClick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (G.current.mode === 'aim') capture();
    else slide(cellAt(x, y, r.width, r.height));
  };
  const setDifficulty = (n) => { G.current.N = n; if (G.current.snap) shuffle(); else G.current.mode = 'aim'; };
  const newPhoto = () => { G.current.snap = null; G.current.mode = 'aim'; };
  const restart = () => { if (G.current.snap) shuffle(); else G.current.mode = 'aim'; };

  const mm = String(Math.floor(ui.secs / 60)).padStart(2, '0');
  const ss = String(ui.secs % 60).padStart(2, '0');

  return (
    <>
      <canvas ref={canvasRef} className="gamecanvas" onClick={handleClick} />
      <div className="hud hud-tl">
        <div className="stat">⏱ {mm}:{ss}</div>
        <div className="stat">Moves {ui.moves}</div>
      </div>
      <div className="hud hud-tr">
        {[3, 4, 5].map((n) => (
          <button key={n} className={`chip ${ui.n === n ? 'on' : ''}`} onClick={() => setDifficulty(n)}>{n}×{n}</button>
        ))}
      </div>
      <div className="hud hud-br">
        <button className="chip" onClick={restart}>Restart</button>
        <button className="chip" onClick={newPhoto}>New Photo</button>
      </div>
      <HowToPlay items={[
        { g: '👉 Now', a: ui.mode === 'aim' ? 'Frame yourself, pinch (or click) to capture' : 'Pinch (or click) a tile next to the gap to slide it' },
        { g: '✋ Move hand', a: 'moves the pointer' },
        { g: '🤏 Pinch', a: 'captures the photo / slides a tile' },
        { g: '🎯 Goal', a: 'put every tile back in order' },
      ]} />
    </>
  );
}
