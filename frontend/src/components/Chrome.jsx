import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ROUTES, TEST_OBJECTS, shareQuery, useAtlas } from "../store";
import { api, copyText } from "../lib/api";
import { parseCoordPair } from "../lib/astro";

export const Logo = () => (
  <svg width="30" height="30" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <circle cx="14" cy="14" r="12" stroke="#5EEAD4" strokeWidth="2" />
    <ellipse cx="14" cy="14" rx="12" ry="5" stroke="#5EEAD4" strokeWidth="1.5" transform="rotate(-25 14 14)" />
    <circle cx="20" cy="10" r="2.5" fill="#FFB86B" />
  </svg>
);

function Search() {
  const { loadTarget, openObject, go, route, notify, s } = useAtlas();
  const [q, setQ] = useState(s.name || "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  useEffect(() => { setQ(s.name || `${s.ra.toFixed(4)}, ${s.dec.toFixed(4)}`); }, [s.name, s.ra, s.dec]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName)) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const sugg = TEST_OBJECTS.filter((o) => !q || o.name.toLowerCase().includes(q.toLowerCase())).slice(0, 5);

  const submit = async (text) => {
    const t = text.trim();
    if (!t) return;
    setOpen(false);
    const preset = TEST_OBJECTS.find((o) => o.name.toLowerCase() === t.toLowerCase());
    if (route !== "/" && route !== "/analysis") go("/");
    if (preset) return openObject(preset);
    const c = parseCoordPair(t);
    if (c) return loadTarget({ name: "", ...c });
    setBusy(true);
    try {
      const r = await api.resolve(t);
      loadTarget({ name: t, ra: r.ra, dec: r.dec });
      if (r.pmra_masyr != null) notify(`${t}: position moved to epoch ${r.epoch} using its proper motion`);
    } catch (e) {
      notify(e.message.replace(/^Could not resolve/, "Unknown object"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="search" data-tour="search" onSubmit={(e) => { e.preventDefault(); submit(open && sugg[hi] && q !== sugg[hi].name ? sugg[hi].name : q); }} role="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#97A6C2" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <label htmlFor="q" className="sr">Object name or coordinates</label>
      <input id="q" ref={ref} value={q} placeholder="Object name or RA, Dec" autoComplete="off"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, sugg.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          if (e.key === "Escape") setOpen(false);
        }} />
      {busy ? <span className="spin" style={{ width: 16, height: 16, margin: 0, borderWidth: 2 }} /> : <kbd>/</kbd>}
      {open && sugg.length > 0 && (
        <div className="sugg" role="listbox">
          {sugg.map((o, i) => (
            <button type="button" key={o.key} className={i === hi ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); setQ(o.name); submit(o.name); }}>
              <span>{o.name}</span><small>{o.type}</small>
            </button>
          ))}
          <div className="note" style={{ padding: "6px 10px" }}>Or type any name (SIMBAD) or coordinates, e.g. <span className="mono">133.795, -7.245</span></div>
        </div>
      )}
    </form>
  );
}

export function Header() {
  const { route, go, meta, s, setTour, notify } = useAtlas();
  const busy = meta.status === "loading";
  const share = async () => {
    const url = window.location.origin + window.location.pathname + shareQuery(s, true);
    notify((await copyText(url)) ? "Link to this view copied" : url);
  };
  return (
    <header className="top">
      <a className="logo" href="/" onClick={(e) => { e.preventDefault(); go("/"); }}><Logo />OpenAtlas<small>SPHEREx</small></a>
      <nav className="nav" aria-label="Sections" data-tour="nav">
        {ROUTES.map((r) => (
          <a key={r.path} href={r.path} className={route === r.path ? "on" : ""} aria-current={route === r.path ? "page" : undefined}
            onClick={(e) => { e.preventDefault(); go(r.path); }}>{r.label}</a>
        ))}
      </nav>
      <Search />
      <div className="tr2">
        <div className="badge" title={meta.error || ""}>
          <span className={`dot ${busy ? "busy" : meta.status === "error" ? "err" : meta.demo || meta.source === "cache" ? "warn" : ""}`} />
          IRSA · <span className="mono">{s.collection === "spherex_dr1" ? "DR1" : s.collection === "spherex_qr2" ? "QR2" : "QR1"}</span> ·
          {busy ? " querying…" : meta.latest ? ` latest ${meta.latest.slice(0, 10)}` : meta.demo ? " demo data" : " —"}
        </div>
        <button className="ghost" onClick={() => setTour(true)} data-tour="tourbtn">Guided tour</button>
        <button className="solid" onClick={share}>Share view</button>
      </div>
    </header>
  );
}

