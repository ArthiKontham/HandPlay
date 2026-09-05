import { useRef } from 'react';
import { useHands } from '../hands/HandTrackingProvider.jsx';
import { useCanvasLoop, toPx } from '../hands/useCanvasLoop.js';
import { LM, CONNECTIONS } from '../hands/handUtils.js';
import HowToPlay from '../components/HowToPlay.jsx';

// pinch normalized by hand size: 0 = pinched/closed, 1 = fully spread. (from RedBloom)
function calcPinch(h) {
  const thumb = h[4], index = h[8], wrist = h[0], mcp = h[9];
  const ref = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
  if (ref < 0.01) return 0;
  const d = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  return Math.min(1, Math.max(0, (d / ref - 0.15) * 1.6));
}
const palmX = (h) => (h[0].x + h[5].x + h[9].x + h[13].x + h[17].x) / 5;
const noise = (t) => (Math.sin(t * 1.3) + Math.sin(t * 2.7 + 1.5) * 0.6 + Math.sin(t * 0.7 + 0.3) * 0.4) / 2;

function drawTulipPetal(ctx, angle, length, width, hue, sat, light, bloom) {
  ctx.save();
  ctx.rotate(angle);
  const grad = ctx.createLinearGradient(0, 0, 0, -length);
  grad.addColorStop(0, `hsla(${hue + 25},${sat}%,${light - 8}%,0.9)`);
  grad.addColorStop(0.4, `hsla(${hue},${sat}%,${light}%,0.85)`);
  grad.addColorStop(0.85, `hsla(${hue - 10},${sat + 10}%,${light + 10}%,0.85)`);
  grad.addColorStop(1, `hsla(${hue - 20},${sat + 15}%,${light + 18}%,0.95)`);
  ctx.fillStyle = grad;
  ctx.shadowBlur = 12 + bloom * 18;
  ctx.shadowColor = `hsla(${hue},100%,65%,${0.25 + bloom * 0.4})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-width * 1.1, -length * 0.3, -width * 0.9, -length * 0.85, 0, -length);
  ctx.bezierCurveTo(width * 0.9, -length * 0.85, width * 1.1, -length * 0.3, 0, 0);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `hsla(${hue + 15},${sat}%,${light + 15}%,0.25)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -length * 0.85); ctx.stroke();
  ctx.restore();
}

