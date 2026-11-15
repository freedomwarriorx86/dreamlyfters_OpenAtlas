import React, { useState } from "react";
import { useAtlas } from "../store";
import { Logo } from "../components/Chrome";
import { CountUp, useStagger } from "../lib/motion";
import { IconCheckCircle, IconClock, IconExternal, IconGauge, IconGithub, IconLink, IconSatellite, IconSun } from "../components/Icons";

// Drop the team logo into frontend/public/team-logo.png (or .svg and change the path).
const TEAM_LOGO = "/team-logo.png";
const REPO = "https://github.com/freedomwarriorx86/dreamlyfters_OpenAtlas";

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

// Every step image is real OpenAtlas output for Barnard's Star (frontend/public/media/steps/).
const PIPELINE = [
  { img: "/media/steps/step-1.jpg", t: "Find", d: "Ask NASA's IRSA archive for every SPHEREx exposure that covers your position.", alt: "SPHEREx sky map with the field of view and exposure footprints" },
  { img: "/media/steps/step-2.jpg", t: "Cut out", d: "Download only a small patch around the target from each exposure, then cache it.", alt: "A raw SPHEREx cut-out around Barnard's Star" },
  { img: "/media/steps/step-3.jpg", t: "Line up", d: "Put every frame on the same north-up grid using its exact sky coordinates.", alt: "Aligned SPHEREx frame with coordinate grid and compass" },
  { img: "/media/steps/step-4.jpg", t: "Blink · Stack · Diff", d: "Play the frames in time order, average them, or subtract them to show changes.", alt: "The same patch as a single frame, a stack and a difference image" },
  { img: "/media/steps/step-5.jpg", t: "Measure", d: "Brightness in every frame gives a light curve; across colours it gives a spectrum.", alt: "Light curve of Barnard's Star measured by OpenAtlas" },
  { img: "/media/steps/step-6.jpg", t: "Find movers", d: "Compare early and late positions of every source and cross-check with Gaia.", alt: "Barnard's Star flagged as a known mover with its measured motion" },
];

const FACTS = [
  { Icon: IconClock, t: "First look takes a minute", d: "A new position is downloaded from NASA once; after that it is cached and instant." },
  { Icon: IconGauge, t: "Only fast movers stand out", d: "With about a year of data and 6″ pixels, things must move several arcseconds a year to show." },
  { Icon: IconSun, t: "Bright stars saturate", d: "Their brightness is estimated from the outer glow — fine for changes, not exact values." },
  { Icon: IconCheckCircle, t: "Candidates, not discoveries", d: "Always check a candidate in blink, stack and against Gaia/WISE before reporting it." },
  { Icon: IconSatellite, t: "Honest about outages", d: "If NASA's archive is down, OpenAtlas says so and clearly labels any demo data." },
  { Icon: IconLink, t: "Every view is a link", d: "The address bar holds position, zoom and settings — share it and others see the same." },
];

