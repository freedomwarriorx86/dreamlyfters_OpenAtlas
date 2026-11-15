import React, { useEffect, useMemo, useState } from "react";
import { TEST_OBJECTS, shareQuery, useAtlas } from "../store";
import { copyText, diffURL, download, gifURL, stackURL, toCSV } from "../lib/api";
import { fmtUTC } from "../lib/astro";
import { DetChips, LightCurve, Spectrum } from "../components/Charts";
import { useImageStatus } from "../components/SkyView";
import Hint from "../components/Hint";

function Tile({ label, src }) {
  const st = useImageStatus(src);
  return (
    <div className="tile">{label}
      <div className="im">
        {src && st === "ok" && <img src={src} alt={label} />}
        {(!src || st !== "ok") && <div className="veil">{!src ? "—" : st === "err" ? "could not render" : <div><div className="spin" style={{ width: 22, height: 22 }} />rendering…</div>}</div>}
      </div>
    </div>
  );
}

function DiffPanel() {
  const { s, sel, urlFor, imgState } = useAtlas();
  const loaded = sel.filter((f) => imgState[urlFor(f.id)] === "ok");
  const [op, setOp] = useState("pair");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  useEffect(() => {
    if (!loaded.length) return;
    const fa = loaded.find((f) => f.id === a) || loaded[loaded.length - 1];
    if (fa.id !== a) setA(fa.id);
    const same = loaded.filter((f) => f.detector === fa.detector && f.id !== fa.id);
    if (!loaded.some((f) => f.id === b && f.id !== fa.id)) setB((same[0] || loaded.find((f) => f.id !== fa.id) || fa).id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded.length, a]);
  const ids = loaded.map((f) => f.id);
  const fa = loaded.find((f) => f.id === a), fb = loaded.find((f) => f.id === b);
  const half = Math.floor(loaded.length / 2);
  let tA = null, tB = null, lA = "Frame A", lB = "Frame B";
  if (op === "pair") { tA = fa && urlFor(fa.id); tB = fb && urlFor(fb.id); lA = `A · ${fa ? fmtUTC(fa.utc) + " D" + fa.detector : ""}`; lB = `B · ${fb ? fmtUTC(fb.utc) + " D" + fb.detector : ""}`; }
  else if (op === "median") {
    const same = loaded.filter((f) => f.id !== a && f.detector === fa?.detector);
    const refIds = (same.length ? same : loaded.filter((f) => f.id !== a)).map((f) => f.id);
    tA = fa && urlFor(fa.id);
    tB = refIds.length ? stackURL(s, refIds) : null;
    lA = "A · selected frame";
    lB = `B · median of ${refIds.length} ${same.length ? `D${fa.detector} ` : ""}frames`;
  }
  else { tA = half ? stackURL(s, ids.slice(half)) : null; tB = half ? stackURL(s, ids.slice(0, half)) : null; lA = "Late half (stack)"; lB = "Early half (stack)"; }
  const tD = ids.length >= 2 ? diffURL(s, ids, op, op === "range" ? undefined : a, op === "pair" ? b : undefined) : null;
  const sameDet = op !== "pair" || (fa && fb && fa.detector === fb.detector);
  return (
    <section className="pn" aria-label="Difference imaging" data-tour="an-diff">
      <p className="h"><span className="hl">Difference imaging <Hint id="diff" /></span><span>{op === "range" ? "late − early" : "A − B"}</span></p>
      {loaded.length < 2 ? <div className="alert">Open the Viewer first so the frames can load ({loaded.length}/{sel.length} ready).</div> : <>
        <div className="tiles"><Tile label={lA} src={tA} /><Tile label={lB} src={tB} /><Tile label={op === "range" ? "Late − early" : "A − B"} src={tD} /></div>
        <div className="cb" role="img" aria-label="Diverging color scale from negative violet to positive orange" />
        <div style={{ display: "flex", justifyContent: "space-between" }} className="note"><span>− fainter / moved away</span><span>+ brighter / moved to</span></div>
        <div className="chips">
          {[["pair", "Pair"], ["median", "Median stack"], ["range", "Range"]].map(([k, l]) => <button key={k} className={`chip ${op === k ? "on" : ""}`} onClick={() => setOp(k)}>{l}</button>)}
        </div>
        {op !== "range" && <div className="row">
          <label className="fld">Frame A<select className="sel" value={a} onChange={(e) => setA(e.target.value)}>{loaded.map((f) => <option key={f.id} value={f.id}>{fmtUTC(f.utc)} · D{f.detector}</option>)}</select></label>
          {op === "pair" && <label className="fld">Frame B<select className="sel" value={b} onChange={(e) => setB(e.target.value)}>{loaded.filter((f) => f.id !== a).map((f) => <option key={f.id} value={f.id}>{fmtUTC(f.utc)} · D{f.detector}</option>)}</select></label>}
        </div>}
        {!sameDet && <p className="note" style={{ color: "#FFD9A8" }}>A and B come from different detectors (different wavelengths), so stars of different colours leave residuals. Pick B from the same detector for a clean difference.</p>}
        <p className="note">Frames are put on the same north-up grid, fluxes are matched, and B is subtracted from A. Range compares the median of the later half of the frames with the earlier half, detector by detector.</p>
      </>}
    </section>
  );
}

function CandidatesPanel() {
  const { cands, runCandidates, candSel, setCandSel, sel, go } = useAtlas();
  const list = cands.status === "ready" ? cands.data.candidates : [];
  const tag = (st) => (st === "known mover" ? "tag g" : st === "variable" ? "tag v" : "tag");
  return (
    <section className="pn" aria-label="Candidates" data-tour="an-candidates">
      <p className="h"><span className="hl">Candidates <Hint id="mover" /></span><span>{cands.status === "ready" ? `${list.length} found` : cands.status === "loading" ? "searching…" : ""}</span></p>
      <div className="tb hd"><span>#</span><span>RA</span><span>Dec</span><span>S/N</span><span>Motion</span><span>Status</span></div>
      {list.map((c, i) => (
        <button key={i} className="tb" onClick={() => { setCandSel(i); go("/"); }} style={i === candSel ? { background: "rgba(255,184,107,.06)" } : undefined}>
          <span className="mono">{c.n}</span><span className="mono">{c.ra.toFixed(4)}</span><span className="mono">{c.dec.toFixed(4)}</span>
          <span className="mono">{c.status === "variable" ? c.variability_sigma : c.shift_sigma}σ</span>
          <span className="mono">{c.motion_arcsec_yr != null ? `${c.motion_arcsec_yr}″/yr` : c.flux_ratio != null ? `×${c.flux_ratio}` : "—"}</span>
          <span className={tag(c.status)}>{c.status}</span>
        </button>
      ))}
      {cands.status === "ready" && !list.length && <p className="note">{cands.data.note || `Nothing above ${cands.data.threshold_sigma}σ among ${cands.data.n_sources} sources.`}</p>}
      {cands.status === "error" && <div className="alert err">{cands.error}</div>}
      {cands.status === "ready" && <p className="note mono" style={{ fontSize: 11 }}>{cands.data.n_frames} frames · {cands.data.early_utc?.slice(0, 10)} vs {cands.data.late_utc?.slice(0, 10)} (Δt {cands.data.dt_years} yr) · detectors {cands.data.detectors_compared?.join(", ")} · astrometric scatter {cands.data.astrometric_scatter_arcsec ?? "–"}″{cands.data.gaia_crossmatch ? " · Gaia cross-matched" : ""}</p>}
      <button className="ghost" onClick={runCandidates} disabled={cands.status === "loading" || sel.length < 4}>{cands.status === "loading" ? "Searching…" : "Run search again"}</button>
      <p className="note">Candidates are unconfirmed. Cross-check with Gaia and WISE before reporting. Click a row to show it in the viewer.</p>
    </section>
  );
}

async function recordVideo(urls, labels, fps) {
  const W = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = W;
  const ctx = canvas.getContext("2d");
  const imgs = await Promise.all(urls.map((u) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; })));
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const type = types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error("This browser cannot record video");
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 4e6 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((r) => { rec.onstop = r; });
  const draw = (i) => {
    ctx.fillStyle = "#060b16"; ctx.fillRect(0, 0, W, W);
    if (imgs[i]) ctx.drawImage(imgs[i], 0, 0, W, W);
    ctx.fillStyle = "rgba(6,9,18,.75)"; ctx.fillRect(8, 8, 300, 24);
    ctx.fillStyle = "#E8EEF8"; ctx.font = "13px 'JetBrains Mono', monospace"; ctx.fillText(labels[i], 14, 25);
    ctx.strokeStyle = "#5EEAD4"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(W / 2, W / 2, 20, 0, 7); ctx.stroke();
  };
  draw(0);
  rec.start();
  for (let loop = 0; loop < 2; loop++) {
    for (let i = 0; i < imgs.length; i++) { draw(i); await new Promise((r) => setTimeout(r, 1000 / fps)); }
  }
  rec.stop();
  await done;
  return { blob: new Blob(chunks, { type }), ext: type.startsWith("video/mp4") ? "mp4" : "webm" };
}

