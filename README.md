# OpenAtlas — SPHEREx Sky Browser

**NASA Space Apps Challenge Niğde 2026** · Team **dreamlyfters**  
Challenge: *Planet X and SPHEREx* (Astrophysics / Planets & Moons / Software — Advanced)

> Enter any sky coordinates and watch SPHEREx infrared images of that patch of sky animate over time. Moving or changing objects — comets, brown dwarfs, nearby stars with proper motion, variable sources — become visible immediately.

---

## Quick Start

### 1. Backend (Python / FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend available at: **http://localhost:8000**

### 2. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend available at: **http://localhost:3000**  
(Vite proxies `/api/*` → `http://localhost:8000` automatically)

### 3. Open the app

Navigate to **http://localhost:3000** and try one of the preset targets.

---

## Features

| Feature | Status |
|---------|--------|
| RA/Dec coordinate input | ✅ |
| Object name resolution (SIMBAD) | ✅ |
| SPHEREx DR1 frame query (IRSA TAP) | ✅ |
| SPHEREx QR2 frame query | ✅ |
| FITS → PNG rendering (ZScale + inferno) | ✅ |
| Play/pause blink animation | ✅ |
| Adjustable playback speed (1–16 fps) | ✅ |
| Frame scrubber | ✅ |
| Wavelength / MJD / UTC metadata | ✅ |
| SPHEREx spectrum chart (102 channels) | ✅ |
| Gaia DR3 star overlay data | ✅ |
| AllWISE source overlay data | ✅ |
| URL-driven state (?ra=&dec=&fov=&collection=) | ✅ |
| Demo/synthetic fallback (offline mode) | ✅ |
| Mobile-responsive layout | ✅ |

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Status + data release info + DOIs |
| `GET /api/resolve?name=` | SIMBAD name → RA/Dec |
| `GET /api/frames?ra=&dec=&fov=&collection=` | List SPHEREx frames at position |
| `GET /api/frame/{obs_id}?ra=&dec=&fov=&stretch=&collection=` | Render single frame as PNG |
| `GET /api/spectrum?ra=&dec=&radius=&collection=` | Extract SPHEREx spectrum |
| `GET /api/gaia?ra=&dec=&fov=` | Gaia DR3 stars with proper motion |
| `GET /api/wise?ra=&dec=&fov=` | AllWISE sources |

---

## Test Targets

| Object | RA (°) | Dec (°) | Why interesting |
|--------|--------|---------|-----------------|
| Barnard's Star | 269.452 | +4.693 | Highest proper-motion star known; moves visibly between epochs |
| WISE 0855−0714 | 133.788 | −7.246 | Coldest brown dwarf; IR-bright, fast-moving |
| Proxima Centauri | 217.429 | −62.681 | Nearest star; large proper motion |
| M31 (Andromeda) | 10.685 | +41.269 | Extended source test |
| Galactic Center | 266.405 | −29.0 | Dense stellar field |

---

## Data Sources

| Source | Access | DOI / Reference |
|--------|--------|-----------------|
| SPHEREx DR1 | IRSA TAP `spherex.obscore` (collection: `spherex_dr1`) | `10.26131/IRSA652` |
| SPHEREx QR2 | IRSA TAP `spherex.obscore` (collection: `spherex_qr2`) | `10.26131/IRSA629` |
| Gaia DR3 | astroquery Gaia TAP | Gaia Collaboration 2022 |
| AllWISE | IRSA TAP `allwise_p3as_psd` | Cutri et al. 2013 |
| SIMBAD | astroquery `SkyCoord.from_name` | CDS, Strasbourg |

---

## Project Structure

```
openatlas/
├── backend/
│   ├── main.py          # FastAPI app — all endpoints
│   ├── spherex.py       # IRSA TAP/SIA2 queries + FITS→PNG rendering
│   ├── gaia.py          # Gaia DR3 TAP queries
│   ├── wise.py          # AllWISE IRSA TAP queries
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                          # Main layout + URL state
│   │   ├── App.css                          # Dark-sky design system
│   │   ├── hooks/useSPHERExData.js          # Data fetching + animation state
│   │   └── components/
│   │       ├── CoordinateInput.jsx          # Input + name resolution
│   │       ├── ImageViewer.jsx              # <img> frame display
│   │       └── TimeLapseControls.jsx        # Play/pause/scrub/speed
│   ├── vite.config.js                       # Vite + /api proxy
│   └── package.json
├── sprint-reports/
│   ├── sprint-1.md
│   └── sprint-2.md
└── README.md
```

---

## Architecture Notes

**Image rendering pipeline:**  
`IRSA FITS` → `requests` download → `astropy` FITS I/O → `ZScale` normalize → `matplotlib inferno` colormap → `PIL` → `PNG bytes` → HTTP response with `image/png`

**Demo mode:**  
When IRSA is unreachable, the backend generates synthetic sky images with realistic star placement and proper-motion offsets between frames. All responses include `demo_mode: true` and the frontend shows a warning banner.

**Caching:**  
PNG frames are cached to `/tmp/openatlas_cache/` keyed by a content hash of `(ra, dec, fov, obs_id, stretch, collection)`. On subsequent requests the file is served directly without re-fetching from IRSA.

---

## License

**“Free as in freedom.”** OpenAtlas is free software, released under the
**GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later) — see [LICENSE](LICENSE).

You may use, study, share and modify it. If you distribute it, or run a modified
version as a public web service, you must offer the people using it the
corresponding source code under the same license.

Not covered by this license (each keeps its own terms):

| Component | License / terms |
|---|---|
| SPHEREx, Gaia, AllWISE data and NASA/JPL images | Provider's terms and credit requirements (NASA/JPL-Caltech, NASA/IPAC IRSA, ESA/Gaia) |
| Aladin Lite (bundled sky viewer) | GPL-3 |
| Inter and JetBrains Mono fonts | SIL Open Font License 1.1 |
| React, Vite, FastAPI, Astropy, NumPy, SciPy, Pillow | MIT / BSD-style |

Copyright © 2026 team dreamlyfters.

---

*NASA Space Apps Challenge 2026 — dreamlyfters team — Niğde, Turkey*