export function Footer() {
  const { meta, sel, loadedCount, loadSeconds, frames } = useAtlas();
  const label = meta.status === "loading" ? "Querying IRSA…" : meta.status === "error" ? "Query failed"
    : meta.demo ? "Demo data (IRSA unreachable)" : meta.source === "cache" ? "Cached results (IRSA unreachable)" : meta.status === "ready" ? "Query ready" : "Idle";
  return (
    <footer className="stat">
      <span><span className={`dot ${meta.status === "loading" ? "busy" : meta.status === "error" ? "err" : meta.demo ? "warn" : ""}`} style={{ marginRight: 6 }} />{label}</span>
      <span className="mono">{frames.length} exposures · {loadedCount}/{sel.length} frames loaded{loadSeconds ? ` · ${loadSeconds.toFixed(1)} s` : ""}</span>
      <span>Data: <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noreferrer">NASA/IPAC Infrared Science Archive</a> · SPHEREx</span>
      <span style={{ marginLeft: "auto" }}>OpenAtlas · team dreamlyfters · NASA Space Apps 2026 Niğde</span>
    </footer>
  );
}

export function Toast() {
  const { toast } = useAtlas();
  return toast ? <div className="toast" role="status">{toast}</div> : null;
}

// Guided tours, one per page. `key` matches a data-tour attribute; missing ones are skipped.
const TOURS = {
  "/": [
    { key: "search", title: "1 · Pick something to look at", text: "Type an object's name (for example “Barnard's Star”) or two numbers for a position (RA, Dec). OpenAtlas finds it and, for nearby stars, moves it to where it is today." },
    { key: "target", title: "2 · Or enter a position", text: "RA and Dec are the sky's longitude and latitude. Switch between degrees and hours/minutes/seconds, then press “Load sky patch”. Every “?” on the page explains its word in plain language." },
    { key: "fov", title: "3 · Zoom", text: "Field of view = how wide a piece of sky you see. Smaller is more zoomed in. 6′ (arcminutes) is a good start; the full Moon would be 30′." },
    { key: "mode", title: "4 · Three ways to look", text: "Blink plays the frames like a flip-book. Stack averages them for a deeper image. Diff subtracts them, so only what changed is left." },
    { key: "detector", title: "5 · Colours (detectors)", text: "SPHEREx has six camera chips, each seeing different infrared colours. “All” mixes them; choose one (D1–D6) for the cleanest comparison over time. The small number is how many exposures there are." },
    { key: "nframes", title: "6 · How many frames", text: "OpenAtlas picks this many exposures, evenly spread in time. More frames = smoother blink, but a longer first download from NASA." },
    { key: "stretch", title: "7 · Contrast", text: "Linear shows brightness as it is. Asinh and Log lift faint things so you can see them next to bright stars." },
    { key: "overlays", title: "8 · Compare with other surveys", text: "Gaia (violet squares) and WISE (blue circles) show where other telescopes saw stars. Flags colour pixels the pipeline does not trust." },
    { key: "tests", title: "9 · Try a test object", text: "Five objects from the challenge, one click each. WISE 0855 is a cold brown dwarf, Barnard's Star the fastest-moving star, RW Aur and R Dra change brightness." },
    { key: "view", title: "10 · The sky image", text: "All frames are lined up on the same grid: north is up, east is left. The teal cross marks your target. Hover to read the position and brightness under the cursor." },
    { key: "playbar", title: "11 · Play through time", text: "Play/pause (Space), step frame by frame (← →), change the speed and toggle looping. Use Fullscreen for a big view with a slide-out control panel." },
    { key: "film", title: "12 · Every frame at a glance", text: "Thumbnails of the frames around the current one, and below them a timeline of every exposure: teal ticks are the ones being blinked. Click to jump." },
    { key: "tabs", title: "13 · More views", text: "Light curve = brightness over time, Spectrum = brightness per colour, Compare = the same spot in older surveys (2MASS 1999, WISE 2010)." },
    { key: "frame-details", title: "14 · About this frame", text: "When it was taken, which detector, the exact infrared colour and how bright your target is in it — plus any quality warnings." },
    { key: "candidates", title: "15 · What moved?", text: "OpenAtlas measures every bright source early vs. late. Movers and variables appear here and on the image. They are only candidates: check them, flag the good ones (F) and share the link." },
  ],
  "/analysis": [
    { key: "an-lightcurve", title: "Light curve", text: "Brightness of your target in every exposure, grouped by detector. A flat line = steady; ups and downs = variable. Hollow diamonds mean the star is so bright it saturates — that brightness is an estimate." },
    { key: "an-spectrum", title: "Spectrum", text: "Brightness at each infrared colour, built from many exposures. Dips at the dashed lines can mean water ice, CO₂ or CO." },
    { key: "an-diff", title: "Difference imaging", text: "Pick two frames (A and B) and see A minus B. Orange = brighter in A, violet = brighter in B. Use frames from the same detector for a clean result." },
    { key: "an-candidates", title: "Candidates table", text: "Everything that moved or changed, with how confident the measurement is (σ) and how fast it moves. Click a row to show it in the viewer." },
    { key: "an-export", title: "Export and share", text: "Download a GIF or video of the blink, a CSV of all measurements, or copy a link that opens exactly this view." },
  ],
  "/data": [
    { key: "da-sky", title: "Where is your patch?", text: "An interactive map of the sky around your target. Switch between SPHEREx (with a slider through its 102 colours), WISE and Gaia. The teal box is your field of view." },
    { key: "da-tests", title: "Test objects", text: "The five targets from the challenge with what to look for in each. “Open” takes you straight to the viewer." },
    { key: "da-releases", title: "Data release", text: "Choose which batch of SPHEREx data to use. DR1 is the newest, uniformly processed set." },
    { key: "da-flags", title: "Quality flags", text: "What the coloured flag map means, and a switch to hide untrusted pixels everywhere in the app." },
  ],
  "/learn": [
    { key: "learn-demos", title: "Four ideas, hands-on", text: "Play with blink, stack, difference and stretch on a toy sky before using them on real data." },
    { key: "learn-try", title: "Try it for real", text: "Jump straight into the viewer with a test object." },
    { key: "learn-glossary", title: "Glossary", text: "Every word used in OpenAtlas, explained simply with an example. The “?” buttons in the app link here." },
  ],
  "/gallery": [
    { key: "ga-filters", title: "Filter", text: "Show first-light images, all-sky maps or mission pictures." },
    { key: "ga-card", title: "Click to enlarge", text: "Click any image to see it full size. Use ← → to move between images and Esc to close." },
    { key: "ga-allsky", title: "The live all-sky map", text: "This one is not a picture: it streams SPHEREx's real all-sky map. Drag to explore, or open it fullscreen." },
  ],
  "/about": [
    { key: "ab-team", title: "Who we are", text: "Team dreamlyfters, NASA Space Apps Challenge 2026 in Niğde." },
    { key: "ab-pipeline", title: "How it works", text: "Six steps from a sky position to a list of moving objects — all with real NASA data." },
    { key: "ab-facts", title: "Good to know", text: "Limits and tips: what SPHEREx can and cannot see, and how to read the results." },
  ],
};

