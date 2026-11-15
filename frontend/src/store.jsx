import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, chunk, frameURL, pool } from "./lib/api";
import { spectrumPick, spreadPick } from "./lib/astro";

// ---------------------------------------------------------------------------
// Test objects from the challenge brief
// ---------------------------------------------------------------------------
export const TEST_OBJECTS = [
  { key: "wise0855", name: "WISE 0855", fixed: { ra: 133.79513, dec: -7.24515 }, type: "Fast-moving brown dwarf",
    look: "Clear motion across frames; faint, so try stacking", icon: "●", color: "#FFB86B", fov: 6 },
  { key: "barnard", name: "Barnard's Star", resolve: "Barnard's Star", fallback: { ra: 269.446269, dec: 4.768204 },
    type: "Nearby star, high proper motion", look: "Slow steady drift against fixed background stars", icon: "★", color: "#5EEAD4", fov: 6 },
  { key: "epsindib", name: "Epsilon Indi B", resolve: "eps Ind B", fallback: { ra: 331.0446, dec: -56.7838 },
    type: "Brown dwarf pair near a star", look: "Faint companions beside a bright host; check flags", icon: "◐", color: "#A78BFA", fov: 8 },
  { key: "rwaur", name: "RW Aurigae", resolve: "RW Aur", fallback: { ra: 76.9564, dec: 30.4014 },
    type: "Variable star", look: "Brightness changes between exposures; open light curve", icon: "✦", color: "#7DD3FC", fov: 6 },
  { key: "rdra", name: "R Draconis", resolve: "R Dra", fallback: { ra: 248.1675, dec: 66.7533 },
    type: "Variable star", look: "Brightness changes between exposures; open light curve", icon: "✦", color: "#7DD3FC", fov: 6 },
];

export const ROUTES = [
  { path: "/", label: "Viewer" },
  { path: "/analysis", label: "Analysis" },
  { path: "/data", label: "Data" },
  { path: "/learn", label: "Learn" },
  { path: "/gallery", label: "Gallery" },
  { path: "/about", label: "About" },
];

const DEFAULTS = {
  name: "WISE 0855", ra: 133.79513, dec: -7.24515, fov: 6, collection: "spherex_dr1",
  mode: "blink", det: "all", stretch: "asinh", n: 24, gaia: true, wise: false,
  showFlags: false, maskFlags: false, grid: true, speed: 2, loop: true,
};

function readURL() {
  const p = new URLSearchParams(window.location.search);
  const num = (k, lo, hi) => {
    const v = parseFloat(p.get(k));
    return isFinite(v) && v >= lo && v <= hi ? v : undefined;
  };
  const bool = (k) => (p.has(k) ? p.get(k) === "1" || p.get(k) === "true" : undefined);
  const s = {
    ra: num("ra", 0, 360), dec: num("dec", -90, 90), fov: num("fov", 0.5, 15),
    name: p.get("name") || undefined, collection: p.get("coll") || undefined,
    mode: ["blink", "stack", "diff"].includes(p.get("mode")) ? p.get("mode") : undefined,
    det: p.get("det") && /^(all|[1-6])$/.test(p.get("det")) ? (p.get("det") === "all" ? "all" : +p.get("det")) : undefined,
    stretch: ["linear", "asinh", "log"].includes(p.get("stretch")) ? p.get("stretch") : undefined,
    n: [12, 24, 48].includes(+p.get("n")) ? +p.get("n") : undefined,
    gaia: bool("gaia"), wise: bool("wise"), showFlags: bool("flags"), maskFlags: bool("mask"), grid: bool("grid"),
  };
  const out = { ...DEFAULTS };
  for (const [k, v] of Object.entries(s)) if (v !== undefined) out[k] = v;
  if (s.ra !== undefined && s.dec !== undefined && !s.name) out.name = "";
  return out;
}

