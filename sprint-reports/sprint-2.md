# Sprint 2 Report — OpenAtlas

**Team:** dreamlyfters  
**Event:** NASA Space Apps Challenge Niğde 2026 (Nov 14–15, 2026)  
**Sprint:** 2 of 4 · Day 1 (Nov 14) → Day 2 (Nov 15)  
**Sprint Goal:** End-to-end working pipeline — real IRSA data → PNG frames → animated viewer

---

## Summary

Sprint 2 delivered a fully functional end-to-end pipeline replacing all synthetic/stub code with real IRSA queries and proper image rendering. The app now:

1. Queries NASA's IRSA TAP service for SPHEREx DR1 (and QR2) frames at any RA/Dec
2. Renders FITS images to PNG via ZScale normalization + inferno colormap
3. Serves them as `<img>` tags through a FastAPI backend
4. Plays them as a blink animation in the browser with play/pause/speed controls
5. Resolves object names via SIMBAD (e.g. "Barnard's Star" → RA/Dec)
6. Falls back to realistic synthetic frames when IRSA is unreachable (demo mode)

---

## Completed Work

### Backend

| File | Change | Key Detail |
|------|--------|------------|
| `backend/spherex.py` | Full rewrite | Real pyvo TAP query on `spherex.obscore`; ZScale→inferno PNG rendering; SIA2 fallback; synthetic fallback with proper SPHEREx epoch (May 2025) |
| `backend/main.py` | Full rewrite | 7 endpoints: `/api/health`, `/api/resolve`, `/api/frames`, `/api/frame/{obs_id}`, `/api/spectrum`, `/api/gaia`, `/api/wise`; in-process frame cache; coord validation |
| `backend/gaia.py` | Full rewrite | Real `astroquery.gaia` TAP with `launch_job` (sync); proper-motion data; synthetic fallback |
| `backend/wise.py` | Full rewrite | Fixed critical `ImportError` (was exporting `get_wise_cutout`, main imported `get_wise_sources`); real pyvo TAP on `allwise_p3as_psd`; synthetic fallback |
| `backend/requirements.txt` | Updated | Added `pyvo`, `Pillow`, `matplotlib`, `requests` |

**TAP query used for SPHEREx frames:**
```sql
SELECT TOP 40 obs_id, t_min, t_max, em_min, em_max,
       s_ra, s_dec, access_url, dataproduct_subtype
FROM spherex.obscore
WHERE 1 = CONTAINS(
    POINT('ICRS', {ra}, {dec}),
    CIRCLE('ICRS', s_ra, s_dec, 4.0)
)
AND collection = '{collection}'
ORDER BY t_min
```

### Frontend

| File | Change | Key Detail |
|------|--------|------------|
| `frontend/vite.config.js` | Updated | Added `/api` → `http://localhost:8000` proxy |
| `frontend/src/hooks/useSPHERExData.js` | Full rewrite | Fetches `/api/frames` JSON then builds PNG URLs; play/pause interval; `fetchSpectrum` + `fetchOverlays`; no more float-array JSON |
| `frontend/src/components/ImageViewer.jsx` | Full rewrite | `<img src="/api/frame/{id}?...">` replaces canvas rendering; wavelength/MJD/UTC badges; demo-mode banner |
| `frontend/src/components/TimeLapseControls.jsx` | Full rewrite | Play/Pause button; speed selector (1–16 fps); frame scrubber; metadata row |
| `frontend/src/components/CoordinateInput.jsx` | Full rewrite | Fixed implicit global bug; name resolution via `/api/resolve`; 5 preset targets; RA/Dec/FOV/collection inputs |
| `frontend/src/App.jsx` | Full rewrite | URL-driven state (`?ra=&dec=&fov=&collection=`); spectrum SVG chart; correct data flow through hooks |
| `frontend/src/App.css` | New | Dark-sky design system; responsive layout; consistent spacing/color tokens |

---

## Architecture Decisions

### PNG-over-the-wire vs JSON float arrays
Old approach sent `256×256` float arrays as JSON (~260 KB/frame, slow canvas render).  
New approach: backend renders PNG (512×512, `~15–50 KB`), frontend uses native `<img>` — 5–10× smaller, hardware-accelerated, zero canvas code.

