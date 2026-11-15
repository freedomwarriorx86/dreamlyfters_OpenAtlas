import React, { useState } from "react";
import { useAtlas } from "../store";
import { Logo } from "../components/Chrome";
import { CountUp, useStagger } from "../lib/motion";

// Drop the team logo into frontend/public/team-logo.png (or .svg and change the path).
const TEAM_LOGO = "/team-logo.png";

function TeamLogo() {
  const [ok, setOk] = useState(true);
  return ok
    ? <img className="team-logo" src={TEAM_LOGO} alt="dreamlyfters team logo" onError={() => setOk(false)} />
    : <div className="team-logo team-mono" aria-label="dreamlyfters"><span>dl</span></div>;
}

const STATS = [
  { to: 102, l: "infrared colours", s: "0.75 – 5 µm" },
  { to: 6, l: "detectors", s: "D1 – D6" },
  { to: 250, prefix: "~", l: "exposures per spot", s: "2025 – 2026, DR1" },
  { to: 6.2, decimals: 1, suffix: "″", l: "per pixel", s: "about 1/300 of the Moon" },
];

const PIPELINE = [
  { icon: "🔭", t: "Find", d: "Ask NASA's IRSA archive for every SPHEREx exposure that covers your position." },
  { icon: "✂️", t: "Cut out", d: "Download only a small patch around the target from each exposure, then cache it." },
  { icon: "🧭", t: "Line up", d: "Put every frame on the same north-up grid using its exact sky coordinates." },
  { icon: "🎞️", t: "Blink · Stack · Diff", d: "Play the frames in time order, average them, or subtract them to show changes." },
  { icon: "📈", t: "Measure", d: "Brightness in every frame gives a light curve; across colours it gives a spectrum." },
  { icon: "🎯", t: "Find movers", d: "Compare early and late positions of every source and cross-check with Gaia." },
];

const FACTS = [
  { icon: "⏳", t: "First look takes a minute", d: "A new position is downloaded from NASA once; after that it is cached and instant." },
  { icon: "🐢", t: "Only fast movers stand out", d: "With ~1 year of data and 6″ pixels, things must move several arcseconds a year to show." },
  { icon: "☀️", t: "Bright stars saturate", d: "Their brightness is estimated from the outer glow — fine for changes, not exact values." },
  { icon: "🧪", t: "Candidates, not discoveries", d: "Always check a candidate in blink, stack and against Gaia/WISE before reporting it." },
  { icon: "🛰️", t: "Honest about outages", d: "If NASA's archive is down, OpenAtlas says so and clearly labels any demo data." },
  { icon: "🔗", t: "Every view is a link", d: "The address bar holds position, zoom and settings — share it and others see the same." },
];

const CREDITS = [
  ["NASA SPHEREx", "https://spherex.caltech.edu"], ["NASA/IPAC IRSA", "https://irsa.ipac.caltech.edu/Missions/spherex.html"],
  ["Gaia DR3 (ESA)", "https://www.cosmos.esa.int/web/gaia/dr3"], ["AllWISE", "https://wise2.ipac.caltech.edu/docs/release/allwise/"],
  ["SIMBAD / Sesame (CDS)", "https://simbad.cds.unistra.fr"], ["Aladin Lite (CDS)", "https://aladin.cds.unistra.fr/AladinLite/"],
  ["Astropy", "https://www.astropy.org"], ["NumPy · SciPy", "https://scipy.org"], ["FastAPI", "https://fastapi.tiangolo.com"], ["React", "https://react.dev"],
];

export default function AboutPage() {
  const { go } = useAtlas();
  const ref = useStagger();
  return (
    <main className="page about" ref={ref}>
      <section className="about-hero" data-tour="ab-team" data-reveal>
        <TeamLogo />
        <div>
          <p className="h">About · team dreamlyfters</p>
          <h1><Logo /> <span className="grad">OpenAtlas</span></h1>
          <p className="lead">See the infrared sky change. Watch every NASA SPHEREx exposure of any spot on the sky, blink them like a flip-book and find what moves.</p>
          <div className="chips">
            <span className="chip on">NASA Space Apps Challenge 2026</span>
            <span className="chip">Niğde, Türkiye</span>
            <span className="chip">Challenge: “Planet X and SPHEREx”</span>
            <span className="chip">“Free as in freedom.”</span>
          </div>
        </div>
      </section>

      <section className="stats" aria-label="SPHEREx in numbers">
        {STATS.map((s) => <div key={s.l} className="stat-tile" data-reveal><b><CountUp to={s.to} decimals={s.decimals || 0} prefix={s.prefix || ""} suffix={s.suffix || ""} /></b><span>{s.l}</span><small>{s.s}</small></div>)}
      </section>

      <section className="pn" aria-label="How it works" data-tour="ab-pipeline">
        <p className="h">How it works</p>
        <ol className="flow">
          {PIPELINE.map((p, i) => (
            <li key={p.t} data-reveal><span className="flow-ic" aria-hidden="true">{p.icon}</span><b><span className="mono">{i + 1}</span> {p.t}</b><p>{p.d}</p></li>
          ))}
        </ol>
      </section>

      <section aria-label="Good to know" data-tour="ab-facts">
        <p className="h" style={{ margin: "4px 0 12px" }}>Good to know</p>
        <div className="facts">
          {FACTS.map((f) => <div key={f.t} className="fact" data-reveal><span aria-hidden="true">{f.icon}</span><div><b>{f.t}</b><p>{f.d}</p></div></div>)}
        </div>
      </section>

      <section className="pn" aria-label="Data and credits">
        <p className="h">Data &amp; credits</p>
        <div className="cr">{CREDITS.map(([n, u]) => <a key={n} href={u} target="_blank" rel="noreferrer">{n}</a>)}</div>
        <p className="note">SPHEREx data: DOI 10.26131/IRSA629 and 10.26131/IRSA652. This research has made use of the NASA/IPAC Infrared Science Archive, operated by the Jet Propulsion Laboratory, California Institute of Technology, under contract with NASA.</p>
      </section>

      <section className="about-cta">
        <button className="solid" onClick={() => go("/")}>Open the viewer</button>
        <button className="ghost" onClick={() => go("/learn")}>New to astronomy? Start in the Learning Hub</button>
        <a className="ghost" href="https://github.com/freedomwarriorx86/dreamlyfters_OpenAtlas" target="_blank" rel="noreferrer">Source code on GitHub ↗</a>
      </section>
    </main>
  );
}
