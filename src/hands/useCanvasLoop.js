import { useRef, useEffect } from 'react';

// Sets up a full-size canvas and calls draw(ctx, W, H, dt) every frame.
export function useCanvasLoop(draw) {
  const canvasRef = useRef(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width));
      canvas.height = Math.max(1, Math.floor(r.height));
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      drawRef.current(ctx, canvas.width, canvas.height, dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return canvasRef;
}

// landmark (normalized) -> canvas pixels, mirrored horizontally for a selfie view
export const toPx = (lm, W, H) => ({ x: (1 - lm.x) * W, y: lm.y * H });
