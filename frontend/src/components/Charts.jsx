import React, { useMemo, useState } from "react";
import { DETECTORS, fmtUTC, mjdToDate } from "../lib/astro";

export const DET_COLORS = { 1: "#7DD3FC", 2: "#5EEAD4", 3: "#86EFAC", 4: "#FDE68A", 5: "#FFB86B", 6: "#F9A8D4" };
const AX = "#97A6C2";

function niceTicks(lo, hi, n = 4) {
  if (!(hi > lo)) return [lo];
  const span = hi - lo;
  const step0 = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n + 0.5) || step0;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const fmtN = (v) => (Math.abs(v) >= 1000 ? v.toExponential(1) : Math.abs(v) >= 10 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2));

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// ---------------------------------------------------------------------------
export function LightCurve({ points, det = "all", height = 280, onPick, current }) {
  const W = 700, H = height, L = 60, R = 690, T = 20, B = H - 50;
  // Relative flux (per-detector median = 1) when the target is clearly detected;
  // otherwise absolute flux, so a non-detection is shown honestly around zero.
  const { data, relative } = useMemo(() => {
    const ok = points.filter((p) => p.flux_ujy != null && isFinite(p.flux_ujy) && p.err_ujy != null);
    const snr = median(ok.map((p) => (p.err_ujy > 0 ? p.flux_ujy / p.err_ujy : 0)));
    const rel = ok.length > 0 && snr >= 5;
    const byDet = {};
    ok.forEach((p) => { (byDet[p.detector] ||= []).push(p); });
    const out = [];
    for (const arr of Object.values(byDet)) {
      const m = median(arr.map((p) => p.flux_ujy));
      arr.forEach((p) => out.push(rel && m > 0 ? { ...p, rel: p.flux_ujy / m, relErr: p.err_ujy / m }
        : { ...p, rel: p.flux_ujy, relErr: p.err_ujy }));
    }
    return { relative: rel, data: out.filter((p) => det === "all" || p.detector === det).sort((a, b) => a.mjd - b.mjd) };
  }, [points, det]);

  if (!data.length) return null;
  const xs = data.map((p) => p.mjd);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x1 - x0 < 1) { x0 -= 1; x1 += 1; }
  const ys = data.flatMap((p) => [p.rel - p.relErr, p.rel + p.relErr]);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(0.02, (y1 - y0) * 0.08);
  y0 -= pad; y1 += pad;
  const sx = (v) => L + ((v - x0) / (x1 - x0)) * (R - L);
  const sy = (v) => B - ((v - y0) / (y1 - y0)) * (B - T);
  const yt = niceTicks(y0, y1, 4);
  const xt = niceTicks(x0, x1, 4);
  const byDet = {};
  data.forEach((p) => (byDet[p.detector] ||= []).push(p));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Light curve: relative flux of the target in each exposure, grouped by detector">
      <g stroke="#1F2C47">{yt.map((v) => <path key={v} d={`M${L} ${sy(v)}H${R}`} />)}</g>
      <path d={`M${L} ${T}V${B}H${R}`} stroke="#2A3B5E" fill="none" />
      {Object.entries(byDet).map(([d, arr]) => (
        <g key={d}>
          {arr.length > 1 && <polyline fill="none" stroke={DET_COLORS[d]} strokeOpacity=".45" strokeWidth="1.5" points={arr.map((p) => `${sx(p.mjd)},${sy(p.rel)}`).join(" ")} />}
          {arr.map((p) => (
            <g key={p.id} style={{ cursor: onPick ? "pointer" : "default" }} onClick={() => onPick?.(p.id)}>
              <path d={`M${sx(p.mjd)} ${sy(p.rel - p.relErr)}V${sy(p.rel + p.relErr)}`} stroke={DET_COLORS[d]} strokeWidth="1.3" />
              {(() => {
                const tip = `${fmtUTC(p.utc)} · D${p.detector} · ${p.wavelength_um?.toFixed?.(3) ?? "?"} µm\n${p.saturated ? "≈ " : ""}${p.flux_ujy.toFixed(1)} ± ${p.err_ujy.toFixed(1)} µJy (S/N ${p.snr ?? "?"})${p.saturated ? "\nsaturated: estimated from the star's outer glow" : ""}${p.flags?.length ? "\nflags: " + p.flags.join(", ") : ""}`;
                const r = p.id === current ? 6 : 4.5, x = sx(p.mjd), y = sy(p.rel);
                const stroke = p.id === current ? "#fff" : DET_COLORS[d];
                return p.saturated
                  ? <path d={`M${x} ${y - r - 1}L${x + r + 1} ${y}L${x} ${y + r + 1}L${x - r - 1} ${y}Z`} fill="none" stroke={stroke} strokeWidth="2"><title>{tip}</title></path>
                  : <circle cx={x} cy={y} r={r} fill="#060912" stroke={stroke} strokeWidth="2"><title>{tip}</title></circle>;
              })()}
            </g>
          ))}
        </g>
      ))}
      {!relative && y0 < 0 && <path d={`M${L} ${sy(0)}H${R}`} stroke="#97A6C2" strokeOpacity=".5" strokeDasharray="3 4" />}
      <g fill={AX} fontSize="10.5" textAnchor="end">{yt.map((v) => <text key={v} x={L - 8} y={sy(v) + 4}>{relative ? v.toFixed(2) : fmtN(v)}</text>)}</g>
      <g fill={AX} fontSize="10.5" textAnchor="middle">
        {xt.map((v) => <text key={v} x={sx(v)} y={B + 18}>{mjdToDate(v).toISOString().slice(0, 10)}</text>)}
        <text x={(L + R) / 2} y={H - 8}>Observation date (UTC)</text>
      </g>
      <text x="14" y={(T + B) / 2} fill={AX} fontSize="10.5" transform={`rotate(-90 14 ${(T + B) / 2})`} textAnchor="middle">{relative ? "Relative flux (per detector)" : "Flux at target (µJy)"}</text>
      {!relative && <text x={R} y={T + 4} fill="#FFB86B" fontSize="10.5" textAnchor="end">target not clearly detected in single frames</text>}
      {data.some((p) => p.saturated) && (
        <g transform={`translate(${L + 8} ${T + 2})`}>
          <path d="M5 0L10 5L5 10L0 5Z" fill="none" stroke="#FFD9A8" strokeWidth="1.6" />
          <text x="16" y="9" fill="#FFD9A8" fontSize="10.5">saturated: estimated from the star's outer glow (±15 %)</text>
        </g>
      )}
    </svg>
  );
}

