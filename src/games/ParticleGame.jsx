import { useRef } from 'react';
import { useHands } from '../hands/HandTrackingProvider.jsx';
import { useCanvasLoop, toPx } from '../hands/useCanvasLoop.js';
import { LM, CONNECTIONS, isPinching, fingerCount } from '../hands/handUtils.js';
import HowToPlay from '../components/HowToPlay.jsx';

function rotate3D(x, y, z, ax, ay) {
  const cosY = Math.cos(ay), sinY = Math.sin(ay);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;
  const cosX = Math.cos(ax), sinX = Math.sin(ax);
  const y2 = y * cosX - z1 * sinX;
  const z2 = y * sinX + z1 * cosX;
  return { x: x1, y: y2, z: z2 };
}

const CAM_D = 900;      // camera distance — large so perspective never divides by ~0
const N = 3000;

export default function ParticleGame() {
  const { handsRef, videoRef, showVideoBg } = useHands();
  const P = useRef(null);
  const angleX = useRef(0);
  const angleY = useRef(0);
  const sphereCenter = useRef(null);
  const currentRadius = useRef(150);
  const chargeRef = useRef(0);
  const wasPinchingRef = useRef(false);
  const isExplodingRef = useRef(false);
  const explosionTimeRef = useRef(0);
  const prevHandPos = useRef(null);
  const hue = useRef(180);

  const canvasRef = useCanvasLoop((ctx, W, H, dt) => {
    const baseR = Math.min(W, H) * 0.17;
    const minR = Math.min(W, H) * 0.08;
    const maxR = Math.min(W, H) * 0.34;   // hard cap — keeps |z| well under CAM_D so no singularity

    if (!P.current || P.current._w !== W || P.current._h !== H) {
      const arr = Array.from({ length: N }, () => {
        const theta = Math.acos(Math.random() * 2 - 1);
        const phi = Math.random() * Math.PI * 2;
        const lx = Math.sin(theta) * Math.cos(phi);
        const ly = Math.sin(theta) * Math.sin(phi);
        const lz = Math.cos(theta);
        return { lx, ly, lz, x: lx * baseR + W / 2, y: ly * baseR + H / 2, z: lz * baseR,
                 vx: 0, vy: 0, vz: 0, colorSeed: Math.random() };
      });
      arr._w = W; arr._h = H; P.current = arr;
    }
    if (!sphereCenter.current) sphereCenter.current = { x: W / 2, y: H / 2, z: 0 };

    const parts = P.current;
    const hands = handsRef.current;
    const primaryHand = hands[0];

    // center follows the hand
    let targetCenter = { x: W / 2, y: H / 2, z: 0 };
    if (primaryHand) {
      const wrist = toPx(primaryHand[LM.WRIST], W, H);
      const indexMcp = toPx(primaryHand[LM.INDEX_MCP], W, H);
      targetCenter = { x: (wrist.x + indexMcp.x) / 2, y: (wrist.y + indexMcp.y) / 2,
                       z: primaryHand[LM.WRIST].z * 200 };
    }
    sphereCenter.current.x += (targetCenter.x - sphereCenter.current.x) * 0.12;
    sphereCenter.current.y += (targetCenter.y - sphereCenter.current.y) * 0.12;
    sphereCenter.current.z += (targetCenter.z - sphereCenter.current.z) * 0.12;
    const cx = sphereCenter.current.x, cy = sphereCenter.current.y, cz = sphereCenter.current.z;

    // rotation: idle spin + drag
    angleY.current += dt * 0.14;
    angleX.current += dt * 0.08;
    if (primaryHand) {
      const hp = { x: targetCenter.x, y: targetCenter.y };
      if (prevHandPos.current) {
        angleY.current += (hp.x - prevHandPos.current.x) * 0.006;
        angleX.current -= (hp.y - prevHandPos.current.y) * 0.006;
      }
      prevHandPos.current = hp;
    } else prevHandPos.current = null;

    // two hands scale (clamped so it can never blow up the projection)
    let targetRadius = baseR;
    if (hands.length >= 2) {
      const p1 = toPx(hands[0][LM.WRIST], W, H);
      const p2 = toPx(hands[1][LM.WRIST], W, H);
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      targetRadius = Math.max(minR, Math.min(maxR, dist * 0.5));
    }
    currentRadius.current += (targetRadius - currentRadius.current) * 0.12;

    // pinch charge / release explosion
    const pinching = primaryHand ? isPinching(primaryHand) : false;
    let pinchPt = null;
    if (primaryHand) {
      const pTip = toPx(primaryHand[LM.INDEX_TIP], W, H);
      const tTip = toPx(primaryHand[LM.THUMB_TIP], W, H);
      pinchPt = { x: (pTip.x + tTip.x) / 2, y: (pTip.y + tTip.y) / 2 };
    }
    if (pinching && pinchPt) {
      chargeRef.current = Math.min(1, chargeRef.current + dt * 0.85);
      wasPinchingRef.current = true;
    } else {
      if (wasPinchingRef.current && chargeRef.current > 0.08) {
        isExplodingRef.current = true; explosionTimeRef.current = 0;
        const force = 30 * chargeRef.current;
        for (const p of parts) {
          const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz, len = Math.hypot(dx, dy, dz) || 1;
          p.vx = (dx / len) * (force + Math.random() * 16);
          p.vy = (dy / len) * (force + Math.random() * 16);
          p.vz = (dz / len) * (force + Math.random() * 16);
        }
      }
      wasPinchingRef.current = false;
      chargeRef.current = Math.max(0, chargeRef.current - dt * 2);
    }

    // finger-count color
    if (primaryHand) {
      const HUES = [0, 50, 120, 185, 260, 315];
      const t = HUES[fingerCount(primaryHand)] ?? 185;
      hue.current += (t - hue.current) * 0.12;
    }
    if (isExplodingRef.current) {
      explosionTimeRef.current += dt;
      if (explosionTimeRef.current > 1.8) isExplodingRef.current = false;
    }

    // background
    const v = videoRef.current;
    if (showVideoBg && v && v.readyState >= 2) {
      ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(v, 0, 0, W, H); ctx.restore();
      ctx.fillStyle = 'rgba(6,5,12,0.72)'; ctx.fillRect(0, 0, W, H);
    } else { ctx.fillStyle = '#040308'; ctx.fillRect(0, 0, W, H); }

    // physics
    let radius = currentRadius.current;
    if (chargeRef.current > 0) radius *= (1 - chargeRef.current * 0.55);
    const jitter = chargeRef.current * 26;
    const expAge = explosionTimeRef.current;
    let k = isExplodingRef.current ? 0.085 * Math.min(1, expAge / 1.3) : 0.085;

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const rot = rotate3D(p.lx, p.ly, p.lz, angleX.current, angleY.current);
      let rx = cx + rot.x * radius, ry = cy + rot.y * radius, rz = cz + rot.z * radius;
      if (jitter > 0) { rx += (Math.random() - 0.5) * jitter; ry += (Math.random() - 0.5) * jitter; rz += (Math.random() - 0.5) * jitter; }
      p.vx += (rx - p.x) * k; p.vy += (ry - p.y) * k; p.vz += (rz - p.z) * k;
      let drag = (isExplodingRef.current && expAge < 0.45) ? 0.94 : 0.86;
      p.vx *= drag; p.vy *= drag; p.vz *= drag;
      p.x += p.vx; p.y += p.vy; p.z += p.vz;
    }

    // depth sort + projection
    parts.sort((a, b) => b.z - a.z);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const denom = CAM_D + (p.z - cz);
      if (denom < 120) continue;                 // safety guard against the old singularity
      const scale = CAM_D / denom;
      const px = cx + (p.x - cx) * scale;
      const py = cy + (p.y - cy) * scale;
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
      const speed = Math.hypot(p.vx, p.vy, p.vz);
      const size = Math.min(5.5, (1.4 + speed * 0.05) * scale);
      const alpha = Math.min(1, 0.24 + 0.68 * scale);
      const l = Math.floor(58 + Math.min(scale, 1.6) * 10);
      ctx.fillStyle = `hsla(${(hue.current + p.colorSeed * 36 - 18 + 360) % 360},95%,${l}%,${alpha})`;
      ctx.beginPath(); ctx.arc(px, py, size, 0, 6.283); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // charge ring
    if (chargeRef.current > 0 && pinchPt) {
      ctx.save(); ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(57,231,255,0.2)';
      ctx.beginPath(); ctx.arc(pinchPt.x, pinchPt.y, 45, 0, 6.283); ctx.stroke();
      ctx.strokeStyle = 'rgba(57,231,255,0.95)';
      ctx.beginPath(); ctx.arc(pinchPt.x, pinchPt.y, 45, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRef.current); ctx.stroke();
      ctx.restore();
    }

    // subtle skeleton overlay
    if (primaryHand) {
      const pts = primaryHand.map((lm) => toPx(lm, W, H));
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5;
      for (const [a, b] of CONNECTIONS) { ctx.beginPath(); ctx.moveTo(pts[a].x, pts[a].y); ctx.lineTo(pts[b].x, pts[b].y); ctx.stroke(); }
      for (const pt of pts) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, 6.283); ctx.fill(); }
    }
  });

  return (
    <>
      <canvas ref={canvasRef} className="gamecanvas" />
      <HowToPlay items={[
        { g: '✋ Move hand', a: 'the sphere follows your hand' },
        { g: '💨 Move fast', a: 'spins / drags the sphere' },
        { g: '🖐️🖐️ Two hands', a: 'spread apart to grow, bring together to shrink' },
        { g: '🤏 Pinch & hold', a: 'charges — release to explode' },
        { g: '☝️ Fingers up', a: 'changes the color (0–5)' },
      ]} />
    </>
  );
}
