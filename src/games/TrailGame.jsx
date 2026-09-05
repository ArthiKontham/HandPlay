import { useRef } from 'react';
import { useHands } from '../hands/HandTrackingProvider.jsx';
import { useCanvasLoop, toPx } from '../hands/useCanvasLoop.js';
import { CONNECTIONS, TIPS } from '../hands/handUtils.js';
import HowToPlay from '../components/HowToPlay.jsx';

const FINGER_HUE = [40, 190, 275, 320, 150]; // thumb..pinky
const TRAIL_LEN = 30;
const MAX_SPARKS = 220;

// Glow without shadowBlur: a few layered additive strokes = a soft neon core.
function glowSegment(ctx, ax, ay, bx, by, hue, coreW, alpha) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = `hsla(${hue},100%,60%,${0.14 * alpha})`; ctx.lineWidth = coreW * 4.5;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = `hsla(${hue},100%,66%,${0.32 * alpha})`; ctx.lineWidth = coreW * 2;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${0.9 * alpha})`; ctx.lineWidth = coreW * 0.7;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
}

export default function TrailGame() {
  const { handsRef, videoRef, showVideoBg } = useHands();
  const trails = useRef([[], []].map(() => TIPS.map(() => [])));
  const sparks = useRef([]);

  const canvasRef = useCanvasLoop((ctx, W, H, dt) => {
    // background
    const v = videoRef.current;
    if (showVideoBg && v && v.readyState >= 2) {
      ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, W, H); ctx.restore();
      ctx.fillStyle = 'rgba(4,3,10,0.5)'; ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#050409'; ctx.fillRect(0, 0, W, H);
    }

    ctx.globalCompositeOperation = 'lighter';
    const hands = handsRef.current;
    const nH = Math.min(hands.length, 2);

    for (let hi = 0; hi < nH; hi++) {
      const pts = hands[hi].map((lm) => toPx(lm, W, H));

      // 1) light strands weaving between the fingers (the signature look)
      for (const [a, b] of CONNECTIONS) {
        // hue drifts along the hand for a rainbow-ish weave
        const hue = (190 + a * 5) % 360;
        glowSegment(ctx, pts[a].x, pts[a].y, pts[b].x, pts[b].y, hue, 2.2, 0.9);
      }

      // 2) glowing joints
      for (const pt of pts) {
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 7);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pt.x, pt.y, 7, 0, 6.283); ctx.fill();
      }

      // 3) fingertip trails (fixed-length, so they flow and fade) + sparks on motion
      TIPS.forEach((tip, fi) => {
        const pt = pts[tip];
        const arr = trails.current[hi][fi];
        const last = arr[arr.length - 1];
        if (last) {
          const d = Math.hypot(pt.x - last.x, pt.y - last.y);
          if (d > 6) {
            const n = Math.min(2, Math.floor(d / 14) + 1);
            for (let s = 0; s < n && sparks.current.length < MAX_SPARKS; s++) {
              sparks.current.push({
                x: pt.x, y: pt.y,
                vx: (Math.random() - 0.5) * 40 - (pt.x - last.x) * 0.15,
                vy: (Math.random() - 0.5) * 40 - (pt.y - last.y) * 0.15,
                size: Math.random() * 2 + 1, hue: FINGER_HUE[fi], life: 1,
              });
            }
          }
        }
        arr.push({ x: pt.x, y: pt.y });
        if (arr.length > TRAIL_LEN) arr.shift();

        for (let i = 1; i < arr.length; i++) {
          const r = i / arr.length; // 0 old .. 1 new
          glowSegment(ctx, arr[i - 1].x, arr[i - 1].y, arr[i].x, arr[i].y, FINGER_HUE[fi], 3.4 * r, r * r);
        }
        // bright tip
        const grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 16);
        grd.addColorStop(0, '#ffffff');
        grd.addColorStop(0.25, `hsla(${FINGER_HUE[fi]},100%,70%,0.95)`);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(pt.x, pt.y, 16, 0, 6.283); ctx.fill();
      });
    }

    // age trails for hands that vanished
    for (let hi = nH; hi < 2; hi++)
      trails.current[hi].forEach((a) => { if (a.length) a.shift(); });

    // sparks
    for (let i = sparks.current.length - 1; i >= 0; i--) {
      const s = sparks.current[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.93; s.vy *= 0.93;
      s.life -= dt * 1.6;
      if (s.life <= 0) { sparks.current.splice(i, 1); continue; }
      ctx.fillStyle = `hsla(${s.hue},100%,75%,${s.life})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size * s.life + 0.4, 0, 6.283); ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
  });

  return (
    <>
      <canvas ref={canvasRef} className="gamecanvas" />
      <HowToPlay items={[
        { g: '✋ Move hands', a: 'light weaves between your fingers' },
        { g: '💨 Move fast', a: 'sparks trail off your fingertips' },
        { g: '🖐️🖐️ Both hands', a: 'twice the light to play with' },
        { g: '🎨 Just play', a: 'make glowing light art' },
      ]} />
    </>
  );
}