// Points far above the rest (cosmic rays, artefacts in the aperture) would crush the plot.
function splitOutliers(data) {
  const fl = data.map((p) => p.flux_ujy);
  const med = median(fl);
  const mad = median(fl.map((v) => Math.abs(v - med))) * 1.4826;
  if (!(mad > 0) || data.length < 6) return { inl: data, out: [] };
  const lim = med + 15 * mad;
  return { inl: data.filter((p) => p.flux_ujy <= lim), out: data.filter((p) => p.flux_ujy > lim) };
}

// ---------------------------------------------------------------------------
const FEATURES =[{ um: 3.05, label: "H₂O" }, { um: 4.27, label: "CO₂" }, { um: 4.67, label: "CO" }];

export function Spectrum({ points, normalized = false, height = 280 }) {
  const W = 700, H = height, L = 64, R = 680, T = 24, B = H - 50;
  // saturated points are wing estimates (not absolute fluxes), so they are left out of the spectrum
  const nSat = points.filter((p) => p.saturated && p.flux_ujy != null).length;
  const data = useMemo(() => points.filter((p) => p.flux_ujy != null && isFinite(p.flux_ujy) && p.wavelength_um && !p.saturated)
    .sort((a, b) => a.wavelength_um - b.wavelength_um), [points]);
  if (!data.length) {
    return nSat ? <div className="alert warn">This star is saturated in every exposure measured so far, so SPHEREx cannot give a reliable spectrum for it ({nSat} exposures left out). Its light curve still works. </div> : null;
  }
  const { inl, out } = splitOutliers(data);
  const peak = Math.max(...inl.map((p) => p.flux_ujy)) || 1;
  const f = (p) => (normalized ? p.flux_ujy / peak : p.flux_ujy);
  const e = (p) => (normalized ? (p.err_ujy || 0) / peak : p.err_ujy || 0);
  const x0 = 0.7, x1 = 5.05;
  const ys = inl.flatMap((p) => [f(p) - Math.min(e(p), Math.abs(f(p)) + 1), f(p) + Math.min(e(p), Math.abs(f(p)) + 1)]);
  let y0 = Math.min(0, ...ys), y1 = Math.max(...ys);
  y1 += (y1 - y0) * 0.1;
  const sx = (v) => L + ((v - x0) / (x1 - x0)) * (R - L);
  const sy = (v) => Math.max(T, Math.min(B, B - ((v - y0) / (y1 - y0 || 1)) * (B - T)));
  const yt = niceTicks(y0, y1, 4);
  const line = inl.map((p) => `${sx(p.wavelength_um)},${sy(f(p))}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Spectrum of the target across SPHEREx's six detector arrays">
      <g fill="#1F2C47">
        {Object.entries(DETECTORS).map(([d, [lo, hi]]) => d % 2 === 0 && <rect key={d} x={sx(lo)} y={T} width={sx(hi) - sx(lo)} height={B - T} opacity=".45" />)}
      </g>
      <g fill={AX} fontSize="10.5" textAnchor="middle">
        {Object.entries(DETECTORS).map(([d, [lo, hi]]) => <text key={d} x={(sx(lo) + sx(hi)) / 2} y={T - 8}>D{d}</text>)}
      </g>
      <g stroke="#1F2C47">{yt.map((v) => <path key={v} d={`M${L} ${sy(v)}H${R}`} />)}</g>
      <path d={`M${L} ${T}V${B}H${R}`} stroke="#2A3B5E" fill="none" />
      <g stroke="#FFB86B" strokeDasharray="3 4" strokeOpacity=".8">{FEATURES.map((m) => <path key={m.um} d={`M${sx(m.um)} ${T + 8}V${B}`} />)}</g>
      <g fill="#FFB86B" fontSize="10.5">{FEATURES.map((m) => <text key={m.um} x={sx(m.um) + 4} y={T + 20}>{m.label}</text>)}</g>
      <polyline fill="none" stroke="#5EEAD4" strokeOpacity=".5" strokeWidth="1.5" points={line} />
      {inl.map((p) => (
        <g key={p.id}>
          <path d={`M${sx(p.wavelength_um)} ${sy(f(p) - e(p))}V${sy(f(p) + e(p))}`} stroke={DET_COLORS[p.detector]} strokeWidth="1.2" />
          <circle cx={sx(p.wavelength_um)} cy={sy(f(p))} r="3.5" fill={DET_COLORS[p.detector]}>
            <title>{`${p.wavelength_um.toFixed(3)} µm (D${p.detector}) · ${p.flux_ujy.toFixed(1)} ± ${(p.err_ujy || 0).toFixed(1)} µJy · ${fmtUTC(p.utc)}`}</title>
          </circle>
        </g>
      ))}
      {out.map((p) => (
        <path key={p.id} d={`M${sx(p.wavelength_um)} ${T + 2}l-5 9h10z`} fill="none" stroke={DET_COLORS[p.detector]} strokeWidth="1.5">
          <title>{`Outlier, off scale: ${p.wavelength_um.toFixed(3)} µm (D${p.detector}) · ${p.flux_ujy.toFixed(1)} µJy · ${fmtUTC(p.utc)}${p.flags?.length ? " · flags: " + p.flags.join(", ") : ""}`}</title>
        </path>
      ))}
      <g fill={AX} fontSize="10.5" textAnchor="end">{yt.map((v) => <text key={v} x={L - 8} y={sy(v) + 4}>{normalized ? v.toFixed(2) : fmtN(v)}</text>)}</g>
      <g fill={AX} fontSize="10.5" textAnchor="middle">
        {[0.75, 1.5, 2.25, 3, 3.75, 4.5].map((v) => <text key={v} x={sx(v)} y={B + 18}>{v}</text>)}
        <text x={(L + R) / 2} y={H - 8}>Wavelength (µm)</text>
      </g>
      <text x="14" y={(T + B) / 2} fill={AX} fontSize="10.5" transform={`rotate(-90 14 ${(T + B) / 2})`} textAnchor="middle">{normalized ? "Normalized flux" : "Flux (µJy)"}</text>
      {nSat > 0 && <text x={R} y={H - 8} fill="#FFD9A8" fontSize="10.5" textAnchor="end">{nSat} saturated exposure{nSat > 1 ? "s" : ""} left out</text>}
    </svg>
  );
}

export function SpectrumMini({ points }) {
  const data = splitOutliers(points.filter((p) => p.flux_ujy != null && isFinite(p.flux_ujy) && p.wavelength_um && !p.saturated)
    .sort((a, b) => a.wavelength_um - b.wavelength_um)).inl;
  if (data.length < 2) return null;
  const W = 290, H = 130, L = 30, R = 290, T = 12, B = 110;
  const fl = data.map((p) => p.flux_ujy);
  const y0 = Math.min(0, ...fl), y1 = Math.max(...fl) * 1.08 || 1;
  const sx = (v) => L + ((v - 0.7) / (5.05 - 0.7)) * (R - L);
  const sy = (v) => B - ((v - y0) / (y1 - y0)) * (B - T);
  const pts = data.map((p) => `${sx(p.wavelength_um)},${sy(p.flux_ujy)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Spectrum preview chart">
      <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5EEAD4" stopOpacity=".35" /><stop offset="1" stopColor="#5EEAD4" stopOpacity="0" /></linearGradient></defs>
      <path d={`M${L} ${B}H${R}M${L} ${(B + T) / 2}H${R}M${L} ${T}H${R}`} stroke="#1F2C47" />
      <polygon fill="url(#gA)" points={`${sx(data[0].wavelength_um)},${B} ${pts} ${sx(data[data.length - 1].wavelength_um)},${B}`} />
      <polyline fill="none" stroke="#5EEAD4" strokeWidth="2" points={pts} />
      <text x={L} y="126" fill={AX} fontSize="10">0.75</text>
      <text x={R - 40} y="126" fill={AX} fontSize="10">5.0 µm</text>
    </svg>
  );
}

export function DetChips({ value, onChange, counts }) {
  return (
    <div className="chips" role="group" aria-label="Detector">
      {["all", 1, 2, 3, 4, 5, 6].map((d) => (
        <button key={d} className={`chip ${value === d ? "on" : ""}`} aria-pressed={value === d} onClick={() => onChange(d)}>
          {d === "all" ? "All" : `D${d}`}{counts && d !== "all" ? <small>{counts[d] || 0}</small> : null}
        </button>
      ))}
    </div>
  );
}

export function useToggle(init) {
  const [v, setV] = useState(init);
  return [v, () => setV((x) => !x), setV];
}