function drawFlowerHead(ctx, cx, cy, bloom, wind, scale, time) {
  const adj = scale * (1.0 + bloom * 0.18);
  ctx.save();
  ctx.translate(cx, cy);

  const glowR = (60 + bloom * 120) * adj;
  if (bloom > 0.02) {
    const g = ctx.createRadialGradient(0, -glowR * 0.4, 0, 0, -glowR * 0.4, glowR);
    g.addColorStop(0, `rgba(255,80,130,${0.4 * bloom})`);
    g.addColorStop(0.5, `rgba(255,50,100,${0.2 * bloom})`);
    g.addColorStop(1, 'rgba(255,30,70,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -glowR * 0.4, glowR, 0, 6.283); ctx.fill();
  }

  const hue = 345, sat = 85, light = 55;
  const maxLen = 85 * adj;
  const back = [
    { a: 0, lm: 1.0, wm: 0.4, ho: 0, lo: -4 },
    { a: -0.15 - bloom * 0.7, lm: 0.95, wm: 0.38, ho: 10, lo: -2 },
    { a: 0.15 + bloom * 0.7, lm: 0.95, wm: 0.38, ho: 10, lo: -2 },
  ];
  const front = [
    { a: -0.05 - bloom * 0.55, lm: 0.9, wm: 0.35, ho: 5, lo: 2 },
    { a: 0.05 + bloom * 0.55, lm: 0.9, wm: 0.35, ho: 5, lo: 2 },
    { a: 0, lm: 0.85, wm: 0.32, ho: -5, lo: 5 },
  ];

  for (const p of back) {
    const flutter = noise(time * 1.2 + p.a * 10) * 0.04 * (1 + bloom);
    drawTulipPetal(ctx, p.a + flutter + wind * 0.1, maxLen * p.lm, maxLen * p.wm * (0.6 + bloom * 0.8), hue + p.ho, sat, light + p.lo, bloom);
  }

  if (bloom > 0.15) {
    ctx.save(); ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(180,220,100,${bloom})`;
    ctx.beginPath(); ctx.arc(0, -maxLen * 0.2, 5 * adj, 0, 6.283); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * 6.283 + time * 0.5, r = 8 * adj * bloom;
      const sx = Math.cos(a) * r, sy = -maxLen * 0.2 + Math.sin(a) * r;
      ctx.strokeStyle = `rgba(220,200,80,${bloom * 0.7})`; ctx.lineWidth = 1.5 * adj;
      ctx.beginPath(); ctx.moveTo(0, -maxLen * 0.1); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.fillStyle = `rgba(255,235,120,${bloom})`;
      ctx.beginPath(); ctx.arc(sx, sy, 2.5 * adj, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  for (const p of front) {
    const flutter = noise(time * 1.4 + p.a * 10) * 0.03 * (1 + bloom);
    drawTulipPetal(ctx, p.a + flutter + wind * 0.05, maxLen * p.lm, maxLen * p.wm * (0.65 + bloom * 0.75), hue + p.ho, sat, light + p.lo, bloom);
  }
  ctx.restore();
}

function drawLeaf(ctx, x, y, dir, size, wind) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(dir * (0.6 + wind * 0.1));
  ctx.fillStyle = 'rgba(70,170,90,0.85)';
  ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(90,220,130,0.4)';
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.5, -size * 0.4, size, 0);
  ctx.quadraticCurveTo(size * 0.5, size * 0.4, 0, 0);
  ctx.fill(); ctx.restore();
}

export default function BloomGame() {
  const { handsRef, videoRef, showVideoBg } = useHands();
  const S = useRef({ bloom: 0, growth: 0, wind: 0, tB: 0, tG: 0, tW: 0, prevX: null, time: 0, pollen: null });

  const canvasRef = useCanvasLoop((ctx, W, H, dt) => {
    const s = S.current;
    s.time += dt;
    if (!s.pollen) s.pollen = Array.from({ length: 44 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2 + 0.6, sp: Math.random() * 0.4 + 0.1 }));

    // ---- gestures ----
    const hands = handsRef.current;
    if (hands.length) {
      s.tB = calcPinch(hands[0]);                                   // first hand opens petals
      s.tG = hands.length >= 2 ? calcPinch(hands[1]) : 0.5;          // second hand grows it (baseline so one hand still shows a flower)
      const cx = palmX(hands[0]);
      if (s.prevX != null) s.tW = (cx - s.prevX) * 12;
      s.prevX = cx;
    } else {
      s.tB *= 0.94; s.tG *= 0.94; s.tW *= 0.9; s.prevX = null;
    }
    s.bloom += (s.tB - s.bloom) * 0.09;
    s.growth += (s.tG - s.growth) * 0.06;
    s.wind += (s.tW - s.wind) * 0.08;
    const totalWind = noise(s.time * 0.7) * 0.12 + s.wind * 0.18;

    // ---- background ----
    const v = videoRef.current;
    if (showVideoBg && v && v.readyState >= 2) {
      ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, W, H); ctx.restore();
      ctx.fillStyle = 'rgba(8,4,10,0.55)'; ctx.fillRect(0, 0, W, H);
    } else { ctx.fillStyle = '#0a0508'; ctx.fillRect(0, 0, W, H); }

    // ---- drifting pollen ----
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of s.pollen) {
      p.y -= p.sp; p.x += totalWind * 6;
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
      if (p.x < -4) p.x = W; if (p.x > W + 4) p.x = 0;
      ctx.fillStyle = `rgba(255,180,210,0.5)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    ctx.restore();

    // ---- hand skeleton (white points + lines) ----
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let hi = 0; hi < Math.min(hands.length, 2); hi++) {
      const pts = hands[hi].map((lm) => toPx(lm, W, H));
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (const [a, b] of CONNECTIONS) { ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke(); }
      for (const pt of pts) { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, 6.283); ctx.fill(); }
    }
    ctx.restore();

    // ---- the flower ----
    if (s.growth > 0.02) {
      const baseX = W * 0.5, baseY = H * 0.99;
      const stemH = Math.min(H * 0.52, H * 0.52 * s.growth);
      const scale = 1.3 * s.growth;
      const tipX = baseX + totalWind * 46;
      const tipY = baseY - stemH;
      const midX = baseX + totalWind * 20, midY = baseY - stemH * 0.5;

      // stem
      ctx.save();
      ctx.strokeStyle = 'rgba(70,160,85,0.95)'; ctx.lineWidth = Math.max(2, 6 * scale); ctx.lineCap = 'round';
      ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(90,220,130,0.5)';
      ctx.beginPath(); ctx.moveTo(baseX, baseY); ctx.quadraticCurveTo(midX, midY, tipX, tipY); ctx.stroke();
      ctx.restore();

      // leaves along the stem
      if (s.growth > 0.25) {
        drawLeaf(ctx, baseX + totalWind * 12, baseY - stemH * 0.4, 1, 34 * scale, totalWind);
        drawLeaf(ctx, baseX + totalWind * 16, baseY - stemH * 0.62, -1, 30 * scale, totalWind);
      }

      // flower head at the stem tip
      drawFlowerHead(ctx, tipX, tipY, s.bloom, totalWind, scale, s.time);
    }
  });

  return (
    <>
      <canvas ref={canvasRef} className="gamecanvas" />
      <HowToPlay items={[
        { g: '🖐️ Open hand', a: 'petals bloom open and glow' },
        { g: '🤏 Pinch', a: 'petals close back up' },
        { g: '🖐️🖐️ Second hand', a: 'open/pinch to grow the flower taller' },
        { g: '↔️ Sway hands', a: 'creates wind that bends the flower' },
      ]} />
    </>
  );
}
