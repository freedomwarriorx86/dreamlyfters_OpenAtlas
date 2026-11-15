import React, { useState } from "react";
import Aladin from "../components/Aladin";

// Images: NASA Image and Video Library (images-assets.nasa.gov) and the SPHEREx team site.
const ITEMS = [
  { cat: "First light", date: "1 Apr 2025", title: "First images from SPHEREx",
    text: "Some of the first exposures, captured on 27 March 2025. Every SPHEREx exposure contains six images, one per detector; colours were assigned to the infrared wavelengths.",
    img: "https://images-assets.nasa.gov/image/PIA26280/PIA26280~medium.jpg", alt: "Six panels of star fields from SPHEREx's first exposure",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26280", linkLabel: "PIA26280 ↗" },
  { cat: "First light", date: "1 Apr 2025", title: "First light animation",
    text: "The SPHEREx team's animated first-light sequence, cycling through the images taken by the six detectors.",
    img: "https://spherex.caltech.edu/system/avm_images/binaries/33/original/firstlight_movie.gif", alt: "Animated sequence of SPHEREx first-light images",
    credit: "NASA/JPL-Caltech", link: "https://spherex.caltech.edu/image/first-light-gif", linkLabel: "SPHEREx team ↗" },
  { cat: "First light", date: "1 May 2025", title: "A dust cloud revealed at 3.29 µm",
    text: "Weeks after launch, SPHEREx revealed a cloud of dust inside the Large Magellanic Cloud that only shows up at one specific infrared wavelength.",
    img: "https://images-assets.nasa.gov/image/PIA26352/PIA26352~medium.jpg", alt: "Two views of a region in the Large Magellanic Cloud at different infrared wavelengths",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26352", linkLabel: "PIA26352 ↗" },
  { cat: "All-sky map", date: "DR1 · Nov 2026", title: "The all-sky map in 102 colours — live",
    text: "SPHEREx's DR1 all-sky data cube, streamed live from IRSA. Drag to explore; the first all-sky map was released in December 2025 (PIA26600).",
    aladin: true, credit: "NASA/JPL-Caltech/IPAC", link: "https://www.jpl.nasa.gov/images/pia26600-spherexs-first-all-sky-map/", linkLabel: "JPL PIA26600 ↗" },
  { cat: "All-sky map", date: "2 Jul 2025", title: "Vela Molecular Ridge",
    text: "Part of the mission's first public data release. The yellow patch at right is RCW 36, a cloud of gas and dust glowing in infrared light from nearby stars.",
    img: "https://images-assets.nasa.gov/image/PIA26354/PIA26354~medium.jpg", alt: "Infrared view of the Vela Molecular Ridge",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26354", linkLabel: "PIA26354 ↗" },
  { cat: "Mission", date: "Mission", title: "How SPHEREx scans the sky",
    text: "The observatory sweeps across the sky in low Earth orbit, imaging every part of it 102 times through different colour filters to complete an all-sky map every six months.",
    img: "https://images-assets.nasa.gov/image/PIA26351/PIA26351~orig.jpg", alt: "SPHEREx field of view scanning across the Large Magellanic Cloud",
    credit: "NASA/JPL-Caltech", link: "https://images.nasa.gov/details/PIA26351", linkLabel: "PIA26351 ↗" },
  { cat: "Mission", date: "Mission", title: "SPHEREx in orbit",
    text: "Artist's concept of the spacecraft and its conical photon shields, which protect the telescope from the Sun's and Earth's heat. More images in the team gallery.",
    img: "https://images-assets.nasa.gov/image/PIA26531/PIA26531~orig.jpg", alt: "Artist's concept of the SPHEREx spacecraft above Earth",
    credit: "NASA/JPL-Caltech", link: "https://spherex.caltech.edu", linkLabel: "spherex.caltech.edu ↗" },
];
const CATS = ["All", "First light", "All-sky map", "Mission"];

function Ph({ it }) {
  const [err, setErr] = useState(false);
  if (it.aladin) return <div className="ph"><Aladin ra={266.4} dec={-28.9} fovDeg={120} survey="spherex" slice={84} label="SPHEREx DR1 all-sky map" /></div>;
  return (
    <div className="ph">
      {!err ? <img src={it.img} alt={it.alt} loading="lazy" onError={() => setErr(true)} />
        : <div className="veil"><div><b>Image unavailable</b><a href={it.link} target="_blank" rel="noreferrer">View on NASA's site</a></div></div>}
    </div>
  );
}

export default function GalleryPage() {
  const [cat, setCat] = useState("All");
  const items = ITEMS.filter((i) => cat === "All" || i.cat === cat);
  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div><p className="h">Gallery</p><h1 style={{ margin: "6px 0 0", fontSize: 30, letterSpacing: "-.02em" }}>Real images from NASA's SPHEREx</h1>
          <p className="note" style={{ marginTop: 6, maxWidth: 640 }}>Photos and maps taken by the mission, with credits and links to the original NASA pages.</p></div>
        <div className="chips">{CATS.map((c) => <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>)}</div>
      </div>
      <section className="gal" aria-label="NASA SPHEREx images">
        {items.map((it) => (
          <article className="card" key={it.title}>
            <Ph it={it} />
            <span className="dtl">{it.cat} · {it.date}</span>
            <h3>{it.title}</h3>
            <p>{it.text}</p>
            <div className="cred"><span>Credit: {it.credit}</span><a href={it.link} target="_blank" rel="noreferrer">{it.linkLabel}</a></div>
          </article>
        ))}
      </section>
      <section className="pn" aria-label="Image credits"><p className="h">Using NASA images</p>
        <p className="note">Credit every image as NASA/JPL-Caltech and link the original page. Follow NASA's and JPL's image use policy, do not imply NASA endorsement, and do not alter images in ways that mislead. Colors in SPHEREx images are assigned to infrared wavelengths so people can see them.</p></section>
    </main>
  );
}
