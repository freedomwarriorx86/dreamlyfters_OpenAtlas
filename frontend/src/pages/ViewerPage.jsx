import React, { useEffect, useMemo, useRef, useState } from "react";
import { TEST_OBJECTS, shareQuery, useAtlas } from "../store";
import { copyText, download, gifURL, toCSV } from "../lib/api";
import { fmtDMS, fmtHMS, fmtUTC, mjdToYear, parseDec, parseRA } from "../lib/astro";
import SkyView from "../components/SkyView";
import Aladin, { nearestSlice } from "../components/Aladin";
import { DetChips, LightCurve, Spectrum, SpectrumMini } from "../components/Charts";
import Hint from "../components/Hint";

const Icon = {
  prev: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>,
  next: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>,
  play: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z" /></svg>,
  pause: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>,
  loop: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3" /></svg>,
};

const FOV_STEPS = [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15];

function Switch({ label, on, onChange, extra, hint }) {
  return (
    <div className="sw"><span>{label}{hint ? <> <Hint id={hint} /></> : null}{extra ? <em>{extra}</em> : null}</span>
      <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
function Controls() {
  const { s, set, loadTarget, openObject, frames, sel, pool, meta } = useAtlas();
  const [fmt, setFmt] = useState("deg");
  const [raT, setRaT] = useState("");
  const [decT, setDecT] = useState("");
  useEffect(() => {
    setRaT(fmt === "deg" ? s.ra.toFixed(4) + "°" : fmtHMS(s.ra, 2));
    setDecT(fmt === "deg" ? (s.dec < 0 ? "−" : "") + Math.abs(s.dec).toFixed(4) + "°" : fmtDMS(s.dec, 1));
  }, [s.ra, s.dec, fmt]);
  const ra = parseRA(raT.replace(/°$/, "")), dec = parseDec(decT.replace(/°$/, ""));
  const raOK = isFinite(ra) && ra >= 0 && ra <= 360, decOK = isFinite(dec) && dec >= -90 && dec <= 90;
  const counts = useMemo(() => frames.reduce((a, f) => ((a[f.detector] = (a[f.detector] || 0) + 1), a), {}), [frames]);
  const fovIdx = FOV_STEPS.reduce((b, v, i) => (Math.abs(v - s.fov) < Math.abs(FOV_STEPS[b] - s.fov) ? i : b), 0);
  const activeObj = TEST_OBJECTS.find((o) => o.name === s.name);

  return (
    <aside className="pn" aria-label="Controls" data-tour="controls">
      <p className="h">Target <span>ICRS <Hint id="icrs" /></span></p>
      <form data-tour="target" style={{ display: "flex", flexDirection: "column", gap: 10 }} onSubmit={(e) => { e.preventDefault(); if (raOK && decOK) loadTarget({ name: "", ra, dec }); }}>
        <div className="fld"><span className="lbl">Right ascension (RA) <Hint id="ra" /></span><input aria-label="Right ascension" value={raT} onChange={(e) => setRaT(e.target.value)} aria-invalid={!raOK} spellCheck="false" /></div>
        <div className="fld"><span className="lbl">Declination (Dec) <Hint id="dec" /></span><input aria-label="Declination" value={decT} onChange={(e) => setDecT(e.target.value)} aria-invalid={!decOK} spellCheck="false" /></div>
        <div className="seg" role="group" aria-label="Coordinate format">
          <button type="button" className={fmt === "deg" ? "on" : ""} onClick={() => setFmt("deg")}>Degrees</button>
          <button type="button" className={fmt === "hms" ? "on" : ""} onClick={() => setFmt("hms")}>HMS / DMS</button>
        </div>
        <button className="solid" style={{ width: "100%", height: 44 }} disabled={!raOK || !decOK}>Load sky patch</button>
      </form>

      <div className="ctl" data-tour="fov">
        <p className="h"><span className="hl">Field of view <Hint id="fov" /></span><span>{s.fov < 1 ? `${s.fov * 60}″` : `${s.fov}′`}</span></p>
        <input className="range" type="range" min="0" max={FOV_STEPS.length - 1} step="1" value={fovIdx}
          aria-label="Field of view" aria-valuetext={`${FOV_STEPS[fovIdx]} arcminutes`}
          onChange={(e) => set({ fov: FOV_STEPS[+e.target.value] })} />
        <div className="scale-lbl"><span>zoomed in</span><span>zoomed out</span></div>
      </div>

      <div className="ctl" data-tour="mode">
        <p className="h"><span className="hl">Mode <Hint text="Blink = play the frames like a flip-book. Stack = average them for a deeper image. Diff = subtract them so only changes remain." /></span></p>
        <ModeSeg />
      </div>

      <div className="ctl" data-tour="detector">
        <p className="h"><span className="hl">Detector <Hint id="detector" /></span><span>{meta.status === "ready" ? `${pool.length} exposures` : ""}</span></p>
        <DetChips value={s.det} onChange={(d) => set({ det: d })} counts={counts} />
      </div>

      <div className="ctl" data-tour="nframes">
        <p className="h"><span className="hl">Frames to blink <Hint text="How many exposures to play, picked evenly over time. More frames = smoother, but the first download from NASA takes longer." /></span><span>{sel.length} of {pool.length}</span></p>
        <div className="seg" role="group" aria-label="Number of frames">
          {[12, 24, 48].map((n) => <button key={n} className={s.n === n ? "on" : ""} aria-pressed={s.n === n} onClick={() => set({ n })}>{n}</button>)}
        </div>
      </div>

      <div className="ctl" data-tour="stretch">
        <p className="h"><span className="hl">Stretch <Hint id="stretch" /></span></p>
        <StretchSeg />
      </div>

      <div className="ctl" data-tour="overlays">
        <p className="h"><span className="hl">Overlays <Hint id="overlay" /></span></p>
        <Overlays />
      </div>

      <p className="h">Test objects</p>
      <div className="ctl" data-tour="tests">
      {TEST_OBJECTS.map((o) => (
        <button key={o.key} className={`pre ${activeObj?.key === o.key ? "on" : ""}`} onClick={() => openObject(o)}>
          <span className="ic" style={{ background: o.color + "26", color: o.color }}>{o.icon}</span>
          <div><b>{o.name}</b><span>{o.type}</span></div>
        </button>
      ))}
      </div>
    </aside>
  );
}

// Control groups shared by the side panel and the fullscreen panel
function ModeSeg() {
  const { s, set } = useAtlas();
  return (
    <div className="seg" role="group" aria-label="Display mode">
      {[["blink", "Blink"], ["stack", "Stack"], ["diff", "Diff"]].map(([m, l]) => (
        <button key={m} className={s.mode === m ? "on" : ""} aria-pressed={s.mode === m} onClick={() => set({ mode: m })}>{l}</button>
      ))}
    </div>
  );
}

function StretchSeg() {
  const { s, set } = useAtlas();
  return (
    <div className="seg" role="group" aria-label="Stretch">
      {["linear", "asinh", "log"].map((m) => <button key={m} className={s.stretch === m ? "on" : ""} aria-pressed={s.stretch === m} onClick={() => set({ stretch: m })}>{m[0].toUpperCase() + m.slice(1)}</button>)}
    </div>
  );
}

function Overlays() {
  const { s, set } = useAtlas();
  return (
    <>
      <Switch label="Gaia sources" on={s.gaia} onChange={(v) => set({ gaia: v })} />
      <Switch label="WISE sources" on={s.wise} onChange={(v) => set({ wise: v })} />
      <Switch label="Contamination flags" hint="flags" on={s.showFlags} onChange={(v) => set({ showFlags: v })} />
      <Switch label="Grid and compass" on={s.grid} onChange={(v) => set({ grid: v })} />
    </>
  );
}

// Slide-out control panel shown in fullscreen: opens when the cursor reaches the
// right edge or the tab is clicked; the pin keeps it open.
function FsPanel({ onExit }) {
  const { s, set, frames, cur, idx, sel } = useAtlas();
  const [pinned, setPinned] = useState(() => { try { return localStorage.getItem("oa.fsPinned") === "1"; } catch { return false; } });
  const [hover, setHover] = useState(false);
  const open = pinned || hover;
  const counts = useMemo(() => frames.reduce((a, f) => ((a[f.detector] = (a[f.detector] || 0) + 1), a), {}), [frames]);
  const pin = () => {
    setPinned((p) => { try { localStorage.setItem("oa.fsPinned", p ? "0" : "1"); } catch { /* ignore */ } return !p; });
  };
  const fovIdx = FOV_STEPS.reduce((b, v, i) => (Math.abs(v - s.fov) < Math.abs(FOV_STEPS[b] - s.fov) ? i : b), 0);
  return (
    <>
      <div className="fs-hot" onMouseEnter={() => setHover(true)} aria-hidden="true" />
      <button className={`fs-tab ${open ? "open" : ""}`} onMouseEnter={() => setHover(true)} onClick={() => (pinned ? pin() : setHover(!hover))} aria-expanded={open} aria-controls="fs-panel">
        {open ? "›" : "‹"} Controls
      </button>
      <aside id="fs-panel" className={`fs-panel ${open ? "open" : ""}`} onMouseLeave={() => setHover(false)} aria-label="Fullscreen controls">
        <div className="fs-head">
          <b>{s.name || "Custom position"}</b>
          <div style={{ display: "flex", gap: 6 }}>
            <button className={`btn ${pinned ? "on" : ""}`} style={{ width: 36, height: 36 }} onClick={pin} aria-pressed={pinned}
              title={pinned ? "Unpin: hide when the cursor leaves" : "Pin: keep this panel open"} aria-label="Pin panel">📌</button>
            <button className="btn" style={{ width: 36, height: 36 }} onClick={onExit} title="Exit fullscreen (Esc)" aria-label="Exit fullscreen">✕</button>
          </div>
        </div>
        {cur && <p className="note mono" style={{ fontSize: 11 }}>Frame {idx + 1}/{sel.length} · {fmtUTC(cur.utc)} · D{cur.detector}</p>}
        <PlayBar compact />
        <p className="h">Mode</p><ModeSeg />
        <p className="h">Detector</p><DetChips value={s.det} onChange={(d) => set({ det: d })} counts={counts} />
        <p className="h">Stretch</p><StretchSeg />
        <p className="h">Field of view <span>{s.fov}′</span></p>
        <input className="range" type="range" min="0" max={FOV_STEPS.length - 1} value={fovIdx} aria-label="Field of view" onChange={(e) => set({ fov: FOV_STEPS[+e.target.value] })} />
        <p className="h">Overlays</p><Overlays />
        <p className="note" style={{ fontSize: 11 }}>Move the cursor to the right edge to open this panel, 📌 to keep it open, Esc to leave fullscreen.</p>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
function PlayBar({ compact = false }) {
  const { s, set, sel, idx, setIdx, step, playing, setPlaying } = useAtlas();
  return (
    <div className={`bar ${compact ? "compact" : ""}`} data-tour={compact ? undefined : "playbar"}>
      <button className="btn" aria-label="Previous frame" onClick={() => { setPlaying(false); step(-1); }} disabled={sel.length < 2}>{Icon.prev}</button>
      <button className="btn pl" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)} disabled={sel.length < 2 || s.mode === "stack"}>{playing ? Icon.pause : Icon.play}</button>
      <button className="btn" aria-label="Next frame" onClick={() => { setPlaying(false); step(1); }} disabled={sel.length < 2}>{Icon.next}</button>
      <input className="range scrub" type="range" min="0" max={Math.max(0, sel.length - 1)} value={Math.min(idx, Math.max(0, sel.length - 1))}
        aria-label="Frame" onChange={(e) => { setPlaying(false); setIdx(+e.target.value); }} disabled={sel.length < 2} />
      <div className="seg" style={{ width: 150 }} role="group" aria-label="Speed">
        {[1, 2, 4].map((v) => <button key={v} className={s.speed === v ? "on" : ""} onClick={() => set({ speed: v })}>{v}×</button>)}
      </div>
      <button className={`btn ${s.loop ? "on" : ""}`} aria-label="Loop" aria-pressed={s.loop} onClick={() => set({ loop: !s.loop })}>{Icon.loop}</button>
    </div>
  );
}

function Filmstrip() {
  const { sel, idx, setIdx, urlFor, imgState, setPlaying } = useAtlas();
  if (!sel.length) return null;
  const start = Math.max(0, Math.min(idx - 5, sel.length - 12));
  const win = sel.slice(start, start + 12);
  return (
    <div className="film" aria-label="Frame timeline">
      {win.map((f, k) => {
        const i = start + k, u = urlFor(f.id), st = imgState[u];
        return (
          <button key={f.id} className={`th ${i === idx ? "on" : ""} ${st === "err" ? "err" : ""}`} aria-label={`Frame ${i + 1}, ${fmtUTC(f.utc)}, detector ${f.detector}`}
            onClick={() => { setPlaying(false); setIdx(i); }}>
            {st === "ok" ? <img src={u} alt="" loading="lazy" /> : <span className="ld">{st === "err" ? "×" : "…"}</span>}
            <span className="dt">D{f.detector}</span>
          </button>
        );
      })}
    </div>
  );
}

function Coverage() {
  const { pool, sel, cur, setIdx, setPlaying } = useAtlas();
  if (!pool.length) return null;
  const t0 = pool[0].mjd, t1 = pool[pool.length - 1].mjd;
  const x = (m) => 10 + ((m - t0) / Math.max(1, t1 - t0)) * 580;
  const selIds = new Set(sel.map((f) => f.id));
  return (
    <>
      <p className="h">Coverage <span>{pool[0].utc.slice(0, 10)} → {pool[pool.length - 1].utc.slice(0, 10)}</span></p>
      <svg viewBox="0 0 600 40" width="100%" role="img" aria-label={`Exposure coverage: ${pool.length} exposures`}>
        <rect x="0" y="16" width="600" height="8" rx="4" fill="#1F2C47" />
        <g stroke="#97A6C2" strokeOpacity=".35" strokeWidth="1">{pool.filter((f) => !selIds.has(f.id)).map((f) => <path key={f.id} d={`M${x(f.mjd)} 14v12`} />)}</g>
        <g stroke="#5EEAD4" strokeWidth="2" strokeOpacity=".85">
          {sel.map((f, i) => <path key={f.id} d={`M${x(f.mjd)} 12v16`} style={{ cursor: "pointer" }} onClick={() => { setPlaying(false); setIdx(i); }} />)}
        </g>
        {cur && <><path d={`M${x(cur.mjd)} 6v28`} stroke="#fff" strokeWidth="2" /><circle cx={x(cur.mjd)} cy="20" r="5" fill="#fff" stroke="#5EEAD4" strokeWidth="3" /></>}
      </svg>
    </>
  );
}

function Compare() {
  const { s, cur, urlFor, imgState } = useAtlas();
  const fovDeg = s.fov / 60;
  const wl = cur ? (cur.wav_min_um + cur.wav_max_um) / 2 : 2;
  const box = [{ type: "circle", ra: s.ra, dec: s.dec, r: Math.min(fovDeg / 12, 0.004), color: "#5EEAD4" }];
  return (
    <div className="cmp">
      <figure>
        <div className="im">{cur && imgState[urlFor(cur.id)] === "ok" ? <img src={urlFor(cur.id)} alt="Current SPHEREx frame" /> : <div className="veil">Frame loading…</div>}</div>
        <figcaption>SPHEREx frame · D{cur?.detector} · {cur ? fmtUTC(cur.utc) : ""}</figcaption>
      </figure>
      <figure>
        <div className="im"><Aladin ra={s.ra} dec={s.dec} fovDeg={fovDeg} survey="spherex" slice={nearestSlice(wl)} shapes={box} interactive={false} label="SPHEREx DR1 all-sky coadd" /></div>
        <figcaption>SPHEREx DR1 all-sky cube · {wl.toFixed(2)} µm channel (IRSA HiPS)</figcaption>
      </figure>
      <figure>
        <div className="im"><Aladin ra={s.ra} dec={s.dec} fovDeg={fovDeg} survey="allwise" shapes={box} interactive={false} label="AllWISE color" /></div>
        <figcaption>AllWISE W1/W2/W4 color · epoch ≈ 2010</figcaption>
      </figure>
      <figure>
        <div className="im"><Aladin ra={s.ra} dec={s.dec} fovDeg={fovDeg} survey="twomass" shapes={box} interactive={false} label="2MASS color" /></div>
        <figcaption>2MASS J/H/K color · epoch ≈ 1999</figcaption>
      </figure>
      <p className="note" style={{ gridColumn: "1/-1" }}>A source that sits at different places in the 1999 (2MASS), 2010 (WISE) and 2025–26 (SPHEREx) images is moving. The teal circle marks your target position.</p>
    </div>
  );
}

function LightCurveTab() {
  const { sel, phot, photBusy, loadLightCurve, cur, setIdx, setPlaying } = useAtlas();
  const [det, setDet] = useState("all");
  const pts = sel.map((f) => phot[f.id]).filter(Boolean);
  const have = pts.filter((p) => p.flux_ujy != null).length;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <DetChips value={det} onChange={setDet} />
        <button className="ghost" onClick={loadLightCurve} disabled={photBusy.lc}>{photBusy.lc ? `Measuring… ${pts.length}/${sel.length}` : pts.length < sel.length ? "Measure all frames" : "Measured"}</button>
      </div>
      {have ? <LightCurve points={pts} det={det} current={cur?.id} onPick={(id) => { setPlaying(false); setIdx(sel.findIndex((f) => f.id === id)); }} />
        : <div className="alert">{photBusy.lc ? "Measuring aperture photometry on each frame…" : "Press “Measure all frames” to run aperture photometry on the blinked frames."}</div>}
      <p className="note">Aperture photometry (12″ radius, local background) on each exposure at the target position, grouped by detector because brightness depends on wavelength. Click a point to jump to that frame.</p>
    </>
  );
}

function SpectrumTab() {
  const { phot, photBusy, loadSpectrum, specFrames } = useAtlas();
  const [norm, setNorm] = useState(false);
  useEffect(() => { loadSpectrum(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pts = Object.values(phot);
  const done = specFrames.filter((f) => phot[f.id]).length;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <span className="note">{photBusy.spec ? `Measuring ${done}/${specFrames.length} exposures across all six detectors…` : `${pts.filter((p) => p.flux_ujy != null).length} measurements`}</span>
        <div className="chips"><button className={`chip ${!norm ? "on" : ""}`} onClick={() => setNorm(false)}>Flux</button><button className={`chip ${norm ? "on" : ""}`} onClick={() => setNorm(true)}>Normalized</button></div>
      </div>
      {pts.some((p) => p.flux_ujy != null) ? <Spectrum points={pts} normalized={norm} /> : <div className="alert">{photBusy.spec ? "Collecting exposures for the spectrum…" : "No spectrum yet."}</div>}
      <p className="note">Each point is one exposure: SPHEREx's linear variable filters give every pixel its own wavelength, so frames taken at different times sample different parts of the 0.75–5 µm spectrum. Dashed lines mark water ice, CO₂ and CO features.</p>
    </>
  );
}

// ---------------------------------------------------------------------------
function Details({ cursor }) {
  const { s, cur, phot, cands, candSel, setCandSel, runCandidates, addFlag, flagged, specFrames, sel, notify } = useAtlas();
  const p = cur ? phot[cur.id] : null;
  const list = cands.status === "ready" ? cands.data.candidates : [];
  const specPts = Object.values(phot).filter((x) => x.flux_ujy != null);
  const embed = shareQuery(s);
  const flag = () => {
    const c = list[candSel];
    addFlag(c ? { type: "candidate", target: s.name, ...c, frame: cur?.id } : { type: "frame", target: s.name, ra: s.ra, dec: s.dec, frame: cur?.id, utc: cur?.utc });
    notify(c ? `Flagged candidate ${c.n} (${flagged.length + 1} flagged)` : `Flagged frame ${cur?.id}`);
  };
  const exportCSV = () => {
    const rows = [
      ...list.map((c) => ({ kind: "candidate", target: s.name, ...c })),
      ...flagged.map((f) => ({ kind: `flagged ${f.type}`, ...f })),
    ];
    if (!rows.length) return notify("Nothing to export yet");
    download(`openatlas_candidates_${s.ra.toFixed(3)}_${s.dec.toFixed(3)}.csv`,
      toCSV(rows, ["kind", "target", "n", "status", "ra", "dec", "from_ra", "from_dec", "motion_arcsec_yr", "pa_deg", "shift_arcsec", "shift_sigma",
        "flux_ratio", "variability_sigma", "snr", "gaia_source_id", "gaia_pm_masyr", "frame", "utc", "flagged_at"]));
  };
  return (
    <aside className="pn" aria-label="Details" data-tour="details">
      <p className="h" data-tour="frame-details"><span className="hl">Frame details <Hint id="exposure" /></span></p>
      <div>
        <div className="kv"><span>Observed</span><b>{cur ? `${fmtUTC(cur.utc)} · MJD ${cur.mjd.toFixed(3)}` : "—"}</b></div>
        <div className="kv"><span>Detector</span><b>{cur ? `D${cur.detector}` : "—"}</b></div>
        <div className="kv"><span>Wavelength</span><b>{p?.wavelength_um ? `${p.wavelength_um.toFixed(3)} µm${p.bandwidth_um ? ` (Δ${p.bandwidth_um.toFixed(3)})` : ""}` : cur ? `${cur.wav_min_um.toFixed(2)}–${cur.wav_max_um.toFixed(2)} µm` : "—"}</b></div>
        <div className="kv"><span>Target flux</span><b title={p?.note || ""}>{p?.flux_ujy != null ? `${p.saturated ? "≈ " : ""}${p.flux_ujy.toFixed(1)} ± ${p.err_ujy.toFixed(1)} µJy` : p ? (p.saturated ? "saturated" : "not measured") : "—"}</b></div>
        {p?.saturated && <p className="note" style={{ color: "#FFD9A8" }}>Saturated: the star is too bright for SPHEREx, so this is an estimate from its outer glow (good for spotting changes, not exact). <Hint id="saturation" /></p>}
        <div className="kv"><span>Quality flags</span><b>{p ? (p.flags?.length ? p.flags.join(", ") : "none") : "—"}</b></div>
        <div className="kv"><span>Exposure</span><b className="mono" style={{ fontSize: 11 }}>{cur ? cur.obs_id : "—"}</b></div>
      </div>
      <p className="h">Cursor</p>
      <div>
        <div className="kv"><span>RA</span><b>{cursor ? fmtHMS(cursor.ra, 2) : "—"}</b></div>
        <div className="kv"><span>Dec</span><b>{cursor ? fmtDMS(cursor.dec, 1) : "—"}</b></div>
        <div className="kv"><span>Flux</span><b>{cursor?.flux != null && isFinite(cursor.flux) ? `${cursor.flux.toPrecision(3)} ${cursor.unit}` : "—"}</b></div>
      </div>
      <p className="h">Spectrum <span>flux vs µm</span></p>
      {specPts.length >= 2 ? <SpectrumMini points={specPts} /> : <p className="note">Open the Spectrum tab to measure {specFrames.length} exposures across all six detectors.</p>}
      <p className="h" data-tour="candidates"><span className="hl">Candidates <Hint id="mover" /></span><span>{cands.status === "ready" ? `${list.length} found` : ""}</span></p>
      {cands.status === "loading" && <div className="note"><span className="dot busy" style={{ marginRight: 8 }} />Comparing early and late frames…</div>}
      {cands.status === "error" && <div className="alert err">{cands.error}</div>}
      {cands.status === "idle" && <button className="ghost" onClick={runCandidates} disabled={sel.length < 4}>Find movers now</button>}
      {cands.status === "ready" && !list.length && <p className="note">{cands.data.note || `No significant movers or variables among ${cands.data.n_sources} bright sources (astrometric scatter ${cands.data.astrometric_scatter_arcsec}″).`}</p>}
      {list.slice(0, 4).map((c, i) => (
        <button key={i} className={`cand ${i === candSel ? "on" : ""}`} onClick={() => setCandSel(i)}>
          <div><span className="mono">{c.ra.toFixed(3)}, {c.dec.toFixed(3)}</span><em className={c.status === "known mover" ? "k" : c.status === "variable" ? "v" : ""}>{c.status}</em></div>
          <div className="meter" style={{ display: "block" }}><i style={{ width: `${Math.min(100, (c.status === "variable" ? c.variability_sigma : c.shift_sigma) * 8)}%` }} /></div>
          <div style={{ fontSize: 12, color: "var(--mu)" }}>
            {c.status === "variable" ? `Confidence ${c.variability_sigma}σ · flux ×${c.flux_ratio}` : `Confidence ${c.shift_sigma}σ · motion ${c.motion_arcsec_yr}″/yr`}
            {c.gaia_pm_masyr != null ? ` · Gaia ${(c.gaia_pm_masyr / 1000).toFixed(2)}″/yr` : ""}
          </div>
        </button>
      ))}
      <div className="row"><button className="ghost" onClick={flag}>Flag</button><button className="ghost" onClick={exportCSV}>Export CSV</button></div>
      <p className="h">Embed</p>
      <div className="code">{embed}</div>
      <button className="solid" onClick={async () => notify((await copyText(window.location.origin + "/" + embed)) ? "Link copied" : "Copy failed")}>Copy link</button>
    </aside>
  );
}

// ---------------------------------------------------------------------------
export default function ViewerPage() {
  const { s, set, cur, sel, step, playing, setPlaying, addFlag, cands, candSel, notify, meta } = useAtlas();
  const [tab, setTab] = useState("viewer");
  const [cursor, setCursor] = useState(null);
  const fsRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (/input|textarea|select/i.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "ArrowRight") { setPlaying(false); step(1); }
      else if (e.key === "ArrowLeft") { setPlaying(false); step(-1); }
      else if (e.key === "d" || e.key === "D") set({ mode: s.mode === "diff" ? "blink" : "diff" });
      else if (e.key === "f" || e.key === "F") {
        const c = cands.status === "ready" ? cands.data.candidates[candSel] : null;
        addFlag(c ? { type: "candidate", target: s.name, ...c, frame: cur?.id } : { type: "frame", target: s.name, ra: s.ra, dec: s.dec, frame: cur?.id, utc: cur?.utc });
        notify(c ? `Flagged candidate ${c.n}` : "Flagged this frame");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, set, step, setPlaying, addFlag, cands, candSel, cur, notify]);

  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === fsRef.current && !!fsRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const fullscreen = () => {
    const el = fsRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => notify("Fullscreen is not available here"));
  };

  return (
    <main className="main">
      <Controls />
      <section className="pn" aria-label="Sky viewer">
        <div className="tabs" role="tablist" data-tour="tabs">
          {[["viewer", "Viewer"], ["lightcurve", "Light curve"], ["spectrum", "Spectrum"], ["compare", "Compare"]].map(([k, l]) => (
            <button key={k} className={`tab ${tab === k ? "on" : ""}`} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className="titlebar">
          <div className="nm">{s.name || "Custom position"}<span className="mono">{fmtHMS(s.ra, 1)} {fmtDMS(s.dec, 1)}</span></div>
          <div style={{ display: "flex", gap: 8 }}>
            <a className="ghost" href={sel.length ? gifURL(s, sel.map((f) => f.id), s.speed) : undefined} aria-disabled={!sel.length} download onClick={() => sel.length && notify("Rendering GIF… the download starts when it is ready")}>Export GIF</a>
            <button className="ghost" onClick={fullscreen}>Fullscreen</button>
          </div>
        </div>
        {meta.demo && <div className="alert warn">IRSA could not be reached, so these are <b>synthetic demo frames</b>, not real SPHEREx data. {meta.error}</div>}
        {meta.source === "cache" && <div className="alert warn">IRSA is not answering right now; showing the last cached frame list.</div>}
        {tab === "viewer" && <>
          <div className={`stage ${isFs ? "fs" : ""}`} ref={fsRef}>
            <SkyView onCursor={setCursor} />
            {isFs && <FsPanel onExit={() => document.exitFullscreen()} />}
          </div>
          <PlayBar />
          <div data-tour="film" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Filmstrip />
            <Coverage />
          </div>
          <div className="keys"><span><kbd>Space</kbd> play</span><span><kbd>←</kbd><kbd>→</kbd> step</span><span><kbd>D</kbd> difference</span><span><kbd>F</kbd> flag</span><span><kbd>/</kbd> search</span></div>
        </>}
        {tab === "lightcurve" && <LightCurveTab />}
        {tab === "spectrum" && <SpectrumTab />}
        {tab === "compare" && <Compare />}
        {cur && tab !== "viewer" && <p className="note">Current frame: {fmtUTC(cur.utc)} · D{cur.detector} · epoch {mjdToYear(cur.mjd).toFixed(2)}</p>}
      </section>
      <Details cursor={cursor} />
    </main>
  );
}
