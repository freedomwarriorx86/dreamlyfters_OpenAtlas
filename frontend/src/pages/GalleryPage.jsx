import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronLeft, IconChevronRight, IconClose, IconExpand, IconExternal, IconReset, IconZoomIn, IconZoomOut } from "../components/Icons";
import Aladin, { BLANK_SLICES, SPHEREX_SLICES } from "../components/Aladin";
import { useStagger } from "../lib/motion";

// Images: NASA Image and Video Library (images-assets.nasa.gov) and the SPHEREx team site.
const N = (id, size) => `https://images-assets.nasa.gov/image/${id}/${id}~${size}.jpg`;
const ITEMS = [
  { cat: "First light", date: "1 Apr 2025", title: "First images from SPHEREx",
    text: "Some of the first exposures, captured on 27 March 2025. Every SPHEREx exposure contains six images, one per detector; colours were assigned to the infrared wavelengths.",
    img: N("PIA26280", "medium"), full: N("PIA26280", "orig"), alt: "Six panels of star fields from SPHEREx's first exposure",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26280", linkLabel: "PIA26280" },
  { cat: "First light", date: "1 Apr 2025", title: "First light animation",
    text: "The SPHEREx team's animated first-light sequence, cycling through the images taken by the six detectors.",
    img: "https://spherex.caltech.edu/system/avm_images/binaries/33/original/firstlight_movie.gif",
    full: "https://spherex.caltech.edu/system/avm_images/binaries/33/original/firstlight_movie.gif", alt: "Animated sequence of SPHEREx first-light images",
    credit: "NASA/JPL-Caltech", link: "https://spherex.caltech.edu/image/first-light-gif", linkLabel: "SPHEREx team" },
  { cat: "First light", date: "1 May 2025", title: "A dust cloud revealed at 3.29 µm",
    text: "Weeks after launch, SPHEREx revealed a cloud of dust inside the Large Magellanic Cloud that only shows up at one specific infrared wavelength.",
    img: N("PIA26352", "medium"), full: N("PIA26352", "orig"), alt: "Two views of a region in the Large Magellanic Cloud at different infrared wavelengths",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26352", linkLabel: "PIA26352" },
  { cat: "All-sky map", date: "DR1 · Nov 2026", title: "The all-sky map in 102 colours — live", aladin: true,
    text: "SPHEREx's DR1 all-sky data cube, streamed live from IRSA. Drag to explore or open it fullscreen; the first all-sky map was released in December 2025 (PIA26600).",
    credit: "NASA/JPL-Caltech/IPAC", link: "https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/", linkLabel: "JPL PIA26600" },
  { cat: "All-sky map", date: "2 Jul 2025", title: "Vela Molecular Ridge",
    text: "Part of the mission's first public data release. The yellow patch at right is RCW 36, a cloud of gas and dust glowing in infrared light from nearby stars.",
    img: N("PIA26354", "medium"), full: N("PIA26354", "orig"), alt: "Infrared view of the Vela Molecular Ridge",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26354", linkLabel: "PIA26354" },
  { cat: "Mission", date: "Mission", title: "How SPHEREx scans the sky",
    text: "The observatory sweeps across the sky in low Earth orbit, imaging every part of it 102 times through different colour filters to complete an all-sky map every six months.",
    img: N("PIA26351", "orig"), full: N("PIA26351", "orig"), alt: "SPHEREx field of view scanning across the Large Magellanic Cloud",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26351", linkLabel: "PIA26351" },
  { cat: "Mission", date: "Mission", title: "SPHEREx in orbit",
    text: "Artist's concept of the spacecraft and its conical photon shields, which protect the telescope from the Sun's and Earth's heat. More images in the team gallery.",
    img: N("PIA26531", "orig"), full: N("PIA26531", "orig"), alt: "Artist's concept of the SPHEREx spacecraft above Earth",
    credit: "NASA/JPL-Caltech", link: "https://spherex.caltech.edu", linkLabel: "spherex.caltech.edu" },
];
const CATS = ["All", "First light", "All-sky map", "Mission"];

function Ph({ it, onOpen }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (it.aladin) {
    return (
      <div className="ph" data-tour="ga-allsky">
        <Aladin ra={266.4} dec={-28.9} fovDeg={120} survey="spherex" slice={84} label="SPHEREx DR1 all-sky map" />
        <button className="ph-fs" onClick={onOpen} aria-label="Open the all-sky map fullscreen"><IconExpand size={14} /> Fullscreen</button>
      </div>
    );
  }
  return (
    <button className={`ph ph-btn ${loaded ? "" : "skel"}`} onClick={onOpen} aria-label={`Enlarge: ${it.title}`}>
      {!err ? <img src={it.img} alt={it.alt} loading="lazy" className={loaded ? "loaded" : ""} onLoad={() => setLoaded(true)} onError={() => { setErr(true); setLoaded(true); }} />
        : <div className="veil"><div><b>Image unavailable</b>Open the original page below</div></div>}
      <span className="ph-zoom" aria-hidden="true"><IconExpand size={16} /></span>
    </button>
  );
}

function AllSkyModal() {
  const [slice, setSlice] = useState(84);
  return (
    <div className="lb-sky">
      <Aladin ra={266.4} dec={-28.9} fovDeg={180} survey="spherex" slice={slice} label="SPHEREx DR1 all-sky map, fullscreen" className="aladin-host lb-aladin" />
      <div className="lb-slider">
        <div className="lb-slider-head">
          <label htmlFor="sky-ch">SPHEREx channel <span className="mono">{SPHEREX_SLICES[slice].toFixed(3)} µm</span>
            {BLANK_SLICES.has(slice) && <small> (blank dichroic channel)</small>}</label>
          <div className="chips" role="group" aria-label="Jump to a channel">
            {[[5, "0.85 µm"], [43, "2.04 µm"], [64, "3.38 µm"], [84, "4.37 µm"]].map(([v, l]) => <button key={v} className={`chip ${slice === v ? "on" : ""}`} onClick={() => setSlice(v)}>{l}</button>)}
          </div>
        </div>
        <input id="sky-ch" className="range" type="range" min="0" max={SPHEREX_SLICES.length - 1} value={slice} onChange={(e) => setSlice(+e.target.value)} />
      </div>
    </div>
  );
}

// Zoomable image: wheel zooms towards the cursor, double-click toggles 2.5x,
// drag pans when zoomed, two-finger pinch on touch screens, +/- buttons and keys.
const MIN_Z = 1, MAX_Z = 6;

function ZoomImage({ src, alt, zoomRef, onScale }) {
  const box = useRef(null);
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map());
  const pinch = useRef(null);
  const drag = useRef(null);

  // keep the image inside the frame: at scale s it may move at most (s-1)/2 of its size
  const clampXY = useCallback((s, x, y) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return { s, x, y };
    const mx = ((s - 1) * r.width) / 2, my = ((s - 1) * r.height) / 2;
    return { s, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  }, []);

  // zoom to scale `s` keeping the screen point (cx, cy) fixed
  const zoomAt = useCallback((s, cx, cy) => {
    setZ((o) => {
      const ns = Math.max(MIN_Z, Math.min(MAX_Z, s));
      const r = box.current.getBoundingClientRect();
      const px = cx - (r.left + r.width / 2), py = cy - (r.top + r.height / 2);
      const k = ns / o.s;
      return ns === 1 ? { s: 1, x: 0, y: 0 } : clampXY(ns, px - (px - o.x) * k, py - (py - o.y) * k);
    });
  }, [clampXY]);

  const centre = () => { const r = box.current.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  useEffect(() => {
    if (!zoomRef) return;
    zoomRef.current = {
      zoomIn: () => zoomAt(z.s * 1.5, ...centre()),
      zoomOut: () => zoomAt(z.s / 1.5, ...centre()),
      reset: () => setZ({ s: 1, x: 0, y: 0 }),
    };
  });
  useEffect(() => { onScale?.(z.s); }, [z.s, onScale]);

  useEffect(() => {
    const el = box.current;
    const onWheel = (e) => { e.preventDefault(); zoomAt(z.s * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [z.s, zoomAt]);

  const onPointerDown = (e) => {
    box.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: z.s };
      drag.current = null;
    } else if (z.s > 1) {
      drag.current = { x: e.clientX, y: e.clientY, ox: z.x, oy: z.y };
      setDragging(true);
    }
  };
  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      zoomAt(pinch.current.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.current.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    } else if (drag.current) {
      const d = drag.current;
      setZ((o) => clampXY(o.s, d.ox + e.clientX - d.x, d.oy + e.clientY - d.y));
    }
  };
  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (!pointers.current.size) { drag.current = null; setDragging(false); }
  };

  return (
    <div ref={box} className={`zoom-box ${z.s > 1 ? "zoomed" : ""} ${dragging ? "dragging" : ""}`}
      onDoubleClick={(e) => zoomAt(z.s > 1 ? 1 : 2.5, e.clientX, e.clientY)}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <img src={src} alt={alt} draggable="false"
        style={{ transform: `translate(${z.x}px, ${z.y}px) scale(${z.s})`, transition: dragging || pinch.current ? "none" : undefined }} />
    </div>
  );
}

function Lightbox({ items, index, dir, onClose, onMove }) {
  const it = items[index];
  const zoom = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
      if (e.key === "+" || e.key === "=") zoom.current?.zoomIn();
      if (e.key === "-") zoom.current?.zoomOut();
      if (e.key === "0") zoom.current?.reset();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose, onMove]);
  useEffect(() => { setScale(1); }, [index]);
  return createPortal(
    <div className="lb" role="dialog" aria-modal="true" aria-label={it.title} onClick={onClose}>
      <div className="lb-inner" onClick={(e) => e.stopPropagation()}>
        {/* keyed by index so every change replays the slide animation in the right direction */}
        <div key={index} className={`lb-media lb-slide-${dir > 0 ? "next" : "prev"}`}>
          {it.aladin ? <AllSkyModal /> : <ZoomImage src={it.full || it.img} alt={it.alt} zoomRef={zoom} onScale={setScale} />}
        </div>
        <div key={`c${index}`} className="lb-cap lb-cap-anim">
          <div><span className="dtl">{it.cat} · {it.date}</span><h3>{it.title}</h3><p>{it.text}</p></div>
          <div className="cred"><span>Credit: {it.credit}</span><a href={it.link} target="_blank" rel="noreferrer" className="ext">{it.linkLabel} <IconExternal size={12} /></a></div>
        </div>
      </div>
      {!it.aladin && (
        <div className="lb-zoom" onClick={(e) => e.stopPropagation()} role="group" aria-label="Zoom">
          <button onClick={() => zoom.current?.zoomOut()} aria-label="Zoom out (-)" disabled={scale <= 1.001}><IconZoomOut size={18} /></button>
          <span className="mono">{Math.round(scale * 100)}%</span>
          <button onClick={() => zoom.current?.zoomIn()} aria-label="Zoom in (+)" disabled={scale >= MAX_Z - 0.01}><IconZoomIn size={18} /></button>
          <button onClick={() => zoom.current?.reset()} aria-label="Reset zoom (0)" disabled={scale <= 1.001}><IconReset size={16} /></button>
        </div>
      )}
      <button className="lb-btn lb-close" onClick={onClose} aria-label="Close (Esc)"><IconClose size={20} /></button>
      {items.length > 1 && <>
        <button className="lb-btn lb-prev" onClick={(e) => { e.stopPropagation(); onMove(-1); }} aria-label="Previous image"><IconChevronLeft size={24} /></button>
        <button className="lb-btn lb-next" onClick={(e) => { e.stopPropagation(); onMove(1); }} aria-label="Next image"><IconChevronRight size={24} /></button>
      </>}
      <span className="lb-count mono">{index + 1} / {items.length}{!it.aladin && <span className="lb-hint"> · scroll or double-click to zoom, drag to move</span>}</span>
    </div>,
    document.body,
  );
}

export default function GalleryPage() {
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState(null);
  const [dir, setDir] = useState(1);
  const items = ITEMS.filter((i) => cat === "All" || i.cat === cat);
  const ref = useStagger([cat]);
  const move = useCallback((d) => { setDir(d); setOpen((o) => (o === null ? o : (o + d + items.length) % items.length)); }, [items.length]);
  const close = useCallback(() => setOpen(null), []);
  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div><p className="h">Gallery</p><h1 style={{ margin: "6px 0 0", fontSize: "clamp(26px, 3vw, 36px)", letterSpacing: "-.02em" }}>Real images from <span className="grad">NASA's SPHEREx</span></h1>
          <p className="note" style={{ marginTop: 6, maxWidth: 640 }}>Photos and maps taken by the mission, with credits and links to the original NASA pages. Click any image to see it full size.</p></div>
        <div className="chips" data-tour="ga-filters">{CATS.map((c) => <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}</div>
      </div>
      <section className="gal" aria-label="NASA SPHEREx images" ref={ref}>
        {items.map((it, i) => (
          <article className="card" key={it.title} data-tour={i === 0 ? "ga-card" : undefined} data-reveal>
            <Ph it={it} onOpen={() => setOpen(i)} />
            <span className="dtl">{it.cat} · {it.date}</span>
            <h3>{it.title}</h3>
            <p>{it.text}</p>
            <div className="cred"><span>Credit: {it.credit}</span><a href={it.link} target="_blank" rel="noreferrer" className="ext">{it.linkLabel} <IconExternal size={12} /></a></div>
          </article>
        ))}
      </section>
      <section className="pn" aria-label="Image credits"><p className="h">Using NASA images</p>
        <p className="note">Credit every image as NASA/JPL-Caltech and link the original page. Follow NASA's and JPL's image use policy, do not imply NASA endorsement, and do not alter images in ways that mislead. Colors in SPHEREx images are assigned to infrared wavelengths so people can see them.</p></section>
      {open !== null && items[open] && <Lightbox items={items} index={open} dir={dir} onClose={close} onMove={move} />}
    </main>
  );
}