### Demo mode
When IRSA TAP is unreachable (timeout, quota, etc.), `spherex.py` generates synthetic sky images with:
- Random stars at realistic densities seeded by RA/Dec
- Proper-motion offsets between frames (scaled by epoch delta)
- 6-frame sequence at 6-month cadence starting May 2025
- All endpoints return `demo_mode: true`; frontend shows ⚠ banner

### URL state
`?ra=269.452&dec=4.693&fov=0.5&collection=spherex_dr1` — shareable, bookmarkable, embeddable. Loaded on mount, updated on every search.

---

## Data Sources Used

| Catalog | Access | Purpose |
|---------|--------|---------|
| SPHEREx DR1 | IRSA TAP `spherex.obscore` | Primary image frames |
| SPHEREx QR2 | IRSA TAP `spherex.obscore` | Archive frames (selectable) |
| Gaia DR3 | astroquery Gaia TAP | Star overlay + proper-motion arrows |
| AllWISE | IRSA TAP `allwise_p3as_psd` | Infrared source overlay |
| SIMBAD | astroquery `SkyCoord.from_name` | Object name resolution |

DOIs: QR1 `10.26131/IRSA629` · QR2 `10.26131/IRSA652`

---

## Bugs Fixed

| Bug | Symptom | Fix |
|-----|---------|-----|
| `NameError: IRSA` | Backend crashed on first request | Removed non-imported `IRSA()` call; rewrote with pyvo |
| Wrong epoch dates | SPHEREx data shown from 2021 | Changed base date to `2025-05-01` (actual SPHEREx ops start) |
| `ImportError: get_wise_sources` | Backend failed to start | Rewrote `wise.py` to export `get_wise_sources` |
| Implicit global `hmsMatches` | Silent JS error in coordinate parsing | Rewrote `CoordinateInput.jsx` without the bug |
| `round` on undefined | `useSPHERExData.js` crashed on load | Complete hook rewrite |
| Uncontrolled speed slider | Speed always 1 fps | Replaced with controlled `<select>` |

---

## Test Targets Status

| Object | RA | Dec | Coverage Expected |
|--------|-----|-----|-------------------|
| Barnard's Star | 269.452 | +4.693 | ✅ Ecliptic plane, high-PM star |
| WISE 0855−0714 | 133.788 | −7.246 | ✅ Cold brown dwarf, IR-bright |
| Proxima Centauri | 217.429 | −62.681 | ✅ Nearest star, high PM |
| M31 (Andromeda) | 10.685 | +41.269 | ✅ Extended source test |
| Galactic Center | 266.405 | −29.0 | ⚠ May be excluded from SPHEREx coverage (high extinction) |

---

## Sprint Velocity

| Item | Story Points | Status |
|------|-------------|--------|
| Real IRSA TAP query | 5 | ✅ Done |
| FITS → PNG pipeline | 5 | ✅ Done |
| Backend endpoint suite | 3 | ✅ Done |
| Play/pause blink animation | 3 | ✅ Done |
| Name resolution (SIMBAD) | 2 | ✅ Done |
| URL-driven state | 2 | ✅ Done |
| Demo/synthetic fallback | 3 | ✅ Done |
| Spectrum chart | 2 | ✅ Done |
| Gaia/WISE overlay data | 3 | ✅ Done |
| Fix all existing bugs | 5 | ✅ Done |
| **Total** | **33** | ✅ |

---

## Retrospective

**Went well:**
- End-to-end pipeline is working and resilient (demo mode means it works offline)
- PNG approach is dramatically simpler and faster than the old canvas approach
- URL state makes the tool immediately shareable, which matters for demo/judging

**Challenges:**
- IRSA TAP requires careful ADQL (column names differ from IVOA standard in places)
- pyvo's SIA2 as fallback was necessary because some older SPHEREx frames aren't in obscore
- Large FITS files (100+ MB for some SPHEREx cubes) require streaming with `requests`

**For Sprint 3:**
- Visual star/source overlays rendered on top of the image (SVG layer)
- Stretch control exposed in UI (linear / ZScale / asinh)
- Thumbnail strip showing all frames at once
- Error messages more informative (coordinate outside coverage, rate limit)
- Performance: preload next/prev frame PNG in browser cache

---

*Report prepared by team dreamlyfters — NASA Space Apps Challenge Niğde 2026*
