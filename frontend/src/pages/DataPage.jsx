import React, { useEffect, useMemo, useState } from "react";
import { TEST_OBJECTS, useAtlas } from "../store";
import { api } from "../lib/api";
import { unproject } from "../lib/astro";
import Aladin, { BLANK_SLICES, SPHEREX_SLICES } from "../components/Aladin";
import Hint from "../components/Hint";

function SkyContext() {
  const { s, frames, sel } = useAtlas();
  const [layer, setLayer] = useState("spherex");
  const [slice, setSlice] = useState(84);          // ≈ 4.5 µm, where cool brown dwarfs are brightest
  const [gaiaWide, setGaiaWide] = useState(null);
  const ctxFov = Math.min(3, Math.max(0.4, (s.fov / 60) * 10));
  useEffect(() => {
    if (layer !== "gaia") return;
    api.gaia({ ra: s.ra, dec: s.dec, fov: 15 }).then(setGaiaWide).catch(() => setGaiaWide({ stars: [], error: "unavailable" }));
  }, [layer, s.ra, s.dec]);
  const fovBox = useMemo(() => {
    const c = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => unproject(x, y, s.ra, s.dec, s.fov));
    return { type: "polygon", points: c.map((p) => [p.ra, p.dec]), color: "#5EEAD4", width: 2 };
  }, [s.ra, s.dec, s.fov]);
  const footprints = useMemo(() => (layer === "spherex"
    ? sel.slice(0, 12).filter((f) => f.region?.length >= 3).map((f) => ({ type: "polygon", points: f.region, color: "rgba(255,184,107,0.55)", width: 1 }))
    : []), [layer, sel]);
  const shapes = useMemo(() => [...footprints, fovBox], [footprints, fovBox]);
  const catalogs = useMemo(() => (layer === "gaia" && gaiaWide?.stars?.length
    ? [{ name: "Gaia DR3", color: "#A78BFA", shape: "circle", size: 8, sources: gaiaWide.stars.map((g) => ({ ra: g.ra, dec: g.dec, label: `G=${g.g_mag}` })) }]
    : [{ name: "Gaia DR3", color: "#A78BFA", sources: [] }]), [layer, gaiaWide]);
  const survey = layer === "spherex" ? "spherex" : layer === "wise" ? "allwise" : "dss";
  return (
    <section className="pn" aria-label="Sky context" data-tour="da-sky">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div><p className="h">Sky context</p><p className="t">Where your patch sits on the sky</p></div>
        <div className="chips">
          {[["spherex", "SPHEREx"], ["wise", "WISE"], ["gaia", "Gaia"]].map(([k, l]) => <button key={k} className={`chip ${layer === k ? "on" : ""}`} onClick={() => setLayer(k)}>{l}</button>)}
        </div>
      </div>
      <div className="map"><Aladin ra={s.ra} dec={s.dec} fovDeg={ctxFov} survey={survey} slice={layer === "spherex" ? slice : null} shapes={shapes} catalogs={catalogs} label="Interactive sky map around the target" /></div>
      {layer === "spherex" && <label className="fld">SPHEREx channel · <span className="mono" style={{ color: "var(--ac)" }}>{SPHEREX_SLICES[slice].toFixed(3)} µm{BLANK_SLICES.has(slice) ? " (dichroic channel — blank)" : ""}</span>
        <input className="range" type="range" min="0" max={SPHEREX_SLICES.length - 1} value={slice} onChange={(e) => setSlice(+e.target.value)} aria-label="SPHEREx wavelength channel" /></label>}
      <p className="note">
        {layer === "spherex" && `SPHEREx DR1 all-sky data cube (IRSA HiPS), one of 102 wavelength channels. Orange outlines: footprints of the first ${footprints.length} blinked exposures (${frames.length} cover this position).`}
        {layer === "wise" && "AllWISE colour composite (W1 3.4 µm, W2 4.6 µm, W4 22 µm), observed around 2010."}
        {layer === "gaia" && `DSS2 optical background with Gaia DR3 stars (epoch 2016)${gaiaWide?.error ? " — catalogue service unavailable" : gaiaWide ? `: ${gaiaWide.count} brightest within 15′` : ""}.`}
        {" "}Teal box: your {s.fov}′ field of view. Drag to pan, scroll to zoom. Sky viewer: Aladin Lite (CDS).
      </p>
    </section>
  );
}

function TestObjects() {
  const { openObject, go } = useAtlas();
  return (
    <section className="pn" aria-label="Test objects" data-tour="da-tests">
      <p className="h">Test objects <span>{TEST_OBJECTS.length} targets</span></p>
      <div className="ob hd"><span>Object</span><span>Type</span><span>What to look for</span><span /></div>
      {TEST_OBJECTS.map((o) => (
        <div className="ob" key={o.key}><b>{o.name}</b><span className="note">{o.type}</span><span className="note">{o.look}</span>
          <button className="ghost" style={{ height: 34 }} onClick={() => { openObject(o); go("/"); }}>Open</button></div>
      ))}
      <p className="note">WISE 0855 position given by the challenge: RA 08h55m10.831s, Dec −07d14m42.53s. The others are resolved by name through SIMBAD and moved to epoch 2026.0 with their proper motions.</p>
    </section>
  );
}

