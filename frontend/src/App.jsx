import React, { useEffect, useCallback } from "react";
import CoordinateInput from "./components/CoordinateInput";
import ImageViewer from "./components/ImageViewer";
import TimeLapseControls from "./components/TimeLapseControls";
import { useSPHERExData } from "./hooks/useSPHERExData";
import "./App.css";

// ── URL state helpers ────────────────────────────────────────────────────────
function parseUrlState() {
  const p = new URLSearchParams(window.location.search);
  return {
    ra: p.get("ra") ? parseFloat(p.get("ra")) : null,
    dec: p.get("dec") ? parseFloat(p.get("dec")) : null,
    fov: p.get("fov") ? parseFloat(p.get("fov")) : 0.5,
    collection: p.get("collection") || "spherex_dr1",
  };
}

function pushUrlState({ ra, dec, fov, collection }) {
  const p = new URLSearchParams({ ra, dec, fov, collection });
  window.history.pushState({}, "", `?${p}`);
}

// ── Spectrum chart (simple SVG) ───────────────────────────────────────────────
function SpectrumChart({ spectrum }) {
  if (!spectrum?.wavelengths?.length) return null;
  const { wavelengths, fluxes } = spectrum;
  const W = 480, H = 120, PAD = 32;
  const minW = Math.min(...wavelengths), maxW = Math.max(...wavelengths);
  const minF = Math.min(...fluxes), maxF = Math.max(...fluxes);
  const sx = (w) => PAD + ((w - minW) / (maxW - minW)) * (W - PAD * 2);
  const sy = (f) => PAD + (1 - (f - minF) / (maxF - minF + 1e-30)) * (H - PAD * 2);
  const pts = wavelengths.map((w, i) => `${sx(w)},${sy(fluxes[i])}`).join(" ");

  return (
    <div className="spectrum-chart">
      <h3>SPHEREx Spectrum</h3>
      {spectrum.demo_mode && <span className="badge badge--warn">demo</span>}
      <svg viewBox={`0 0 ${W} ${H}`} className="spectrum-chart__svg">
        <polyline points={pts} fill="none" stroke="#f97316" strokeWidth="1.5" />
        <text x={PAD} y={H - 4} fontSize="10" fill="#888">{minW.toFixed(2)} µm</text>
        <text x={W - PAD} y={H - 4} fontSize="10" fill="#888" textAnchor="end">{maxW.toFixed(2)} µm</text>
      </svg>
      <p className="spectrum-chart__meta">
        {spectrum.n_points} sample{spectrum.n_points !== 1 ? "s" : ""} · {spectrum.collection}
      </p>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const {
    frames,
    currentIndex,
    setCurrentIndex,
    currentFrame,
    playing,
    togglePlay,
    fps,
    setFps,
    loading,
    error,
    demoMode,
    message,
    spectrum,
    fetchFrames,
    fetchSpectrum,
    fetchOverlays,
  } = useSPHERExData();

  // Run search with given params, also update URL
  const runSearch = useCallback(
    async ({ ra, dec, fov = 0.5, collection = "spherex_dr1" }) => {
      pushUrlState({ ra, dec, fov, collection });
      await fetchFrames({ ra, dec, fov, collection });
      fetchSpectrum({ ra, dec, collection });
      fetchOverlays({ ra, dec, fov });
    },
    [fetchFrames, fetchSpectrum, fetchOverlays]
  );

  // On mount, run search if URL has coords
  useEffect(() => {
    const { ra, dec, fov, collection } = parseUrlState();
    if (ra !== null && dec !== null) {
      runSearch({ ra, dec, fov, collection });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      {/* Header */}
      <header className="app__header">
        <div className="app__logo">
          <span className="app__logo-icon">🌌</span>
          <span className="app__logo-text">OpenAtlas</span>
          <span className="app__logo-sub">SPHEREx Sky Browser</span>
        </div>
        <div className="app__header-links">
          <a
            href="https://www.nasa.gov/mission/spherex/"
            target="_blank"
            rel="noopener noreferrer"
            className="header-link"
          >
            SPHEREx Mission
          </a>
          <a
            href="https://irsa.ipac.caltech.edu/Missions/spherex.html"
            target="_blank"
            rel="noopener noreferrer"
            className="header-link"
          >
            IRSA Data
          </a>
        </div>
      </header>

      <main className="app__main">
        {/* Left panel */}
        <aside className="app__sidebar">
          <CoordinateInput onSearch={runSearch} loading={loading} />

          {error && (
            <div className="alert alert--error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {message && !loading && !error && (
            <div className="alert alert--info">{message}</div>
          )}

          {frames.length > 0 && (
            <TimeLapseControls
              frames={frames}
              currentIndex={currentIndex}
              setCurrentIndex={setCurrentIndex}
              playing={playing}
              togglePlay={togglePlay}
              fps={fps}
              setFps={setFps}
            />
          )}

          <SpectrumChart spectrum={spectrum} />
        </aside>

        {/* Center: image viewer */}
        <section className="app__viewer">
          {loading ? (
            <div className="app__loading">
              <div className="spinner" />
              <p>Querying IRSA for SPHEREx frames…</p>
            </div>
          ) : (
            <ImageViewer frame={currentFrame} demoMode={demoMode} />
          )}

          {frames.length > 0 && (
            <p className="app__frame-count">
              {frames.length} frame{frames.length !== 1 ? "s" : ""} found
              {demoMode && " (demo mode)"}
            </p>
          )}
        </section>
      </main>

      <footer className="app__footer">
        <span>
          Data: NASA/IPAC IRSA · SPHEREx DR1 (DOI: 10.26131/IRSA652) ·{" "}
          <a href="https://www.spaceappschallenge.org/" target="_blank" rel="noopener noreferrer">
            NASA Space Apps 2026
          </a>{" "}
          · Team dreamlyfters
        </span>
      </footer>
    </div>
  );
}
