import React, { useCallback, useEffect, useState } from "react";
import Aladin, { BLANK_SLICES, SPHEREX_SLICES } from "../components/Aladin";
import { useStagger } from "../lib/motion";

// Images: NASA Image and Video Library (images-assets.nasa.gov) and the SPHEREx team site.
const N = (id, size) => `https://images-assets.nasa.gov/image/${id}/${id}~${size}.jpg`;
const ITEMS = [
  { cat: "First light", date: "1 Apr 2025", title: "First images from SPHEREx",
    text: "Some of the first exposures, captured on 27 March 2025. Every SPHEREx exposure contains six images, one per detector; colours were assigned to the infrared wavelengths.",
    img: N("PIA26280", "medium"), full: N("PIA26280", "orig"), alt: "Six panels of star fields from SPHEREx's first exposure",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26280", linkLabel: "PIA26280 ↗" },
  { cat: "First light", date: "1 Apr 2025", title: "First light animation",
    text: "The SPHEREx team's animated first-light sequence, cycling through the images taken by the six detectors.",
    img: "https://spherex.caltech.edu/system/avm_images/binaries/33/original/firstlight_movie.gif",
    full: "https://spherex.caltech.edu/system/avm_images/binaries/33/original/firstlight_movie.gif", alt: "Animated sequence of SPHEREx first-light images",
    credit: "NASA/JPL-Caltech", link: "https://spherex.caltech.edu/image/first-light-gif", linkLabel: "SPHEREx team ↗" },
  { cat: "First light", date: "1 May 2025", title: "A dust cloud revealed at 3.29 µm",
    text: "Weeks after launch, SPHEREx revealed a cloud of dust inside the Large Magellanic Cloud that only shows up at one specific infrared wavelength.",
    img: N("PIA26352", "medium"), full: N("PIA26352", "orig"), alt: "Two views of a region in the Large Magellanic Cloud at different infrared wavelengths",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26352", linkLabel: "PIA26352 ↗" },
  { cat: "All-sky map", date: "DR1 · Nov 2026", title: "The all-sky map in 102 colours — live", aladin: true,
    text: "SPHEREx's DR1 all-sky data cube, streamed live from IRSA. Drag to explore or open it fullscreen; the first all-sky map was released in December 2025 (PIA26600).",
    credit: "NASA/JPL-Caltech/IPAC", link: "https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/", linkLabel: "JPL PIA26600 ↗" },
  { cat: "All-sky map", date: "2 Jul 2025", title: "Vela Molecular Ridge",
    text: "Part of the mission's first public data release. The yellow patch at right is RCW 36, a cloud of gas and dust glowing in infrared light from nearby stars.",
    img: N("PIA26354", "medium"), full: N("PIA26354", "orig"), alt: "Infrared view of the Vela Molecular Ridge",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26354", linkLabel: "PIA26354 ↗" },
  { cat: "Mission", date: "Mission", title: "How SPHEREx scans the sky",
    text: "The observatory sweeps across the sky in low Earth orbit, imaging every part of it 102 times through different colour filters to complete an all-sky map every six months.",
    img: N("PIA26351", "orig"), full: N("PIA26351", "orig"), alt: "SPHEREx field of view scanning across the Large Magellanic Cloud",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26351", linkLabel: "PIA26351 ↗" },
  { cat: "Mission", date: "Mission", title: "SPHEREx in orbit",
    text: "Artist's concept of the spacecraft and its conical photon shields, which protect the telescope from the Sun's and Earth's heat. More images in the team gallery.",
    img: N("PIA26531", "orig"), full: N("PIA26531", "orig"), alt: "Artist's concept of the SPHEREx spacecraft above Earth",
    credit: "NASA/JPL-Caltech", link: "https://spherex.caltech.edu", linkLabel: "spherex.caltech.edu ↗" },
];
const CATS = ["All", "First light", "All-sky map", "Mission"];

function Ph({ it, onOpen }) {
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (it.aladin) {
    return (
      <div className="ph" data-tour="ga-allsky">
        <Aladin ra={266.4} dec={-28.9} fovDeg={120} survey="spherex" slice={84} label="SPHEREx DR1 all-sky map" />
        <button className="ph-fs" onClick={onOpen} aria-label="Open the all-sky map fullscreen">⤢ Fullscreen</button>
      </div>
    );
  }
  return (
    <button className={`ph ph-btn ${loaded ? "" : "skel"}`} onClick={onOpen} aria-label={`Enlarge: ${it.title}`}>
      {!err ? <img src={it.img} alt={it.alt} loading="lazy" className={loaded ? "loaded" : ""} onLoad={() => setLoaded(true)} onError={() => { setErr(true); setLoaded(true); }} />
        : <div className="veil"><div><b>Image unavailable</b>Open the original page below</div></div>}
      <span className="ph-zoom" aria-hidden="true">⤢</span>
    </button>
  );
}

function AllSkyModal() {
  const [slice, setSlice] = useState(84);
  return (
    <div className="lb-sky">
      <Aladin ra={266.4} dec={-28.9} fovDeg={180} survey="spherex" slice={slice} label="SPHEREx DR1 all-sky map, fullscreen" className="aladin-host lb-aladin" />
      <label className="fld lb-slider">SPHEREx channel · <span className="mono" style={{ color: "var(--ac)" }}>{SPHEREX_SLICES[slice].toFixed(3)} µm{BLANK_SLICES.has(slice) ? " (blank dichroic channel)" : ""}</span>
        <input className="range" type="range" min="0" max={SPHEREX_SLICES.length - 1} value={slice} onChange={(e) => setSlice(+e.target.value)} />
        <div className="chips">{[[5, "0.85 µm"], [43, "2.04 µm"], [64, "3.38 µm"], [84, "4.37 µm"]].map(([v, l]) => <button key={v} className={`chip ${slice === v ? "on" : ""}`} onClick={() => setSlice(v)}>{l}</button>)}</div>
      </label>
    </div>
  );
}

function Lightbox({ items, index, onClose, onMove }) {
  const it = items[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose, onMove]);
  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label={it.title} onClick={onClose}>
      <div className="lb-inner" onClick={(e) => e.stopPropagation()}>
        <div className="lb-media">
          {it.aladin ? <AllSkyModal /> : <img src={it.full || it.img} alt={it.alt} />}
        </div>
        <div className="lb-cap">
          <div><span className="dtl">{it.cat} · {it.date}</span><h3>{it.title}</h3><p>{it.text}</p></div>
          <div className="cred"><span>Credit: {it.credit}</span><a href={it.link} target="_blank" rel="noreferrer">{it.linkLabel}</a></div>
        </div>
      </div>
      <button className="lb-btn lb-close" onClick={onClose} aria-label="Close (Esc)">✕</button>
      {items.length > 1 && <>
        <button className="lb-btn lb-prev" onClick={(e) => { e.stopPropagation(); onMove(-1); }} aria-label="Previous image">‹</button>
        <button className="lb-btn lb-next" onClick={(e) => { e.stopPropagation(); onMove(1); }} aria-label="Next image">›</button>
      </>}
      <span className="lb-count mono">{index + 1} / {items.length}</span>
    </div>
  );
}

export default function GalleryPage() {
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState(null);
  const items = ITEMS.filter((i) => cat === "All" || i.cat === cat);
  const ref = useStagger([cat]);
  const move = useCallback((d) => setOpen((o) => (o === null ? o : (o + d + items.length) % items.length)), [items.length]);
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
            <div className="cred"><span>Credit: {it.credit}</span><a href={it.link} target="_blank" rel="noreferrer">{it.linkLabel}</a></div>
          </article>
        ))}
      </section>
      <section className="pn" aria-label="Image credits"><p className="h">Using NASA images</p>
        <p className="note">Credit every image as NASA/JPL-Caltech and link the original page. Follow NASA's and JPL's image use policy, do not imply NASA endorsement, and do not alter images in ways that mislead. Colors in SPHEREx images are assigned to infrared wavelengths so people can see them.</p></section>
      {open !== null && items[open] && <Lightbox items={items} index={open} onClose={close} onMove={move} />}
    </main>
  );
}