function ExportPanel() {
  const { s, sel, urlFor, imgState, phot, cands, flagged, notify } = useAtlas();
  const [rec, setRec] = useState(false);
  const loaded = sel.filter((f) => imgState[urlFor(f.id)] === "ok");
  const base = `openatlas_${s.ra.toFixed(3)}_${s.dec.toFixed(3)}`;
  const video = async () => {
    if (!loaded.length) return notify("Load frames in the Viewer first");
    setRec(true);
    try {
      const r = await recordVideo(loaded.map((f) => urlFor(f.id)), loaded.map((f) => `${fmtUTC(f.utc)}  D${f.detector}`), s.speed);
      download(`${base}.${r.ext}`, r.blob);
      if (r.ext !== "mp4") notify("Your browser records WebM; saved as .webm");
    } catch (e) { notify(e.message); }
    setRec(false);
  };
  const csv = () => {
    const lc = sel.map((f) => phot[f.id]).filter(Boolean).map((p) => ({ kind: "photometry", ...p, flags: (p.flags || []).join(" ") }));
    const cs = (cands.status === "ready" ? cands.data.candidates : []).map((c) => ({ kind: "candidate", ...c }));
    const fl = flagged.map((f) => ({ kind: `flagged ${f.type}`, ...f }));
    const rows = [...lc, ...cs, ...fl];
    if (!rows.length) return notify("Nothing measured yet");
    download(`${base}.csv`, toCSV(rows, ["kind", "id", "utc", "mjd", "detector", "wavelength_um", "flux_ujy", "err_ujy", "snr", "flags",
      "n", "status", "ra", "dec", "motion_arcsec_yr", "pa_deg", "shift_sigma", "flux_ratio", "variability_sigma", "gaia_source_id", "frame", "flagged_at"]));
  };
  const link = window.location.origin + "/" + shareQuery(s, true);
  const embed = `<iframe src="${link}" width="1280" height="900" style="border:0" title="OpenAtlas: ${s.name || "SPHEREx sky patch"}"></iframe>`;
  return (
    <section className="pn" aria-label="Export" data-tour="an-export">
      <p className="h">Export &amp; share</p>
      <div className="ex">
        <a className="ghost" href={loaded.length ? gifURL(s, loaded.map((f) => f.id), s.speed) : undefined} download onClick={() => loaded.length ? notify("Rendering GIF…") : notify("Load frames first")}>GIF</a>
        <button className="ghost" onClick={video} disabled={rec}>{rec ? "Recording…" : "MP4"}</button>
        <button className="ghost" onClick={csv}>CSV</button>
        <button className="ghost" onClick={async () => notify((await copyText(embed)) ? "Embed code copied" : "Copy failed")}>Copy embed</button>
      </div>
      <button className="solid" style={{ height: 44 }} onClick={async () => notify((await copyText(link)) ? "Share link copied" : link)}>Copy share link</button>
    </section>
  );
}

