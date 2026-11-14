# SPHEREx Planet X Viewer

NASA Space Apps 2026 Challenge — "Planet X and SPHEREx"

## Overview

A public-facing sky viewer that displays SPHEREx mission images over time, allowing anyone to discover moving astronomical objects (asteroids, comets, brown dwarfs, potential Planet X candidates).

## Project Structure

```
spherex-viewer/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CoordinateInput.jsx
│   │   │   ├── ImageViewer.jsx
│   │   │   ├── BandSelector.jsx
│   │   │   ├── TimeLapseControls.jsx
│   │   │   ├── OverlayControls.jsx
│   │   │   ├── SpectrumPlot.jsx
│   │   │   └── TestObjectsPreset.jsx
│   │   ├── hooks/
│   │   │   ├── useSPHERExData.js
│   │   │   └── useURLState.js
│   │   └── App.jsx
│   ├── package.json
│   ├── tailwind.config.cjs
│   ├── postcss.config.js
│   └── index.css
├── backend/
│   ├── main.py      # FastAPI application
│   ├── spherex.py   # SPHEREx IRSA queries
│   ├── gaia.py      # Gaia DR3 queries
│   ├── wise.py      # WISE/NEOWISE queries
│   └── requirements.txt
└── README.md
```

## Features

### Core Features

1. **Coordinate Input**
   - Right Ascension (RA) and Declination (Dec) in decimal degrees or sexagesimal format
   - Object name resolution via SIMBAD/NED (backend integration)
   - Field of view selector (0.1° to 2°)

2. **SPHEREx Data Fetching**
   - Query SPHEREx cutout images from NASA/IPAC IRSA
   - Fetch all available epochs (SPHEREx maps every ~6 months)
   - 102 near-infrared bands (0.75–5.0 microns)

3. **Time-Lapse Viewer**
   - Animated flipbook/video sequence of observations
   - Play / pause / step forward / step backward controls
   - Adjustable playback speed
   - Frame counter showing date of each observation

4. **102 Infrared Band Display**
   - Band selector slider (1–102)
   - Combine bands: sum all, or sum by detector array (6 arrays)
   - False-color RGB mapping: assign 3 bands to R, G, B channels
   - Display wavelength label for selected band

5. **Image Arithmetic**
   - "Blink comparator" mode: rapidly alternates between two epochs
   - Difference image: subtract epoch A from epoch B
   - Sum mode: add multiple epochs to improve signal-to-noise

6. **Overlays: Gaia + WISE Data**
   - Toggle Gaia DR3 catalog overlay (proper motion arrows on known stars)
   - Toggle WISE/NEOWISE overlay for comparison

7. **URL-Based Coordinates**
   - All state encoded in URL parameters: `?ra=133.794&dec=-7.245&fov=0.5&band=50&epoch=2`
   - Shareable links that open the exact same view
   - Embeddable in iframes

### Bonus Features

8. **On-the-Fly Spectra**
   - Click any object in the image to extract its spectrum across all 102 bands
   - Plot flux vs wavelength using Chart.js
   - Show known molecular absorption features (H2O, CO2, CO)

9. **Metadata Display**
   - Contamination flags per pixel
   - Exposure time per epoch
   - Signal-to-noise ratio

## Test Objects (Pre-loaded Presets)

- **Barnard's Star** (RA: 269.452, Dec: +4.693) — fast proper motion star
- **Epsilon Indi B** (RA: 330.840, Dec: -56.786) — brown dwarf pair
- **WISE 0855** (RA: 133.794, Dec: -7.245) — fastest known brown dwarf
- **RW Aurigae** (RA: 84.553, Dec: +30.401) — variable star
- **R Draconis** (RA: 276.047, Dec: +68.039) — variable star

## Running the Application

### Backend (FastAPI)

```bash
cd spherex-viewer/backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

### Frontend (React + Vite)

```bash
cd spherex-viewer/frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Full Stack

Once both are running, the frontend will connect to the backend at `http://localhost:8000/api/...`

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/coordinates/{ra}/{dec}/{format_type}` | Parse and validate coordinates |
| `GET /api/cutout?ra=&dec=&fov=&band=&epoch=` | Fetch SPHEREx cutout image |
| `GET /api/multi-epoch?ra=&dec=&fov=&bands=` | Fetch multiple epochs for time-lapse |
| `POST /api/combine-bands` | Combine infrared bands (sum, array_sum) |
| `POST /api/rgb-mapping` | Apply false-color RGB mapping |
| `GET /api/gaia-query?ra=&dec=&radius=` | Query Gaia DR3 catalog |
| `GET /api/wise-query?ra=&dec=&radius=` | Query WISE/NEOWISE catalog |
| `GET /api/wise-light-curve?ra=&dec=&radius=&bands=` | Query WISE light curve |
| `GET /api/health` | Health check |

## Development Notes

- SPHEREx data is queried from NASA/IPAC Infrared Science Archive (IRSA)
- Uses astropy for WCS handling and image processing
- Gaia DR3 queries via astroquery.gaia
- WISE queries via astroquery.ipac.wise
- All state is encoded in URL parameters for shareable links
- Mobile-responsive design using Tailwind CSS
- CORS enabled for development

## Demo

The app has been tested with all 5 test objects:
- Barnard's Star
- Epsilon Indi B
- WISE 0855
- RW Aurigae
- R Draconis
