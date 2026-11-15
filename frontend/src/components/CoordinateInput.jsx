import React, { useState } from "react";

// Preset targets
const PRESETS = [
  { label: "Barnard's Star", ra: 269.452, dec: 4.693 },
  { label: "WISE 0855−0714", ra: 133.788, dec: -7.246 },
  { label: "Proxima Cen", ra: 217.429, dec: -62.681 },
  { label: "M31 (Andromeda)", ra: 10.6848, dec: 41.269 },
  { label: "Galactic Center", ra: 266.405, dec: -29.0 },
];

export default function CoordinateInput({ onSearch, loading }) {
  const [ra, setRa] = useState("");
  const [dec, setDec] = useState("");
  const [fov, setFov] = useState("0.5");
  const [collection, setCollection] = useState("spherex_dr1");
  const [name, setName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  const handleResolveName = async () => {
    if (!name.trim()) return;
    setResolving(true);
    setResolveError("");
    try {
      const res = await fetch(`/api/resolve?name=${encodeURIComponent(name.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Resolution failed");
      setRa(data.ra.toFixed(6));
      setDec(data.dec.toFixed(6));
    } catch (err) {
      setResolveError(err.message);
    } finally {
      setResolving(false);
    }
  };

  const handlePreset = (preset) => {
    setRa(preset.ra.toFixed(6));
    setDec(preset.dec.toFixed(6));
    setName(preset.label);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const raNum = parseFloat(ra);
    const decNum = parseFloat(dec);
    if (isNaN(raNum) || isNaN(decNum)) return;
    if (raNum < 0 || raNum > 360 || decNum < -90 || decNum > 90) return;
    onSearch({ ra: raNum, dec: decNum, fov: parseFloat(fov) || 0.5, collection });
  };

  return (
    <form className="coord-input" onSubmit={handleSubmit}>
      {/* Name resolution row */}
      <div className="coord-input__name-row">
        <input
          type="text"
          placeholder="Object name (e.g. Barnard's Star)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleResolveName())}
          className="coord-input__name"
        />
        <button
          type="button"
          onClick={handleResolveName}
          disabled={resolving || !name.trim()}
          className="btn btn--secondary"
        >
          {resolving ? "…" : "Resolve"}
        </button>
      </div>
      {resolveError && <p className="coord-input__error">{resolveError}</p>}

      {/* Presets */}
      <div className="coord-input__presets">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="preset-chip"
            onClick={() => handlePreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* RA / Dec */}
      <div className="coord-input__coords">
        <label>
          RA (°)
          <input
            type="number"
            step="any"
            min="0"
            max="360"
            placeholder="0–360"
            value={ra}
            onChange={(e) => setRa(e.target.value)}
            required
          />
        </label>
        <label>
          Dec (°)
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            placeholder="−90–+90"
            value={dec}
            onChange={(e) => setDec(e.target.value)}
            required
          />
        </label>
        <label>
          FOV (°)
          <input
            type="number"
            step="0.1"
            min="0.05"
            max="5"
            value={fov}
            onChange={(e) => setFov(e.target.value)}
          />
        </label>
      </div>

      {/* Collection selector */}
      <div className="coord-input__collection">
        <label>
          Collection
          <select value={collection} onChange={(e) => setCollection(e.target.value)}>
            <option value="spherex_dr1">SPHEREx DR1 (Nov 2026)</option>
            <option value="spherex_qr2">SPHEREx QR2</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        className="btn btn--primary btn--wide"
        disabled={loading || !ra || !dec}
      >
        {loading ? "Searching…" : "🔭 Search"}
      </button>
    </form>
  );
}
