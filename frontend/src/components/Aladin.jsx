import React, { useEffect, useRef, useState } from "react";

// IRSA mirrors of the HiPS surveys (CDS's own servers are not always reachable).
export const HIPS = {
  spherex: { url: "https://irsa.ipac.caltech.edu/data/hips/SPHEREx/spherex_allsky_cube", name: "SPHEREx DR1 all-sky cube", fmt: "png" },
  allwise: { url: "https://irsa.ipac.caltech.edu/data/hips/CDS/AllWISE/RGB-W4-W2-W1", name: "AllWISE color (W4, W2, W1)", fmt: "jpeg" },
  twomass: { url: "https://irsa.ipac.caltech.edu/data/hips/CDS/2MASS/Color", name: "2MASS color (J, H, K)", fmt: "jpeg" },
  dss: { url: "https://irsa.ipac.caltech.edu/data/hips/CDS/DSS2/color", name: "DSS2 color", fmt: "jpeg" },
};

// SPHEREx HiPS cube channel centres (µm), from the survey's properties file.
// Channels 50 and 51 are the dichroic channels and are blank.
export const SPHEREX_SLICES = "0.753 0.771 0.790 0.809 0.828 0.848 0.868 0.889 0.910 0.932 0.955 0.978 1.001 1.025 1.050 1.075 1.102 1.113 1.139 1.167 1.195 1.224 1.254 1.284 1.315 1.346 1.378 1.412 1.446 1.481 1.517 1.554 1.592 1.631 1.656 1.695 1.735 1.775 1.818 1.861 1.905 1.949 1.995 2.041 2.089 2.139 2.189 2.240 2.292 2.345 2.399 2.445 2.506 2.575 2.646 2.719 2.794 2.871 2.951 3.033 3.118 3.204 3.293 3.383 3.476 3.570 3.667 3.768 3.833 3.867 3.901 3.935 3.970 4.005 4.040 4.076 4.112 4.148 4.184 4.220 4.257 4.294 4.331 4.368 4.405 4.435 4.467 4.500 4.533 4.566 4.600 4.635 4.669 4.704 4.739 4.773 4.808 4.843 4.879 4.915 4.951 4.988".split(" ").map(Number);
export const BLANK_SLICES = new Set([50, 51]);
export const nearestSlice = (um) => SPHEREX_SLICES.reduce((b, w, i) =>
  (!BLANK_SLICES.has(i) && Math.abs(w - um) < Math.abs(SPHEREX_SLICES[b] - um) ? i : b), 0);

let libPromise = null;
function loadAladin() {
  if (!libPromise) {
    libPromise = import("aladin-lite").then(async (m) => {
      const A = m.default;
      await A.init;
      return A;
    });
  }
  return libPromise;
}

/**
 * Props: ra, dec, fovDeg, survey (key of HIPS), slice (cube channel),
 * catalogs: [{name, color, shape, size, sources:[{ra,dec,label}]}],
 * shapes: [{type:"polygon"|"circle", points|ra,dec,r, color, width}],
 * interactive (bool)
 */
export default function Aladin({ ra, dec, fovDeg, survey = "dss", slice = null, catalogs = [], shapes = [],
                                 interactive = true, className = "aladin-host", label }) {
  const host = useRef(null);
  const st = useRef({ A: null, al: null, layer: null, cats: {}, gfx: null });
  const [err, setErr] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    loadAladin().then((A) => {
      if (dead || !host.current) return;
      const h0 = HIPS[survey] || HIPS.dss;
      const al = A.aladin(host.current, {
        fov: fovDeg, target: `${ra} ${dec}`, cooFrame: "ICRS", projection: "TAN",
        survey: h0.url, log: false,
        showReticle: false, showZoomControl: interactive, showLayersControl: false, showGotoControl: false,
        showFullscreenControl: false, showCooGridControl: false, showSimbadPointerControl: false,
        showProjectionControl: false, showFrame: false, showCooLocation: false, showFov: false,
        showContextMenu: false, showStatusBar: false, showSettingsControl: false, showShareControl: false,
        showCooGrid: false,
      });
      st.current = { A, al, layer: null, cats: {}, gfx: null };
      // Aladin adds decorative <img>s (logo, icons) without alt text: mark them decorative
      const fixAlt = () => host.current?.querySelectorAll("img:not([alt])").forEach((im) => im.setAttribute("alt", ""));
      fixAlt();
      new MutationObserver(fixAlt).observe(host.current, { childList: true, subtree: true });
      setReady(true);
    }).catch((e) => setErr(e?.message || String(e)));
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // view
  useEffect(() => {
    const { al } = st.current;
    if (!ready || !al) return;
    al.gotoRaDec(ra, dec);
    al.setFoV(fovDeg);
  }, [ready, ra, dec, fovDeg]);

  // survey layer
  useEffect(() => {
    const { A, al } = st.current;
    if (!ready || !al) return;
    const h = HIPS[survey] || HIPS.dss;
    const layer = A.imageHiPS(h.url, { name: h.name, imgFormat: h.fmt });
    al.setBaseImageLayer(layer);
    st.current.layer = layer;
  }, [ready, survey]);

  // cube channel: only takes effect once the layer has been added to the view
  useEffect(() => {
    if (!ready || slice === null || survey !== "spherex") return;
    let tries = 0, t = null;
    const apply = () => {
      const L = st.current.layer;
      if (L && L.added) { try { L.setSliceNumber(slice); } catch { /* ignore */ } return; }
      if (tries++ < 40) t = setTimeout(apply, 250);
    };
    apply();
    return () => clearTimeout(t);
  }, [ready, slice, survey]);

  // catalogues
  useEffect(() => {
    const { A, al, cats } = st.current;
    if (!ready || !al) return;
    const names = new Set(catalogs.map((c) => c.name));
    for (const [n, cat] of Object.entries(cats)) if (!names.has(n)) { cat.removeAll(); }
    for (const c of catalogs) {
      let cat = cats[c.name];
      if (!cat) {
        cat = A.catalog({ name: c.name, color: c.color, shape: c.shape || "square", sourceSize: c.size || 10 });
        al.addCatalog(cat);
        cats[c.name] = cat;
      }
      cat.removeAll();
      cat.addSources(c.sources.map((o) => A.source(o.ra, o.dec, { name: o.label || "" })));
    }
  }, [ready, catalogs]);

  // shapes
  useEffect(() => {
    const { A, al } = st.current;
    if (!ready || !al) return;
    if (!st.current.gfx) {
      st.current.gfx = A.graphicOverlay({ color: "#5EEAD4", lineWidth: 2 });
      al.addOverlay(st.current.gfx);
    }
    const g = st.current.gfx;
    g.removeAll();
    for (const sh of shapes) {
      const opt = { color: sh.color || "#5EEAD4", lineWidth: sh.width || 2 };
      if (sh.type === "circle") g.add(A.circle(sh.ra, sh.dec, sh.r, opt));
      else g.add(A.polygon(sh.points, opt));
    }
  }, [ready, shapes]);

  return (
    <div className={className} style={{ position: "relative", pointerEvents: interactive ? "auto" : "none" }} aria-label={label} role="img">
      <div ref={host} style={{ position: "absolute", inset: 0 }} />
      {!ready && !err && <div className="veil"><div><div className="spin" />Loading sky survey…</div></div>}
      {err && <div className="veil"><div><b>Sky viewer unavailable</b>{/webgl/i.test(err) ? "This browser does not support WebGL2." : err}</div></div>}
    </div>
  );
}
