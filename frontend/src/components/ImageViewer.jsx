import React, { useState } from "react";

export default function ImageViewer({ frame, demoMode }) {
  const [imgError, setImgError] = useState(false);

  if (!frame) {
    return (
      <div className="image-viewer image-viewer--empty">
        <div className="image-viewer__placeholder">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
            <circle cx="32" cy="32" r="6" fill="currentColor" opacity="0.3" />
            <circle cx="20" cy="22" r="2" fill="currentColor" opacity="0.5" />
            <circle cx="46" cy="40" r="1.5" fill="currentColor" opacity="0.5" />
            <circle cx="38" cy="18" r="1" fill="currentColor" opacity="0.4" />
          </svg>
          <p>Enter coordinates and click Search</p>
        </div>
      </div>
    );
  }

  return (
    <div className="image-viewer">
      {demoMode && (
        <div className="image-viewer__demo-banner">
          ⚠ Demo mode — synthetic sky data (IRSA unreachable)
        </div>
      )}

      <div className="image-viewer__frame-container">
        {imgError ? (
          <div className="image-viewer__error">
            <span>Frame unavailable</span>
          </div>
        ) : (
          <img
            key={frame.png_url}
            src={frame.png_url}
            alt={`SPHEREx frame ${frame.obs_id}`}
            className="image-viewer__img"
            onError={() => setImgError(true)}
            onLoad={() => setImgError(false)}
          />
        )}

        <div className="image-viewer__overlay-info">
          {frame.wavelength_um && (
            <span className="badge">λ {frame.wavelength_um} µm</span>
          )}
          {frame.mjd && (
            <span className="badge">MJD {frame.mjd}</span>
          )}
          {frame.utc && (
            <span className="badge">{frame.utc?.slice(0, 10)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