export default function AnalysisPage() {
  const { s, sel, phot, photBusy, loadLightCurve, loadSpectrum, specFrames, frames, cur } = useAtlas();
  const [det, setDet] = useState("all");
  const [norm, setNorm] = useState(false);
  useEffect(() => { if (frames.length) { loadLightCurve(); loadSpectrum(); } }, [frames.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const obj = TEST_OBJECTS.find((o) => o.name === s.name);
  const lcPts = sel.map((f) => phot[f.id]).filter(Boolean);
  const specPts = useMemo(() => Object.values(phot), [phot]);
  const lcDone = lcPts.length, specDone = specFrames.filter((f) => phot[f.id]).length;
  return (
    <main className="wrap">
      <div className="col">
        <section className="pn" aria-label="Light curve" data-tour="an-lightcurve">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div><p className="h"><span className="hl">Light curve <Hint id="lightcurve" /></span><span>{photBusy.lc ? `measuring ${lcDone}/${sel.length}` : `${lcPts.filter((p) => p.flux_ujy != null).length} points`}</span></p>
              <p className="t">{s.name || "Custom position"} {obj && <span className="note mono">· {obj.type.toLowerCase()}</span>}</p></div>
            <DetChips value={det} onChange={setDet} />
          </div>
          {lcPts.some((p) => p.flux_ujy != null) ? <LightCurve points={lcPts} det={det} current={cur?.id} />
            : <div className="alert">{photBusy.lc || !frames.length ? "Measuring aperture photometry on each frame (the first run downloads the cutouts from IRSA)…" : "No photometry yet."}</div>}
          <p className="note">Aperture photometry (12″ radius, local background) at the target on each exposure, grouped by detector because brightness depends on wavelength; each detector is normalised to its median.</p>
        </section>
        <section className="pn" aria-label="Spectrum" data-tour="an-spectrum">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div><p className="h"><span className="hl">Spectrum <Hint id="spectrum" /></span><span>102 bands · 0.75 to 5.0 µm</span></p><p className="t">Spectrum across six detector arrays</p></div>
            <div className="chips"><button className={`chip ${!norm ? "on" : ""}`} onClick={() => setNorm(false)}>Flux</button><button className={`chip ${norm ? "on" : ""}`} onClick={() => setNorm(true)}>Normalized</button></div>
          </div>
          {specPts.some((p) => p.flux_ujy != null) ? <Spectrum points={specPts} normalized={norm} />
            : <div className="alert">{photBusy.spec ? `Measuring ${specDone}/${specFrames.length} exposures across all six detectors…` : "No spectrum yet."}</div>}
          <p className="note">One point per exposure, at the exact wavelength SPHEREx's linear variable filter delivers at the target pixel. Detector ranges are shaded; dashed lines mark typical molecular features (water, CO₂, CO).{photBusy.spec ? ` Measuring ${specDone}/${specFrames.length}…` : ""}</p>
        </section>
      </div>
      <div className="col">
        <DiffPanel />
        <CandidatesPanel />
        <ExportPanel />
      </div>
    </main>
  );
}
