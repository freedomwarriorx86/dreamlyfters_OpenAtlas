// Coordinate helpers shared by the viewer, overlays and exports.

const D2R = Math.PI / 180;

export function fmtHMS(ra, prec = 1) {
  let h = (((ra % 360) + 360) % 360) / 15;
  let hh = Math.floor(h);
  let mm = Math.floor((h - hh) * 60);
  let ss = ((h - hh) * 60 - mm) * 60;
  if (+ss.toFixed(prec) >= 60) { ss = 0; mm += 1; }
  if (mm >= 60) { mm = 0; hh = (hh + 1) % 24; }
  return `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}m${ss.toFixed(prec).padStart(3 + prec, "0")}s`;
}

export function fmtDMS(dec, prec = 1) {
  const sign = dec < 0 ? "−" : "+";
  const d = Math.abs(dec);
  let dd = Math.floor(d);
  let mm = Math.floor((d - dd) * 60);
  let ss = ((d - dd) * 60 - mm) * 60;
  if (+ss.toFixed(prec) >= 60) { ss = 0; mm += 1; }
  if (mm >= 60) { mm = 0; dd += 1; }
  return `${sign}${String(dd).padStart(2, "0")}°${String(mm).padStart(2, "0")}′${ss.toFixed(prec).padStart(3 + prec, "0")}″`;
}

export const fmtDeg = (v, n = 4) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(n) + "°";

/** Parse "133.7951", "08h55m10.8s", "08 55 10.8", "8:55:10.8" (RA, hours) */
export function parseRA(s) {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/[°]/g, "");
  if (!t) return NaN;
  if (/^[+]?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const m = t.match(/^(\d{1,2})[h:\s]+(\d{1,2})[m:\s]+(\d{1,2}(?:\.\d+)?)s?$/i);
  if (m) return 15 * (+m[1] + +m[2] / 60 + +m[3] / 3600);
  return NaN;
}

/** Parse "-7.2451", "−07°14′42.5″", "-07d14m42.5s", "-07 14 42.5" */
export function parseDec(s) {
  if (s == null) return NaN;
  const t = String(s).trim().replace(/[−–]/g, "-").replace(/°$/, "");
  if (!t) return NaN;
  if (/^[+-]?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const m = t.match(/^([+-]?)(\d{1,2})[d°:\s]+(\d{1,2})[m′':\s]+(\d{1,2}(?:\.\d+)?)[s″"]?$/i);
  if (m) return (m[1] === "-" ? -1 : 1) * (+m[2] + +m[3] / 60 + +m[4] / 3600);
  return NaN;
}

/** "133.79, -7.24" or "08h55m10.8s -07d14m42s" -> {ra, dec} | null */
export function parseCoordPair(s) {
  const t = String(s).trim().replace(/[−–]/g, "-");
  let parts = t.split(/\s*,\s*/);
  if (parts.length !== 2) {
    const m = t.match(/^(\S+(?:\s+\S+\s+\S+)?)\s+([+-]\S+(?:\s+\S+\s+\S+)?)$/);
    if (m) parts = [m[1], m[2]];
    else parts = t.split(/\s+/).length === 2 ? t.split(/\s+/) : [];
  }
  if (parts.length !== 2) return null;
  const ra = parseRA(parts[0]);
  const dec = parseDec(parts[1]);
  if (!isFinite(ra) || !isFinite(dec) || ra < 0 || ra > 360 || dec < -90 || dec > 90) return null;
  return { ra, dec };
}

/**
 * Gnomonic (TAN) projection around (ra0, dec0) into fractions of the viewer
 * square: fx = 0 at the east (left) edge, fy = 0 at the north (top) edge.
 * Matches the backend's aligned grid exactly.
 */
export function project(ra, dec, ra0, dec0, fovArcmin) {
  const a = (ra - ra0) * D2R, d = dec * D2R, d0 = dec0 * D2R;
  const cosc = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(a);
  if (cosc <= 0) return null;
  const xi = (Math.cos(d) * Math.sin(a)) / cosc / D2R;            // degrees, +east
  const eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(a)) / cosc / D2R; // +north
  const f = fovArcmin / 60;
  return { fx: 0.5 - xi / f, fy: 0.5 - eta / f };
}

export function unproject(fx, fy, ra0, dec0, fovArcmin) {
  const f = fovArcmin / 60;
  const xi = (0.5 - fx) * f * D2R, eta = (0.5 - fy) * f * D2R;
  const d0 = dec0 * D2R;
  const rho = Math.hypot(xi, eta);
  if (rho === 0) return { ra: ra0, dec: dec0 };
  const c = Math.atan(rho);
  const dec = Math.asin(Math.cos(c) * Math.sin(d0) + (eta * Math.sin(c) * Math.cos(d0)) / rho);
  const ra = ra0 * D2R + Math.atan2(xi * Math.sin(c), rho * Math.cos(d0) * Math.cos(c) - eta * Math.sin(d0) * Math.sin(c));
  return { ra: ((ra / D2R) % 360 + 360) % 360, dec: dec / D2R };
}

/** Linear proper-motion propagation (pmra includes cos dec), mas/yr. */
export function propagate(ra, dec, pmra, pmdec, fromYear, toYear) {
  const dt = toYear - fromYear;
  const cosd = Math.max(1e-6, Math.cos(dec * D2R));
  return { ra: ra + (pmra * dt) / 3.6e6 / cosd, dec: dec + (pmdec * dt) / 3.6e6 };
}

export const mjdToYear = (mjd) => 2000 + (mjd - 51544.5) / 365.25;
export const mjdToDate = (mjd) => new Date((mjd - 40587) * 86400000);
export const fmtUTC = (utc) => (utc ? utc.replace("T", " ").slice(0, 16) : "—");

export const DETECTORS = {
  1: [0.75, 1.09], 2: [1.1, 1.62], 3: [1.63, 2.42], 4: [2.43, 3.82], 5: [3.83, 4.41], 6: [4.41, 5.0],
};

/** Pick up to n frames evenly spread in time. */
export function spreadPick(frames, n) {
  if (frames.length <= n) return frames.slice();
  const out = [];
  for (let i = 0; i < n; i++) out.push(frames[Math.round((i * (frames.length - 1)) / (n - 1))]);
  return [...new Map(out.map((f) => [f.id, f])).values()];
}

/** Frames for a spectrum: up to `per` per detector, spread in time. */
export function spectrumPick(frames, per = 4) {
  const out = [];
  for (const d of [1, 2, 3, 4, 5, 6]) out.push(...spreadPick(frames.filter((f) => f.detector === d), per));
  return out;
}