const LINKS = [
  { group: "Project", items: [
    ["Source code on GitHub", REPO, "Everything in this site, open to read and reuse"],
    ["License: GNU AGPL-3.0", `${REPO}/blob/main/LICENSE`, "Free as in freedom"],
    ["README and setup guide", `${REPO}#readme`, "Run OpenAtlas on your own computer"],
    ["Deployment notes", `${REPO}/tree/main/deploy`, "How the public server is set up"],
  ] },
  { group: "Challenge", items: [
    ["NASA Space Apps Challenge", "https://www.spaceappschallenge.org/", "The world's largest annual hackathon"],
    ["SPHEREx mission (NASA)", "https://science.nasa.gov/mission/spherex/", "Mission overview and news"],
    ["SPHEREx team (Caltech)", "https://spherex.caltech.edu/", "Science team, images and documents"],
  ] },
  { group: "Data", items: [
    ["SPHEREx at NASA/IPAC IRSA", "https://irsa.ipac.caltech.edu/Missions/spherex.html", "The archive OpenAtlas reads from"],
    ["SPHEREx data DOI 10.26131/IRSA629", "https://doi.org/10.26131/IRSA629", "Cite the data"],
    ["SPHEREx data DOI 10.26131/IRSA652", "https://doi.org/10.26131/IRSA652", "Cite the data"],
    ["Gaia DR3 (ESA)", "https://www.cosmos.esa.int/web/gaia/dr3", "Star positions and motions"],
    ["AllWISE", "https://wise2.ipac.caltech.edu/docs/release/allwise/", "Infrared catalogue, ~2010"],
    ["NASA Image and Video Library", "https://images.nasa.gov/", "Source of the gallery images"],
  ] },
  { group: "Tools", items: [
    ["SIMBAD (CDS)", "https://simbad.cds.unistra.fr/", "Object names and positions"],
    ["Aladin Lite (CDS)", "https://aladin.cds.unistra.fr/AladinLite/", "Interactive sky maps"],
    ["Astropy", "https://www.astropy.org/", "Astronomy in Python"],
    ["NumPy · SciPy", "https://scipy.org/", "Image processing"],
    ["FastAPI", "https://fastapi.tiangolo.com/", "Backend web framework"],
    ["React", "https://react.dev/", "User interface"],
  ] },
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
          <div className="tags">
            <a className="tag-pill on" href="https://www.spaceappschallenge.org/" target="_blank" rel="noreferrer">NASA Space Apps Challenge 2026</a>
            <span className="tag-pill">Niğde, Türkiye</span>
            <span className="tag-pill">Challenge: Planet X and SPHEREx</span>
            <a className="tag-pill" href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">“Free as in freedom.”</a>
          </div>
        </div>
      </section>

      <section className="stats" aria-label="SPHEREx in numbers">
        {STATS.map((s) => <div key={s.l} className="stat-tile" data-reveal><b><CountUp to={s.to} decimals={s.decimals || 0} prefix={s.prefix || ""} suffix={s.suffix || ""} /></b><span>{s.l}</span><small>{s.s}</small></div>)}
      </section>

      <section className="pn" aria-label="How it works" data-tour="ab-pipeline">
        <p className="h">How it works <span>real OpenAtlas output · Barnard&apos;s Star</span></p>
        <ol className="flow">
          {PIPELINE.map((p, i) => (
            <li key={p.t} data-reveal>
              <figure className="flow-img"><img src={p.img} alt={p.alt} loading="lazy" width="640" height="400" /></figure>
              <b><span className="flow-n">{i + 1}</span>{p.t}</b>
              <p>{p.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Good to know" data-tour="ab-facts">
        <p className="h" style={{ margin: "4px 0 12px" }}>Good to know</p>
        <div className="facts">
          {FACTS.map(({ Icon, t, d }) => (
            <div key={t} className="fact" data-reveal><span className="fact-ic"><Icon size={22} /></span><div><b>{t}</b><p>{d}</p></div></div>
          ))}
        </div>
      </section>

      <section className="pn" aria-label="Links" data-tour="ab-links">
        <p className="h">Links</p>
        <div className="link-groups">
          {LINKS.map((g) => (
            <div key={g.group} className="link-group">
              <h3>{g.group}</h3>
              <ul>
                {g.items.map(([name, url, sub]) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      <span><b>{name}</b><small>{sub}</small></span>
                      <IconExternal size={15} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="note">SPHEREx data: DOI 10.26131/IRSA629 and 10.26131/IRSA652. This research has made use of the NASA/IPAC Infrared Science Archive, operated by the Jet Propulsion Laboratory, California Institute of Technology, under contract with NASA. Gallery images: NASA/JPL-Caltech.</p>
      </section>

      <section className="about-cta">
        <button className="solid" onClick={() => go("/")}>Open the viewer</button>
        <button className="ghost" onClick={() => go("/learn")}>New to astronomy? Start in the Learning Hub</button>
        <a className="ghost" href={REPO} target="_blank" rel="noreferrer"><IconGithub size={16} /> Source code on GitHub</a>
      </section>
    </main>
  );
}
