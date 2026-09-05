// Landmark indices (MediaPipe Hands, 21 points)
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};

export const TIPS = [4, 8, 12, 16, 20];

export const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const d3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const palmScale = (h) => {
  return d3(h[LM.WRIST], h[LM.MIDDLE_MCP]) || 0.1;
};

export const palmCenter = (h) => ({
  x: (h[LM.WRIST].x + h[LM.MIDDLE_MCP].x) / 2,
  y: (h[LM.WRIST].y + h[LM.MIDDLE_MCP].y) / 2,
});

export const pinchDistance = (h) => d3(h[LM.THUMB_TIP], h[LM.INDEX_TIP]);
export const isPinching = (h) => {
  const scale = palmScale(h);
  return (pinchDistance(h) / scale) < 0.35;
};

export function isFingerExtended(h, tip, pip, mcp) {
  const dTip = d3(h[tip], h[mcp]);
  const dPip = d3(h[pip], h[mcp]);
  return dTip > dPip;
}

export function fingerCount(h) {
  let n = 0;
  if (isFingerExtended(h, LM.INDEX_TIP, LM.INDEX_PIP, LM.INDEX_MCP)) n++;
  if (isFingerExtended(h, LM.MIDDLE_TIP, LM.MIDDLE_PIP, LM.MIDDLE_MCP)) n++;
  if (isFingerExtended(h, LM.RING_TIP, LM.RING_PIP, LM.RING_MCP)) n++;
  if (isFingerExtended(h, LM.PINKY_TIP, LM.PINKY_PIP, LM.PINKY_MCP)) n++;
  
  // For the thumb, check if it's extended outwards relative to the index base
  const dThumb = d3(h[LM.THUMB_TIP], h[LM.INDEX_MCP]);
  const dIp = d3(h[LM.THUMB_IP], h[LM.INDEX_MCP]);
  if (dThumb > dIp * 1.05) n++;
  
  return n;
}

export function pose(h) {
  if (isPinching(h)) return 'pinch';
  const c = fingerCount(h);
  if (c <= 1) return 'fist';
  if (c >= 4) return 'open';
  return 'neutral';
}

export function isPointing(h) {
  const index = isFingerExtended(h, LM.INDEX_TIP, LM.INDEX_PIP, LM.INDEX_MCP);
  const middle = isFingerExtended(h, LM.MIDDLE_TIP, LM.MIDDLE_PIP, LM.MIDDLE_MCP);
  const ring = isFingerExtended(h, LM.RING_TIP, LM.RING_PIP, LM.RING_MCP);
  const pinky = isFingerExtended(h, LM.PINKY_TIP, LM.PINKY_PIP, LM.PINKY_MCP);
  return index && !middle && !ring && !pinky;
}

// ---- shape recognition (screen-space points {x,y}) ----
export function recognizeShape(path) {
  if (!path || path.length < 12) return null;
  let cx = 0, cy = 0;
  for (const p of path) { cx += p.x; cy += p.y; }
  cx /= path.length; cy /= path.length;

  const n = path.length;
  const radii = new Array(n);
  let mean = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < n; i++) {
    radii[i] = Math.hypot(path[i].x - cx, path[i].y - cy);
    mean += radii[i];
    minX = Math.min(minX, path[i].x); maxX = Math.max(maxX, path[i].x);
    minY = Math.min(minY, path[i].y); maxY = Math.max(maxY, path[i].y);
  }
  mean /= n;
  if (mean < 8) return null;

  let variance = 0;
  for (let i = 0; i < n; i++) { const dd = radii[i] - mean; variance += dd * dd; }
  const cv = Math.sqrt(variance / n) / mean;
  const closed = Math.hypot(path[0].x - path[n-1].x, path[0].y - path[n-1].y) < mean * 0.9;
  const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);

  let spikes = 0, minR = Infinity;
  for (let i = 0; i < n; i++) {
    const prev = radii[(i - 1 + n) % n], next = radii[(i + 1) % n];
    if (radii[i] > mean * 1.18 && radii[i] >= prev && radii[i] >= next) spikes++;
    minR = Math.min(minR, radii[i]);
  }
  const hasNotch = minR < mean * 0.65;

  // sharp corners
  let corners = 0;
  const step = Math.max(1, Math.floor(n / 24));
  for (let i = step; i < n - step; i += step) {
    const ax = path[i].x - path[i-step].x, ay = path[i].y - path[i-step].y;
    const bx = path[i+step].x - path[i].x, by = path[i+step].y - path[i].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la > 2 && lb > 2) {
      let ang = Math.acos(Math.max(-1, Math.min(1, (ax*bx + ay*by) / (la*lb)))) * 180 / Math.PI;
      if (ang > 55) corners++;
    }
  }

  if (!closed && corners >= 2 && bh > bw * 1.15) return 'lightning';
  if (closed && cv < 0.18 && corners <= 2) return 'circle';
  if (closed && spikes >= 4 && cv > 0.22) return 'star';
  if (closed && hasNotch && spikes <= 3 && cv > 0.12 && cv < 0.40) return 'heart';
  return null;
}

export const shapePoints = { circle: 10, star: 25, heart: 20, lightning: 30 };
