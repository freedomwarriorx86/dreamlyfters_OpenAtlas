# SPHEREx Planet X Viewer

## NASA Space Apps Challenge 2026 - "Planet X and SPHEREx"

A web application for discovering moving astronomical objects using SPHEREx mission data.

## Overview

SPHEREx (Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer) is an NASA all-sky survey mission that will observe the universe in 102 infrared bands across 0.75–5.0 microns. This tool allows anyone to explore SPHEREx data and discover moving objects by displaying image sequences over time.

## Features

### Core Features

1. **Coordinate Input**
   - Right Ascension (RA) and Declination (Dec) in multiple formats:
     - Decimal degrees (e.g., 133.794, -7.245)
     - Sexagesimal (HMS/DMS)
   - Field of view selector (0.1° to 2°)

2. **SPHEREx Data Fetching**
   - Query SPHEREx cutout images from NASA/IPAC IRSA archive
   - All available epochs (SPHEREx maps sky every ~6 months)
   - 102 near-infrared bands (0.75–5.0 microns)

3. **Time-Lapse Viewer**
   - Animated flipbook/video sequence of observations
   - Play / pause / step forward / step backward controls
   - Adjustable playback speed
   - Frame counter showing date of each observation

4. **102 Infrared Band Display**
   - Band selector slider (1–102)
   - Option to combine bands: sum all 102, or sum by detector array (6 arrays)
   - False-color RGB mapping: assign 3 bands to R, G, B channels
   - Display wavelength label for selected band

5. **Image Arithmetic (Blink Comparator)**
   - Rapidly alternates between two epochs
   - Difference image: subtract epoch A from epoch B to highlight changes
   - Sum mode: add multiple epochs to improve signal-to-noise

6. **Overlay: GAIA + WISE Data**
   - Toggle Gaia DR3 catalog overlay (proper motion arrows on known stars)
   - Toggle WISE/NEOWISE overlay for comparison

7. **URL-Based Coordinates**
   - All state encoded in URL parameters:
     `?ra=133.794&dec=-7.245&fov=0.5&band=50&epoch=2`
   - Shareable links that open the exact same view
   - Embeddable in iframes

8. **On-the-Fly Spectra**
   - Click any object in the image to extract its spectrum across all 102 bands
   - Plot flux vs wavelength using Chart.js or Plotly
   - Show known molecular absorption features (H2O, CO2, CO)

9. **Metadata Display**
   - Show contamination flags per pixel
   - Exposure time per epoch
   - Signal-to-noise ratio

### Test Objects (Pre-loaded Presets)

- **Barnard's Star** (RA: 269.452, Dec: +4.693) — Fast proper motion star
- **Epsilon Indi B** (RA: 330.840, Dec: -56.786) — Brown dwarf pair
- **WISE 0855** (RA: 133.794, Dec: -7.245) — Fastest known brown dwarf
- **RW Aurigae** (RA: 84.553, Dec: +30.401) — Variable star
- **R Draconis** (RA: 276.047, Dec: +68.039) — Variable star

### Project Structure

```
spherex-viewer/
├── frontend/
│   ├── src/
│ │   ├── components/
│ │   │   ├── CoordinateInput.jsx
│ │   │   ├── ImageViewer.jsx
│ │   │   ├── BandSelector.jsx
│ │   │   ├── TimeLapseControls.jsx
│ │   │   ├── OverlayControls.jsx
│ │   │   ├── SpectrumPlot.jsx
│ │   │   └── TestObjectsPreset.jsx
│ │   ├── hooks/
│ │   │   ├── useSPHERExData.js
│ │   │   └── useURLState.js
│ │   └── App.jsx
├── backend/
│   ├── main.py          # FastAPI app
│   ├── spherex.py       # SPHEREx IRSA queries
│   ├── gaia.py          # Gaia DR3 queries
│   ├── wise.py          # WISE queries
│   └── requirements.txt
└── README.md