export function shareQuery(s, full = false) {
  const p = new URLSearchParams();
  p.set("ra", s.ra.toFixed(5));
  p.set("dec", s.dec.toFixed(5));
  p.set("fov", String(+s.fov.toFixed(2)));
  p.set("mode", s.mode);
  if (full) {
    if (s.name) p.set("name", s.name);
    if (s.det !== "all") p.set("det", s.det);
    if (s.stretch !== DEFAULTS.stretch) p.set("stretch", s.stretch);
    if (s.collection !== DEFAULTS.collection) p.set("coll", s.collection);
    if (s.n !== DEFAULTS.n) p.set("n", s.n);
    for (const [k, q] of [["gaia", "gaia"], ["wise", "wise"], ["showFlags", "flags"], ["maskFlags", "mask"], ["grid", "grid"]])
      if (s[k] !== DEFAULTS[k]) p.set(q, s[k] ? "1" : "0");
  }
  return "?" + p.toString();
}

const Ctx = createContext(null);
export const useAtlas = () => useContext(Ctx);

export function AtlasProvider({ children }) {
  const [route, setRoute] = useState(() => (ROUTES.some((r) => r.path === window.location.pathname) ? window.location.pathname : "/"));
  const [s, setS] = useState(readURL);
  const set = useCallback((patch) => setS((o) => ({ ...o, ...(typeof patch === "function" ? patch(o) : patch) })), []);

  const [frames, setFrames] = useState([]);
  const [meta, setMeta] = useState({ status: "idle" });
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [toast, setToast] = useState(null);
  const [tour, setTour] = useState(false);
  const [imgState, setImgState] = useState({});      // url -> "loading" | "ok" | "err"
  const [phot, setPhot] = useState({});              // id -> photometry point
  const [photBusy, setPhotBusy] = useState({ lc: false, spec: false });
  const [cands, setCands] = useState({ status: "idle" });
  const [candSel, setCandSel] = useState(0);
  const [cats, setCats] = useState({ gaia: null, wise: null });
  const [flagged, setFlagged] = useState(() => {
    try { return JSON.parse(localStorage.getItem("openatlas.flagged") || "[]"); } catch { return []; }
  });
  const imgGen = useRef(0);
  const imgStateRef = useRef({});
  imgStateRef.current = imgState;
  const loadT0 = useRef(0);

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(notify.t);
    notify.t = setTimeout(() => setToast(null), 2600);
  }, []);

  // ---- routing --------------------------------------------------------------
  const go = useCallback((path) => {
    window.history.pushState({}, "", path + window.location.search);
    setRoute(path);
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const onPop = () => {
      setRoute(ROUTES.some((r) => r.path === window.location.pathname) ? window.location.pathname : "/");
      setS(readURL());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // keep the URL in sync with the view (replace, so history is not flooded)
  useEffect(() => {
    window.history.replaceState({}, "", window.location.pathname + shareQuery(s, true));
  }, [s]);

  // ---- target ---------------------------------------------------------------
  const loadTarget = useCallback((t) => {
    setPlaying(false);
    set({ name: t.name ?? "", ra: +(+t.ra).toFixed(6), dec: +(+t.dec).toFixed(6), ...(t.fov ? { fov: t.fov } : {}) });
  }, [set]);

  const openObject = useCallback(async (obj) => {
    if (obj.fixed) return loadTarget({ name: obj.name, ...obj.fixed, fov: obj.fov });
    try {
      const r = await api.resolve(obj.resolve);
      loadTarget({ name: obj.name, ra: r.ra, dec: r.dec, fov: obj.fov });
    } catch {
      loadTarget({ name: obj.name, ...obj.fallback, fov: obj.fov });
      notify(`Name service unavailable — using catalogue position for ${obj.name}`);
    }
  }, [loadTarget, notify]);

  // ---- frames for the target ------------------------------------------------
  useEffect(() => {
    const ac = new AbortController();
    setMeta({ status: "loading" });
    setFrames([]);
    setIdx(0);
    setPhot({});
    setCands({ status: "idle" });
    imgGen.current++;
    loadT0.current = performance.now();
    api.frames(s.ra, s.dec, s.collection, { signal: ac.signal })
      .then((r) => {
        setFrames(r.frames);
        setMeta({ status: "ready", source: r.source, demo: r.demo_mode, error: r.error, message: r.message,
                  first: r.first_utc, latest: r.latest_utc, seconds: r.seconds, count: r.count });
      })
      .catch((e) => { if (e.name !== "AbortError") setMeta({ status: "error", error: e.message }); });
    return () => ac.abort();
  }, [s.ra, s.dec, s.collection]);

  // ---- selection --------------------------------------------------------------
  const pool_ = useMemo(() => (s.det === "all" ? frames : frames.filter((f) => f.detector === s.det)), [frames, s.det]);
  const sel = useMemo(() => spreadPick(pool_, s.n), [pool_, s.n]);
  const selKey = sel.map((f) => f.id).join(",");
  const cur = sel[Math.min(idx, Math.max(0, sel.length - 1))] || null;
  useEffect(() => { setIdx((i) => Math.min(i, Math.max(0, sel.length - 1))); }, [sel.length]);
  useEffect(() => { setCands({ status: "idle" }); }, [selKey, s.fov]);

  // ---- image preloading (blink frames) ---------------------------------------
  const urlFor = useCallback((id, extra) => frameURL(s, id, extra), [s]);
  useEffect(() => {
    if (!sel.length) return;
    const order = [...sel.slice(idx), ...sel.slice(0, idx)];
    // everything not yet loaded is (re)queued under a new generation; older queues stop
    const urls = order.map((f) => urlFor(f.id)).filter((u) => imgStateRef.current[u] !== "ok");
    if (!urls.length) return;
    setImgState((o) => { const n = { ...o }; urls.forEach((u) => { n[u] = "loading"; }); return n; });
    const gen = ++imgGen.current;
    pool(urls, 4, (u) => new Promise((res) => {
      if (imgGen.current !== gen) return res();       // view changed: drop queued loads
      const im = new Image();
      let attempt = 0;
      // finished loads are kept even after the view changes: the browser cache makes them reusable
      im.onload = () => { setImgState((o) => ({ ...o, [u]: "ok" })); res(); };
      im.onerror = () => {
        // IRSA sometimes refuses a cutout for a moment (our API answers 502): try again later
        if (attempt < 2 && imgGen.current === gen) {
          attempt += 1;
          setTimeout(() => { im.src = ""; im.src = u; }, 5000 * attempt);
          return;
        }
        setImgState((o) => ({ ...o, [u]: "err" }));
        res();
      };
      im.src = u;
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selKey, s.fov, s.stretch, s.showFlags, s.maskFlags, s.collection]);

  const loadedCount = sel.filter((f) => imgState[urlFor(f.id)] === "ok").length;
  const failedCount = sel.filter((f) => imgState[urlFor(f.id)] === "err").length;
  const allLoaded = sel.length > 0 && loadedCount + failedCount === sel.length;
  const [loadSeconds, setLoadSeconds] = useState(null);
  useEffect(() => { if (allLoaded) setLoadSeconds((performance.now() - loadT0.current) / 1000); }, [allLoaded]);
  useEffect(() => { loadT0.current = performance.now(); setLoadSeconds(null); }, [selKey, s.fov, s.stretch]);

  // ---- playback ---------------------------------------------------------------
  const step = useCallback((d) => {
    setIdx((i) => {
      if (!sel.length) return 0;
      for (let k = 1; k <= sel.length; k++) {
        const j = (i + d * k + sel.length * 4) % sel.length;
        if (imgState[urlFor(sel[j].id)] === "ok" || s.mode === "diff") return j;
      }
      return i;
    });
  }, [sel, imgState, urlFor, s.mode]);

  useEffect(() => {
    if (!playing || sel.length < 2 || s.mode === "stack") return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (!s.loop && i >= sel.length - 1) { setPlaying(false); return i; }
        for (let k = 1; k <= sel.length; k++) {
          const j = (i + k) % sel.length;
          if (imgState[urlFor(sel[j].id)] === "ok" || s.mode === "diff") return j;
        }
        return i;
      });
    }, 1000 / s.speed);
    return () => clearInterval(t);
  }, [playing, sel, s.speed, s.loop, s.mode, imgState, urlFor]);

  // start blinking automatically once a few frames are in
  const autoStarted = useRef("");
  useEffect(() => {
    if (loadedCount >= Math.min(3, sel.length) && sel.length > 1 && autoStarted.current !== selKey) {
      autoStarted.current = selKey;
      setPlaying(true);
    }
  }, [loadedCount, sel.length, selKey]);

  // ---- photometry -------------------------------------------------------------
  const fetchPhot = useCallback(async (ids, key) => {
    const todo = ids.filter((id) => !phot[id]);
    if (!todo.length) return;
    if (key) setPhotBusy((b) => ({ ...b, [key]: true }));
    await pool(chunk(todo, 4), 2, async (part) => {
      const r = await api.photometry(s, part);
      setPhot((o) => { const n = { ...o }; r.points.forEach((p) => { n[p.id] = p; }); return n; });
    });
    if (key) setPhotBusy((b) => ({ ...b, [key]: false }));
  }, [phot, s]);

  const loadLightCurve = useCallback(() => fetchPhot(sel.map((f) => f.id), "lc"), [fetchPhot, sel]);
  const specFrames = useMemo(() => spectrumPick(frames, 4), [frames]);
  const loadSpectrum = useCallback(() => fetchPhot(specFrames.map((f) => f.id), "spec"), [fetchPhot, specFrames]);

  // details panel: photometry of the current frame once its image is in
  const curOK = cur && imgState[urlFor(cur.id)] === "ok";
  useEffect(() => { if (curOK && !phot[cur.id]) fetchPhot([cur.id]); }, [curOK, cur, phot, fetchPhot]);

  // ---- candidates -------------------------------------------------------------
  const runCandidates = useCallback(async () => {
    if (sel.length < 4) { setCands({ status: "error", error: "Select at least 4 frames." }); return; }
    setCands({ status: "loading" });
    try {
      const r = await api.candidates(s, sel.map((f) => f.id));
      setCands({ status: "ready", data: r });
      setCandSel(0);
    } catch (e) {
      setCands({ status: "error", error: e.message });
    }
  }, [s, sel]);
  useEffect(() => {
    if (allLoaded && loadedCount >= 4 && cands.status === "idle") runCandidates();
  }, [allLoaded, loadedCount, cands.status, runCandidates]);

  // ---- catalogue overlays -------------------------------------------------------
  useEffect(() => {
    let live = true;
    if (s.gaia) api.gaia(s).then((r) => live && setCats((c) => ({ ...c, gaia: r }))).catch(() => live && setCats((c) => ({ ...c, gaia: { stars: [], error: "unavailable" } })));
    if (s.wise) api.wise(s).then((r) => live && setCats((c) => ({ ...c, wise: r }))).catch(() => live && setCats((c) => ({ ...c, wise: { sources: [], error: "unavailable" } })));
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.ra, s.dec, s.fov, s.gaia, s.wise]);

  // ---- flags (user bookmarks) --------------------------------------------------
  const addFlag = useCallback((item) => {
    setFlagged((o) => {
      const n = [...o, { ...item, flagged_at: new Date().toISOString() }];
      try { localStorage.setItem("openatlas.flagged", JSON.stringify(n)); } catch { /* storage unavailable */ }
      return n;
    });
  }, []);

  const value = {
    s, set, route, go, frames, meta, sel, pool: pool_, cur, idx, setIdx, step, playing, setPlaying,
    imgState, urlFor, loadedCount, failedCount, allLoaded, loadSeconds,
    phot, photBusy, loadLightCurve, loadSpectrum, specFrames, fetchPhot,
    cands, runCandidates, candSel, setCandSel, cats, flagged, addFlag,
    loadTarget, openObject, toast, notify, tour, setTour,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
