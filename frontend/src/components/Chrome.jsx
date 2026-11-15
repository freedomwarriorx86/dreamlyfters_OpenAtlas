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
        <button className="ghost" onClick={() => { go("/"); setTimeout(() => setTour(true), 50); }}>Guided tour</button>
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

const STEPS = [
  { key: "search", title: "Pick a target", text: "Type an object name (resolved through SIMBAD, with proper motion applied) or coordinates. The five test objects from the challenge are one click away on the left." },
  { key: "controls", title: "Load a sky patch", text: "Set RA/Dec and the field of view. OpenAtlas asks IRSA for every SPHEREx exposure that covers the position — usually hundreds, from all six detectors." },
  { key: "view", title: "Blink the frames", text: "Frames are aligned on a common north-up grid and played like a short video. Stars stay fixed; anything that shifts between frames is interesting." },
  { key: "playbar", title: "Step through time", text: "Play, pause and step with Space and the arrow keys. Stack averages frames to dig out faint sources; Diff (key D) subtracts the median so changes stand out." },
  { key: "details", title: "Check candidates", text: "OpenAtlas measures every bright source's position early vs. late and flags movers and variables. Cross-check with Gaia, then flag it (F) and share the link." },
  { key: "nav", title: "Go deeper", text: "Analysis has the light curve, spectrum and difference imaging; Data lets you switch release, inspect quality flags and see your patch on the whole sky." },
];

export function Tour() {
  const { tour, setTour } = useAtlas();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  useEffect(() => { if (tour) setI(0); }, [tour]);
  useLayoutEffect(() => {
    if (!tour) return;
    const upd = () => {
      const el = document.querySelector(`[data-tour="${STEPS[i].key}"]`);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "nearest" });
      setRect(el.getBoundingClientRect());
    };
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, [tour, i]);
  useEffect(() => {
    if (!tour) return;
    const onKey = (e) => { if (e.key === "Escape") setTour(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, setTour]);
  if (!tour) return null;
  const st = STEPS[i];
  const vw = window.innerWidth, vh = window.innerHeight;
  let bx = 16, by = 16;
  if (rect) {
    bx = Math.min(vw - 336, Math.max(16, rect.right + 16 + 320 < vw ? rect.right + 16 : rect.left - 336));
    if (bx < 16 || (bx > rect.left - 20 && bx < rect.right)) { bx = Math.max(16, Math.min(vw - 336, rect.left)); by = Math.min(vh - 200, rect.bottom + 12); }
    else by = Math.max(16, Math.min(vh - 220, rect.top));
  }
  return (
    <>
      <div className="tour-dim" onClick={() => setTour(false)} />
      {rect && <div className="tour-ring" style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <div className="tour-box" style={{ left: bx, top: by }} role="dialog" aria-label="Guided tour">
        <span className="h">Step {i + 1} of {STEPS.length}</span>
        <h4>{st.title}</h4>
        <p>{st.text}</p>
        <div className="act">
          <button className="ghost" style={{ height: 34 }} onClick={() => setTour(false)}>Close</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ghost" style={{ height: 34 }} disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
            {i < STEPS.length - 1
              ? <button className="solid" style={{ height: 34 }} onClick={() => setI(i + 1)}>Next</button>
              : <button className="solid" style={{ height: 34 }} onClick={() => setTour(false)}>Done</button>}
          </div>
        </div>
      </div>
    </>
  );
}
