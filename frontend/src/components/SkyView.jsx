import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAtlas } from "../store";
import { api, diffURL, stackURL } from "../lib/api";
import { mjdToYear, project, propagate, unproject } from "../lib/astro";

const PX = 56, PY = 24, PS = 560;   // plot rectangle inside the 640x640 viewBox
const GAIA_EPOCH = 2016.0;
const WISE_EPOCH = 2010.5;

export function useImageStatus(url) {
  const [st, setSt] = useState({ url: null, status: "idle" });
  useEffect(() => {
    if (!url) { setSt({ url: null, status: "idle" }); return; }
    let live = true;
    setSt({ url, status: "loading" });
    const im = new Image();
    im.onload = () => live && setSt({ url, status: "ok" });
    im.onerror = () => live && setSt({ url, status: "err" });
    im.src = url;
    return () => { live = false; };
  }, [url]);
  return st.url === url ? st.status : "loading";
}

function niceScale(fovArcmin) {
  const maxLen = (fovArcmin * 60) / 3.5;
  const opts = [5, 10, 15, 20, 30, 60, 90, 120, 180, 300, 600];
  return opts.filter((v) => v <= maxLen).pop() || 5;
}
const fmtOff = (arcsec) => {
  const a = Math.abs(arcsec) < 1e-6 ? 0 : arcsec;
  const s = a > 0 ? "+" : a < 0 ? "−" : "";
  return Math.abs(a) >= 120 ? `${s}${+(Math.abs(a) / 60).toFixed(1)}′` : `${s}${+Math.abs(a).toFixed(0)}″`;
};

