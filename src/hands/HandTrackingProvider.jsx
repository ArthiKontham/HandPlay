import { createContext, useContext, useRef, useEffect, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

const VERSION = '0.10.14';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const Ctx = createContext(null);
export const useHands = () => useContext(Ctx);

export function HandTrackingProvider({ children }) {
  const videoRef = useRef(null);
  const handsRef = useRef([]);            // [[{x,y,z} x21], ...] up to 2 hands, mirrored NOT applied (raw)
  const [status, setStatus] = useState('loading'); // loading | ready | error | off
  const [error, setError] = useState('');
  const [showVideoBg, setShowVideoBg] = useState(true);

  // Visibility and Model states
  const [isPageVisible, setIsPageVisible] = useState(document.visibilityState === 'visible');
  const [landmarkerReady, setLandmarkerReady] = useState(false);

  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const lastTime = useRef(-1);

  // 1. Track browser page/tab visibility (minimization/tab-switches)
  useEffect(() => {
    const handleVisibility = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // 2. Initialize video element
  useEffect(() => {
    const video = document.createElement('video');
    video.playsInline = true;
    video.muted = true;
    videoRef.current = video;
  }, []);

  // 3. Initialize MediaPipe HandLandmarker in background once
  useEffect(() => {
    let cancelled = false;

    async function makeLandmarker(vision, delegate) {
      return HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL, delegate },
        numHands: 2,
        runningMode: 'VIDEO',
      });
    }

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM);
        let lm;
        try { lm = await makeLandmarker(vision, 'GPU'); }
        catch { lm = await makeLandmarker(vision, 'CPU'); }
        if (cancelled) { lm.close?.(); return; }
        landmarkerRef.current = lm;
        setLandmarkerReady(true);
      } catch (e) {
        if (!cancelled) {
          setError('Model initialization failed: ' + (e?.message || String(e)));
          setStatus('error');
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close?.();
    };
  }, []);

  // The camera must keep running for hand tracking whenever the tab is visible.
  // showVideoBg is now a DISPLAY-ONLY toggle (games decide whether to paint the video);
  // hiding it gives a black screen with the live hand skeleton still moving.
  const shouldStream = isPageVisible;

  // 4. Handle webcam hardware stream initialization and termination
  useEffect(() => {
    if (!landmarkerReady) return;

    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    if (!shouldStream) {
      // Instantly shut down the camera stream to turn off the hardware light indicator
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      video.srcObject = null;
      setStatus('off');
      return;
    }

    async function startCamera() {
      try {
        setStatus('loading');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: 'user' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();
        setStatus('ready');
      } catch (e) {
        if (!cancelled) {
          setError('Camera start failed: ' + (e?.message || String(e)));
          setStatus('error');
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      video.srcObject = null;
    };
  }, [shouldStream, landmarkerReady]);

  // 5. Animation frame detection loop
  useEffect(() => {
    let rafId;
    const video = videoRef.current;

    function loop() {
      const lm = landmarkerRef.current;
      if (status === 'ready' && lm && video && video.readyState >= 2 && video.currentTime !== lastTime.current) {
        lastTime.current = video.currentTime;
        try {
          const res = lm.detectForVideo(video, performance.now());
          handsRef.current = res.landmarks || [];
        } catch { /* safe to skip transient errors */ }
      } else if (status !== 'ready') {
        handsRef.current = []; // immediately clear landmarks
      }
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [status]);

  return (
    <Ctx.Provider value={{ videoRef, handsRef, status, error, showVideoBg, setShowVideoBg }}>
      {children}
    </Ctx.Provider>
  );
}