function Releases() {
  const { s, set, meta } = useAtlas();
  const [rel, setRel] = useState(null);
  useEffect(() => { api.releases().then((r) => setRel(r.releases)).catch(() => setRel([])); }, []);
  return (
    <section className="pn" aria-label="Data releases" data-tour="da-releases">
      <p className="h"><span className="hl">Data release <Hint id="release" /></span><span>auto-updates</span></p>
      {(rel || []).map((r) => (
        <button key={r.id} className={`rel ${s.collection === r.id ? "on" : ""}`} aria-pressed={s.collection === r.id} onClick={() => set({ collection: r.id })}>
          <i className="rd" /><div><b>{r.label}</b><span>{r.description}</span></div>
        </button>
      ))}
      {!rel && <p className="note">Loading releases…</p>}
      <p className="note">
        {meta.status === "ready" ? `${meta.count} exposures in this release cover your target${meta.latest ? `, the latest from ${meta.latest.slice(0, 10)}` : ""}. ` : ""}
        New exposures are found by querying the archive, so new releases appear without changing the app.
      </p>
    </section>
  );
}

function QualityFlags() {
  const { s, set } = useAtlas();
  const [fl, setFl] = useState(null);
  useEffect(() => { api.flags().then(setFl).catch(() => setFl({ classes: [] })); }, []);
  return (
    <section className="pn" aria-label="Quality flags" data-tour="da-flags">
      <p className="h"><span className="hl">Quality flags <Hint id="flags" /></span><span>per pixel</span></p>
      {(fl?.classes || []).map((c) => (
        <div className="swatch" key={c.key}><i style={{ background: c.color }} />
          <div>{c.label}<small>{c.detail} · {c.bits.map((b) => fl.bits[b]).join(", ")}</small></div></div>
      ))}
      <div className="chips">
        <button className={`chip ${s.showFlags ? "on" : ""}`} aria-pressed={s.showFlags} onClick={() => set({ showFlags: !s.showFlags })}>Show flag map</button>
        <button className={`chip ${s.maskFlags ? "on" : ""}`} aria-pressed={s.maskFlags} onClick={() => set({ maskFlags: !s.maskFlags })}>Mask flagged pixels</button>
      </div>
      <p className="note">Flags come from the FLAGS plane of each SPHEREx Level 2 image. The overlay colours the first three groups; masking removes them from the image before display and from stacks and differences.</p>
    </section>
  );
}

export default function DataPage() {
  return (
    <main className="wrap">
      <h1 className="sr">Data, test objects and quality flags</h1>
      <div className="col">
        <SkyContext />
        <TestObjects />
      </div>
      <div className="col">
        <Releases />
        <QualityFlags />
        <section className="pn" aria-label="How to spot a mover">
          <p className="h">How to spot a mover</p>
          <div className="stp"><b>1</b><span>Blink the frames and watch the patch like a short video.</span></div>
          <div className="stp"><b>2</b><span>Stars stay fixed. A dot that shifts between frames may be a comet, asteroid, brown dwarf or nearby star.</span></div>
          <div className="stp"><b>3</b><span>Confirm with Stack and Difference, then flag it and share the link.</span></div>
          <p className="note">This is how Pluto was found: one point of light had shifted between two images. Citizen-science projects such as Backyard Worlds work the same way.</p>
        </section>
        <section className="pn" aria-label="Credits">
          <p className="h">Data &amp; credits</p>
          <div className="cr">
            <a href="https://spherex.caltech.edu" target="_blank" rel="noreferrer">NASA SPHEREx</a>
            <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noreferrer">NASA/IPAC IRSA</a>
            <a href="https://www.astropy.org" target="_blank" rel="noreferrer">Astropy</a>
            <a href="https://aladin.cds.unistra.fr/AladinLite/" target="_blank" rel="noreferrer">Aladin (CDS)</a>
            <a href="https://www.cosmos.esa.int/web/gaia/dr3" target="_blank" rel="noreferrer">Gaia</a>
            <a href="https://wise2.ipac.caltech.edu/docs/release/allwise/" target="_blank" rel="noreferrer">WISE</a>
            <a href="https://simbad.cds.unistra.fr" target="_blank" rel="noreferrer">SIMBAD</a>
          </div>
          <p className="note">SPHEREx data: DOI 10.26131/IRSA629 and 10.26131/IRSA652. This research has made use of the NASA/IPAC Infrared Science Archive, operated by the Jet Propulsion Laboratory, California Institute of Technology, under contract with NASA.</p>
        </section>
      </div>
    </main>
  );
}
