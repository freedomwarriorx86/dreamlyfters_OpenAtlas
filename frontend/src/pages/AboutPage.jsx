import React from "react";
import { useAtlas } from "../store";

export default function AboutPage() {
  const { go } = useAtlas();
  return (
    <main className="page">
      <article className="prose">
        <p className="h">About</p>
        <h1>OpenAtlas</h1>
        <p>OpenAtlas lets anyone look at the same patch of sky through every exposure NASA's SPHEREx telescope has taken of it, play them like a short film and spot what moves or changes. It is the dreamlyfters team's entry to the <b>NASA Space Apps Challenge 2026 (Niğde)</b>, challenge “Planet X and SPHEREx”.</p>

        <h2>How it works</h2>
        <ol>
          <li><b>Discovery.</b> For any RA/Dec, the backend asks the NASA/IPAC Infrared Science Archive (IRSA) for every SPHEREx Level 2 exposure that covers it (SIA2, collection <code>spherex_dr1</code>). Each exposure has six detector images; each is a separate frame.</li>
          <li><b>Cutouts.</b> A 15′ cutout around the target is downloaded once per frame (image, flags and variance planes) and cached.</li>
          <li><b>Alignment.</b> Every frame is resampled with its full astrometric solution (including SIP distortion) onto one north-up grid centred on the target, so stars line up pixel for pixel and only real changes remain.</li>
          <li><b>Blink, stack, difference.</b> Frames are played in time order, median-stacked to reveal faint sources, or subtracted after matching fluxes.</li>
          <li><b>Measurements.</b> Aperture photometry at the target gives the light curve; because SPHEREx's linear variable filters give every pixel its own wavelength, the same measurements across many exposures form a 0.75–5 µm spectrum.</li>
          <li><b>Candidates.</b> Bright sources are centroided in early and late frames of the same detector; after removing the common field shift, sources that moved or changed brightness significantly are listed and cross-matched with Gaia DR3. A separate difference search finds fast movers that disappear from the median stack.</li>
        </ol>

        <h2>Good to know</h2>
        <ul>
          <li>SPHEREx pixels are 6.2″ wide, so only fast movers (several arcseconds per year) stand out within the ~1 year covered so far.</li>
          <li>The first view of a new position downloads each cutout from IRSA and can take a minute; after that it is cached.</li>
          <li>Very bright stars saturate; their positions and fluxes are less reliable (check the quality flags).</li>
          <li>Candidates are unconfirmed. Cross-check with Gaia and WISE before reporting anything.</li>
          <li>If IRSA cannot be reached, OpenAtlas says so and shows clearly labelled synthetic demo frames.</li>
        </ul>

        <h2>Data and credits</h2>
        <p>SPHEREx data from NASA/IPAC IRSA (DOI 10.26131/IRSA629, 10.26131/IRSA652). Gaia DR3 (ESA) and AllWISE (NASA/JPL-Caltech/UCLA) via VizieR; names resolved through Sesame/SIMBAD (CDS). Sky maps by Aladin Lite (CDS) using IRSA-hosted HiPS. Built with Astropy, NumPy, SciPy, FastAPI and React.</p>
        <p>Share any view by copying its link: the URL holds the position, field of view, mode and settings, e.g. <code>?ra=133.7951&amp;dec=-7.2451&amp;fov=6&amp;mode=blink</code>.</p>
        <p style={{ marginTop: 24 }}><button className="solid" onClick={() => go("/")}>Open the viewer</button></p>
      </article>
    </main>
  );
}
