import React from "react";

export default function TimeLapseControls({
  frames,
  currentIndex,
  setCurrentIndex,
  playing,
  togglePlay,
  fps,
  setFps,
}) {
  if (!frames || frames.length === 0) return null;

  const frame = frames[currentIndex];
  const total = frames.length;

  return (
    <div className="timelapse-controls">
      {/* Scrubber */}
      <div className="timelapse-controls__scrubber">
        <input
          type="range"
          min={0}
          max={total - 1}
          value={currentIndex}
          onChange={(e) => setCurrentIndex(Number(e.target.value))}
          className="scrubber"
          aria-label="Frame scrubber"
        />
        <span className="timelapse-controls__counter">
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* Controls row */}
      <div className="timelapse-controls__row">
        {/* Step back */}
        <button
          className="ctrl-btn"
          onClick={() => setCurrentIndex((i) => (i - 1 + total) % total)}
          aria-label="Previous frame"
          disabled={total < 2}
        >
          ◀
        </button>

        {/* Play / Pause */}
        <button
          className="ctrl-btn ctrl-btn--primary"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          disabled={total < 2}
        >
          {playing ? "⏸" : "▶"}
        </button>

        {/* Step forward */}
        <button
          className="ctrl-btn"
          onClick={() => setCurrentIndex((i) => (i + 1) % total)}
          aria-label="Next frame"
          disabled={total < 2}
        >
          ▶
        </button>

        {/* Speed */}
        <div className="timelapse-controls__speed">
          <label htmlFor="fps-select">Speed</label>
          <select
            id="fps-select"
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
          >
            <option value={1}>1 fps</option>
            <option value={2}>2 fps</option>
            <option value={4}>4 fps</option>
            <option value={8}>8 fps</option>
            <option value={16}>16 fps</option>
          </select>
        </div>
      </div>

      {/* Frame metadata */}
      {frame && (
        <div className="timelapse-controls__meta">
          {frame.utc && <span>📅 {frame.utc?.slice(0, 10)}</span>}
          {frame.wavelength_um && <span>🔭 {frame.wavelength_um} µm</span>}
          {frame.detector && <span>Det {frame.detector}</span>}
        </div>
      )}
    </div>
  );
}