export function Tour() {
  const { tour, setTour, route } = useAtlas();
  const steps = (TOURS[route] || []).filter((st) => document.querySelector(`[data-tour="${st.key}"]`));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  useEffect(() => { if (tour) setI(0); }, [tour, route]);
  useLayoutEffect(() => {
    if (!tour || !steps[i]) return;
    const upd = () => {
      const el = document.querySelector(`[data-tour="${steps[i].key}"]`);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => setRect(el.getBoundingClientRect()), 260);
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, i, route]);
  useEffect(() => {
    if (!tour) return;
    const onKey = (e) => {
      if (e.key === "Escape") setTour(false);
      if (e.key === "ArrowRight" && i < steps.length - 1) setI(i + 1);
      if (e.key === "ArrowLeft" && i > 0) setI(i - 1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [tour, setTour, i, steps.length]);
  if (!tour) return null;
  if (!steps.length) { setTimeout(() => setTour(false)); return null; }
  const st = steps[Math.min(i, steps.length - 1)];
  const vw = window.innerWidth, vh = window.innerHeight, W = Math.min(340, vw - 32);
  let bx = (vw - W) / 2, by = vh / 2 - 100;
  if (rect) {
    const right = rect.right + 16, left = rect.left - W - 16;
    if (right + W < vw) { bx = right; by = rect.top; }
    else if (left > 0) { bx = left; by = rect.top; }
    else { bx = Math.max(16, Math.min(vw - W - 16, rect.left)); by = rect.bottom + 12 > vh - 220 ? rect.top - 230 : rect.bottom + 12; }
    by = Math.max(16, Math.min(vh - 240, by));
  }
  return (
    <>
      <div className="tour-dim" onClick={() => setTour(false)} />
      {rect && <div className="tour-ring" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <div className="tour-box" style={{ left: bx, top: by, width: W }} role="dialog" aria-label="Guided tour" aria-live="polite">
        <div className="tour-prog" aria-hidden="true">{steps.map((_, k) => <i key={k} className={k <= i ? "on" : ""} />)}</div>
        <span className="h">Tour · {ROUTES.find((r) => r.path === route)?.label} · {i + 1} of {steps.length}</span>
        <h4>{st.title}</h4>
        <p>{st.text}</p>
        <div className="act">
          <button className="ghost" style={{ height: 34 }} onClick={() => setTour(false)}>Close</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ghost" style={{ height: 34 }} disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
            {i < steps.length - 1
              ? <button className="solid" style={{ height: 34 }} onClick={() => setI(i + 1)}>Next</button>
              : <button className="solid" style={{ height: 34 }} onClick={() => setTour(false)}>Done</button>}
          </div>
        </div>
        <p className="note" style={{ fontSize: 11 }}>Tip: every page has its own tour, and ← → work here too.</p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Opening sequence: shown once per browser session, skippable.
export function Intro() {
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem("oa.intro"); } catch { return true; }
  });
  const [leaving, setLeaving] = useState(false);
  const canvas = useRef(null);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const done = () => {
    if (leaving) return;
    setLeaving(true);
    try { sessionStorage.setItem("oa.intro", "1"); } catch { /* storage unavailable */ }
    setTimeout(() => setShow(false), 700);
  };
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(done, reduced ? 900 : 3400);
    const onKey = (e) => { if (["Escape", "Enter", " "].includes(e.key)) done(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);
  // star "warp": stars rush outwards from the centre, slowing to a stop
  useEffect(() => {
    if (!show || reduced || !canvas.current) return;
    const c = canvas.current, ctx = c.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
    resize();
    const stars = Array.from({ length: 520 }, () => ({ a: Math.random() * Math.PI * 2, d: Math.random() ** 1.8, z: 0.2 + Math.random() * 0.8 }));
    const t0 = performance.now();
    let raf;
    const frame = (now) => {
      const t = (now - t0) / 1000;
      const speed = Math.max(0.02, 1.6 * Math.exp(-t * 1.25));
      const W = c.width, H = c.height, cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
      ctx.fillStyle = "rgba(4,6,14,0.35)";
      ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        const r0 = s.d * R, r1 = r0 + speed * 60 * dpr * s.z * (0.3 + s.d * 2);
        s.d += speed * 0.006 * s.z * (0.3 + s.d * 2);
        if (s.d > 1.1) { s.d = Math.random() * 0.05; s.a = Math.random() * Math.PI * 2; }
        ctx.strokeStyle = `rgba(${s.z > 0.75 ? "167,139,250" : s.z > 0.5 ? "125,211,252" : "232,238,248"},${0.35 + s.z * 0.6})`;
        ctx.lineWidth = s.z * 1.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(s.a) * r0, cy + Math.sin(s.a) * r0);
        ctx.lineTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1);
        ctx.stroke();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [show, reduced]);
  if (!show) return null;
  return (
    <div className={`intro ${leaving ? "out" : ""} ${reduced ? "reduced" : ""}`} onClick={done} role="dialog" aria-label="OpenAtlas intro">
      <canvas ref={canvas} aria-hidden="true" />
      <div className="intro-mark">
        <svg width="120" height="120" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle className="i-ring" cx="14" cy="14" r="12" stroke="#5EEAD4" strokeWidth="1.6" />
          <ellipse className="i-orbit" cx="14" cy="14" rx="12" ry="5" stroke="#5EEAD4" strokeWidth="1.2" transform="rotate(-25 14 14)" />
          <circle className="i-planet" cx="20" cy="10" r="2.4" fill="#FFB86B" />
        </svg>
        <h1>OpenAtlas</h1>
        <p>Watch the infrared sky change.</p>
      </div>
      <button className="intro-skip" onClick={(e) => { e.stopPropagation(); done(); }}>Skip intro</button>
    </div>
  );
}
