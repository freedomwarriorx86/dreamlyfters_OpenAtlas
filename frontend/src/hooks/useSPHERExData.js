import { useState, useCallback, useRef } from "react";

const DEFAULT_COLLECTION = "spherex_dr1";

export function useSPHERExData() {
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [message, setMessage] = useState("");

  // Animation state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(4);
  const intervalRef = useRef(null);

  // Spectrum data
  const [spectrum, setSpectrum] = useState(null);

  // Overlay data
  const [gaiaStars, setGaiaStars] = useState(null);
  const [wiseSources, setWiseSources] = useState(null);

  const stopAnimation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlaying(false);
  }, []);

  const startAnimation = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % Math.max(frames.length, 1));
    }, 1000 / fps);
    setPlaying(true);
  }, [frames.length, fps]);

  const togglePlay = useCallback(() => {
    if (playing) {
      stopAnimation();
    } else {
      startAnimation();
    }
  }, [playing, startAnimation, stopAnimation]);

  const fetchFrames = useCallback(
    async ({ ra, dec, fov = 0.5, collection = DEFAULT_COLLECTION, stretch = "zscale" }) => {
      stopAnimation();
      setLoading(true);
      setError(null);
      setFrames([]);
      setCurrentIndex(0);
      setDemoMode(false);
      setMessage("");

      try {
        const params = new URLSearchParams({ ra, dec, fov, collection });
        const res = await fetch(`/api/frames?${params}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `HTTP ${res.status}`);
        }
        const data = await res.json();

        if (data.frames && data.frames.length > 0) {
          // Build PNG URLs — backend renders images
          const enriched = data.frames.map((f) => ({
            ...f,
            png_url: `/api/frame/${encodeURIComponent(f.obs_id)}?ra=${ra}&dec=${dec}&fov=${fov}&stretch=${stretch}&collection=${collection}`,
          }));
          setFrames(enriched);
          setDemoMode(data.demo_mode ?? false);
          setMessage(data.message || "");
          // Auto-start if more than one frame
          if (enriched.length > 1) {
            setTimeout(() => startAnimation(), 100);
          }
        } else {
          setMessage(data.message || "No SPHEREx frames found at these coordinates.");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [stopAnimation, startAnimation]
  );

  const fetchSpectrum = useCallback(async ({ ra, dec, radius = 30, collection = DEFAULT_COLLECTION }) => {
    try {
      const params = new URLSearchParams({ ra, dec, radius, collection });
      const res = await fetch(`/api/spectrum?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setSpectrum(data);
    } catch {
      /* non-critical */
    }
  }, []);

  const fetchOverlays = useCallback(async ({ ra, dec, fov = 0.5 }) => {
    const params = new URLSearchParams({ ra, dec, fov });
    try {
      const [gaiaRes, wiseRes] = await Promise.allSettled([
        fetch(`/api/gaia?${params}`).then((r) => r.json()),
        fetch(`/api/wise?${params}`).then((r) => r.json()),
      ]);
      if (gaiaRes.status === "fulfilled") setGaiaStars(gaiaRes.value);
      if (wiseRes.status === "fulfilled") setWiseSources(wiseRes.value);
    } catch {
      /* non-critical */
    }
  }, []);

  return {
    frames,
    currentIndex,
    setCurrentIndex,
    currentFrame: frames[currentIndex] ?? null,
    playing,
    togglePlay,
    fps,
    setFps,
    loading,
    error,
    demoMode,
    message,
    spectrum,
    gaiaStars,
    wiseSources,
    fetchFrames,
    fetchSpectrum,
    fetchOverlays,
  };
}