export default function SkyView({ onCursor, fsRef }) {
  const { s, sel, cur, idx, urlFor, imgState, loadedCount, failedCount, meta, cats, cands, candSel, allLoaded } = useAtlas();
  const svgRef = useRef(null);
  const [shown, setShown] = useState(null);       // last successfully shown blink frame url
  const [values, setValues] = useState({});      // frame id -> Float32Array (128x128)

  const loadedIds = useMemo(() => sel.filter((f) => imgState[urlFor(f.id)] === "ok").map((f) => f.id), [sel, imgState, urlFor]);

  // ---- image for the current mode ----
  const blinkURL = cur ? urlFor(cur.id) : null;
  const blinkOK = blinkURL && imgState[blinkURL] === "ok";
  useEffect(() => { if (blinkOK) setShown(blinkURL); }, [blinkOK, blinkURL]);
  useEffect(() => { setShown(null); }, [s.ra, s.dec, s.fov]);

  const stackIds = allLoaded ? loadedIds : null;
  const modeURL = s.mode === "stack" ? (stackIds && stackIds.length ? stackURL(s, stackIds) : null)
    : s.mode === "diff" ? (cur && loadedIds.length >= 2 ? diffURL(s, loadedIds, "median", cur.id) : null)
      : null;
  const modeStatus = useImageStatus(modeURL);
  const [modeShown, setModeShown] = useState(null);
  useEffect(() => { if (modeStatus === "ok") setModeShown(modeURL); }, [modeStatus, modeURL]);
  useEffect(() => { setModeShown(null); }, [s.mode, s.ra, s.dec, s.fov]);

  const img = s.mode === "blink" ? shown : modeShown;
  const diverging = s.mode === "diff";

  // ---- cursor values (lazy, per frame) ----
  const wantValues = s.mode === "blink" && cur && blinkOK;
  const fetchValues = () => {
    if (!wantValues || values[cur.id]) return;
    const id = cur.id;
    setValues((v) => ({ ...v, [id]: "loading" }));
    api.values(s, id).then((r) => {
      const bin = atob(r.data);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      setValues((v) => ({ ...v, [id]: { n: r.n, unit: r.unit, data: new Float32Array(buf.buffer) } }));
    }).catch(() => setValues((v) => ({ ...v, [id]: "err" })));
  };
  useEffect(() => { setValues({}); }, [s.ra, s.dec, s.fov]);

  const onMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const fx = (p.x - PX) / PS, fy = (p.y - PY) / PS;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) { onCursor?.(null); return; }
    fetchValues();
    const w = unproject(fx, fy, s.ra, s.dec, s.fov);
    let flux = null, unit = null;
    const v = cur && values[cur.id];
    if (v && v.data && s.mode === "blink") {
      const c = Math.min(v.n - 1, Math.floor(fx * v.n)), r = Math.min(v.n - 1, Math.floor(fy * v.n));
      flux = v.data[r * v.n + c];
      unit = v.unit;
    }
    onCursor?.({ ...w, flux, unit });
  };

  // ---- overlays ----
  const year = cur ? mjdToYear(cur.mjd) : 2026;
  const toXY = (ra, dec) => {
    const p = project(ra, dec, s.ra, s.dec, s.fov);
    if (!p || p.fx < 0 || p.fx > 1 || p.fy < 0 || p.fy > 1) return null;
    return [PX + p.fx * PS, PY + p.fy * PS];
  };
  const gaia = useMemo(() => {
    if (!s.gaia || !cats.gaia?.stars) return [];
    return cats.gaia.stars.filter((g) => g.g_mag != null && g.g_mag < 18).slice(0, 150).map((g) => {
      const q = propagate(g.ra, g.dec, g.pmra_masyr, g.pmdec_masyr, GAIA_EPOCH, year);
      return { g, xy: toXY(q.ra, q.dec) };
    }).filter((o) => o.xy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.gaia, cats.gaia, year, s.ra, s.dec, s.fov]);
  const wise = useMemo(() => {
    if (!s.wise || !cats.wise?.sources) return [];
    return cats.wise.sources.slice(0, 200).map((w) => ({ w, xy: toXY(w.ra, w.dec) })).filter((o) => o.xy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.wise, cats.wise, s.ra, s.dec, s.fov]);
  const candList = cands.status === "ready" ? cands.data.candidates : [];
  const sb = niceScale(s.fov);
  const sbPx = (sb / (s.fov * 60)) * PS;
  const half = s.fov * 30;
  const ticks = [-1, -0.5, 0, 0.5, 1];

  // ---- veil / status ----
  let veil = null;
  if (meta.status === "loading") veil = <div><div className="spin" /><b>Searching the IRSA archive…</b>Finding every SPHEREx exposure that covers this position.</div>;
  else if (meta.status === "error") veil = <div><b>Archive query failed</b>{meta.error}</div>;
  else if (meta.status === "ready" && !sel.length) veil = <div><b>No SPHEREx frames here</b>{meta.message || "Try another position, detector or data release."}</div>;
  else if (!img && sel.length) {
    const done = loadedCount + failedCount;
    if (s.mode === "stack" && !allLoaded) veil = <div><div className="spin" /><b>Waiting for all frames before stacking</b>{done} / {sel.length} loaded</div>;
    else if (s.mode === "diff" && loadedIds.length < 2) veil = <div><div className="spin" /><b>Loading frames for the difference image…</b>{done} / {sel.length}</div>;
    else if (failedCount === sel.length) veil = <div><b>Frames could not be loaded</b>The IRSA cutout service did not respond. Try again in a minute.</div>;
    else veil = <div><div className="spin" /><b>Downloading SPHEREx cutouts from IRSA</b>The first view of a new target takes a while; frames appear as they arrive.<div className="prog"><i style={{ width: `${(100 * done) / Math.max(1, sel.length)}%` }} /></div><div className="mono" style={{ marginTop: 6 }}>{done} / {sel.length}</div></div>;
  }

  return (
    <div className="view" ref={fsRef} data-tour="view" role="img" aria-label={`Sky image of ${s.name || "the selected position"}${cur ? `, frame ${idx + 1} of ${sel.length}` : ""}`}>
      <svg ref={svgRef} viewBox="0 0 640 640" onMouseMove={onMove} onMouseLeave={() => onCursor?.(null)}>
        <defs>
          <clipPath id="pl"><rect x={PX} y={PY} width={PS} height={PS} /></clipPath>
          <radialGradient id="bg2" cx=".5" cy=".5" r=".7"><stop offset="0" stopColor="#14233f" /><stop offset="1" stopColor="#060b16" /></radialGradient>
          <radialGradient id="vg" cx=".5" cy=".5" r=".75"><stop offset=".65" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></radialGradient>
          <radialGradient id="og"><stop offset="0" stopColor="#FFB86B" stopOpacity=".7" /><stop offset="1" stopColor="#FFB86B" stopOpacity="0" /></radialGradient>
          <linearGradient id="cbs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset=".28" stopColor="#5EEAD4" /><stop offset=".58" stopColor="#1f3b66" /><stop offset=".82" stopColor="#0d1730" /><stop offset="1" stopColor="#04070d" /></linearGradient>
          <linearGradient id="cbd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF7ED" /><stop offset=".12" stopColor="#FFB86B" /><stop offset=".5" stopColor="#0b1426" /><stop offset=".88" stopColor="#A78BFA" /><stop offset="1" stopColor="#F5F3FF" /></linearGradient>
          <marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#FFB86B" /></marker>
        </defs>
        <rect x={PX} y={PY} width={PS} height={PS} fill="url(#bg2)" />
        <g clipPath="url(#pl)">
          {img && <image href={img} x={PX} y={PY} width={PS} height={PS} preserveAspectRatio="none" />}
          {s.grid && <g stroke="#97A6C2" strokeOpacity=".14">
            <path d={[1, 2, 3].map((k) => `M${PX + (k * PS) / 4} ${PY}V${PY + PS}M${PX} ${PY + (k * PS) / 4}H${PX + PS}`).join("")} />
          </g>}
          {wise.map(({ w, xy }) => (
            <circle key={w.designation} cx={xy[0]} cy={xy[1]} r="7" fill="none" stroke="#7DD3FC" strokeWidth="1.2">
              <title>{`AllWISE ${w.designation}\nW1 ${w.w1 ?? "–"} · W2 ${w.w2 ?? "–"}`}</title>
            </circle>
          ))}
          {gaia.map(({ g, xy }, i) => (
            <g key={g.source_id}>
              <rect x={xy[0] - 7} y={xy[1] - 7} width="14" height="14" rx="3" fill="none" stroke="#A78BFA" strokeWidth="1.3">
                <title>{`Gaia DR3 ${g.source_id}\nG ${g.g_mag ?? "–"} · proper motion ${g.pm_total_masyr} mas/yr`}</title>
              </rect>
              {i < 3 && <text x={xy[0] + 10} y={xy[1] - 9} fill="#A78BFA" fontSize="10">Gaia</text>}
            </g>
          ))}
          {candList.map((c, i) => {
            const on = i === candSel;
            const to = [PX + c.fx * PS, PY + c.fy * PS];
            const col = c.status === "variable" ? "#A78BFA" : c.status === "known mover" ? "#5EEAD4" : "#FFB86B";
            const from = c.from_fx != null ? [PX + c.from_fx * PS, PY + c.from_fy * PS] : null;
            const moving = c.status.includes("mover") && from;
            return (
              <g key={i} opacity={on ? 1 : 0.75}>
                {moving && <>
                  {[0.25, 0.5, 0.75].map((t) => <circle key={t} cx={from[0] + (to[0] - from[0]) * t} cy={from[1] + (to[1] - from[1]) * t} r={1.6 + t} fill={col} opacity={0.3 + t * 0.5} />)}
                  <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={col} strokeWidth="1.4" strokeDasharray="4 4" markerEnd="url(#ar)" />
                </>}
                {on && <circle cx={to[0]} cy={to[1]} r="20" fill="url(#og)" />}
                <path d={`M${to[0] - 13} ${to[1] - 4}v-9h9M${to[0] + 4} ${to[1] - 13}h9v9M${to[0] + 13} ${to[1] + 4}v9h-9M${to[0] - 4} ${to[1] + 13}h-9v-9`} stroke={col} strokeWidth={on ? 1.8 : 1.2} fill="none" />
              </g>
            );
          })}
          <g stroke="#5EEAD4" strokeWidth="1.6" fill="none">
            <circle cx={PX + PS / 2} cy={PY + PS / 2} r="22" />
            <path d={`M${PX + PS / 2} ${PY + PS / 2 - 38}v14M${PX + PS / 2} ${PY + PS / 2 + 24}v14M${PX + PS / 2 - 38} ${PY + PS / 2}h14M${PX + PS / 2 + 24} ${PY + PS / 2}h14`} />
          </g>
          <rect x={PX} y={PY} width={PS} height={PS} fill="url(#vg)" pointerEvents="none" />
          {(() => {
            const c = candList[candSel];
            if (!c) return null;
            const x = PX + c.fx * PS, y = PY + c.fy * PS;
            const right = x < PX + PS - 190;
            const bx = right ? x + 36 : x - 186, by = Math.max(PY + 8, y - 70);
            const col = c.status === "variable" ? "#A78BFA" : c.status === "known mover" ? "#5EEAD4" : "#FFB86B";
            const line2 = c.status === "variable" ? `flux ×${c.flux_ratio} · ${c.variability_sigma}σ`
              : `μ ${c.motion_arcsec_yr}″/yr · ${c.shift_sigma}σ`;
            return (
              <g>
                <path d={`M${x + (right ? 10 : -10)} ${y - 10}L${right ? bx : bx + 150} ${by + 22}`} stroke={col} strokeWidth="1" />
                <rect x={bx} y={by} width="150" height="44" rx="8" fill="#060912" fillOpacity=".88" stroke={col} strokeOpacity=".7" />
                <text x={bx + 12} y={by + 19} fill={col} fontSize="12" fontWeight="500">{`candidate ${c.status}`}</text>
                <text x={bx + 12} y={by + 35} fill="#97A6C2" fontSize="10.5">{line2}</text>
              </g>
            );
          })()}
        </g>
        <rect x={PX} y={PY} width={PS} height={PS} fill="none" stroke="#2A3B5E" />
        {s.grid && <>
          <g fill="#97A6C2" fontSize="11" textAnchor="middle">{ticks.map((t) => <text key={t} x={PX + ((t + 1) / 2) * PS} y="604">{fmtOff(-t * half)}</text>)}</g>
          <g fill="#97A6C2" fontSize="11" textAnchor="end">{ticks.map((t) => <text key={t} x="48" y={PY + ((t + 1) / 2) * PS + 4}>{fmtOff(-t * half)}</text>)}</g>
          <text x={PX + PS / 2} y="626" fill="#97A6C2" fontSize="11" textAnchor="middle" letterSpacing="1">ΔRA (East ←)</text>
          <text x="14" y={PY + PS / 2} fill="#97A6C2" fontSize="11" textAnchor="middle" letterSpacing="1" transform={`rotate(-90 14 ${PY + PS / 2})`}>ΔDec</text>
          <g stroke="#97A6C2"><path d={ticks.map((t) => `M${PX + ((t + 1) / 2) * PS} ${PY + PS}v6M${PX - 6} ${PY + ((t + 1) / 2) * PS}h6`).join("")} /></g>
          <g stroke="#E8EEF8" strokeWidth="1.6" fill="#E8EEF8">
            <path d="M572 96V54M572 96H530" fill="none" />
            <path d="M572 48l-4 8h8zM524 96l8-4v8z" stroke="none" />
          </g>
          <g fill="#E8EEF8" fontSize="11" fontWeight="500"><text x="572" y="42" textAnchor="middle">N</text><text x="516" y="100" textAnchor="end">E</text></g>
          <g stroke="#E8EEF8" strokeWidth="1.6"><path d={`M72 560H${72 + sbPx}M72 554v12M${72 + sbPx} 554v12`} /></g>
          <text x={72 + sbPx / 2} y="548" fill="#E8EEF8" fontSize="11" textAnchor="middle">{sb >= 60 ? `${sb / 60}′` : `${sb}″`}</text>
        </>}
        <rect x="626" y={PY} width="8" height={PS} rx="4" fill={diverging ? "url(#cbd)" : "url(#cbs)"} />
      </svg>
      {veil && <div className="veil">{veil}</div>}
      {cur && s.mode === "blink" && img && <div className="hud" style={{ left: "10%", top: "5%" }}>Frame {idx + 1} / {sel.length} · <span style={{ color: "var(--mu)" }}>{cur.utc.replace("T", " ").slice(0, 16)} UTC</span></div>}
      {s.mode === "stack" && img && <div className="hud" style={{ left: "10%", top: "5%" }}>Median stack of {loadedIds.length} frames</div>}
      {s.mode === "diff" && img && cur && <div className="hud" style={{ left: "10%", top: "5%" }}>Frame {idx + 1} − median · <span style={{ color: "var(--mu)" }}>orange brighter now · violet fainter</span></div>}
      {img && <div className="hud" style={{ right: "9%", bottom: "10%" }}>{s.mode === "diff" ? "difference" : s.stretch} · {s.det === "all" ? "All detectors" : `D${s.det}`}{s.showFlags ? " · flags" : ""}</div>}
      {img && s.mode === "blink" && !blinkOK && cur && imgState[blinkURL] !== "err" && <div className="hud" style={{ left: "10%", bottom: "10%" }}>loading frame {idx + 1}…</div>}
      {(s.mode !== "blink" && modeURL && modeStatus === "loading" && modeShown) && <div className="hud" style={{ left: "10%", bottom: "10%" }}>updating…</div>}
    </div>
  );
}
