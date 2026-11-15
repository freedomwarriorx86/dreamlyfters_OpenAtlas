"""
OpenAtlas — FastAPI backend for the SPHEREx Planet X Viewer.

Endpoints:
  GET /api/health                      status + data release info
  GET /api/resolve?name=               SIMBAD name → RA/Dec
  GET /api/frames?ra=&dec=&fov=&collection=  list exposures (JSON)
  GET /api/frame/{obs_id}?...          rendered PNG cutout
  GET /api/spectrum?ra=&dec=&radius=   spectrum across bands
  GET /api/gaia?ra=&dec=&fov=          Gaia DR3 overlay
  GET /api/wise?ra=&dec=&fov=          WISE comparison
"""

from __future__ import annotations

import logging
from typing import Optional
import urllib.parse

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from spherex import (
    COLLECTION_QR2,
    COLLECTION_DR1,
    query_frames,
    render_frame_png,
    extract_spectrum,
    _synthetic_frames,
)
from gaia import get_gaia_stars
from wise import get_wise_sources

logger = logging.getLogger(__name__)

app = FastAPI(
    title="OpenAtlas — SPHEREx Planet X Viewer",
    version="2.0.0",
    description=(
        "dreamlyfters team · NASA Space Apps 2026 Niğde · "
        "Data: NASA/IPAC IRSA SPHEREx (DOI 10.26131/IRSA629 / 10.26131/IRSA652)"
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# /api/health
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    """Status and data release info."""
    return {
        "status": "ok",
        "version": "2.0.0",
        "project": "OpenAtlas",
        "team": "dreamlyfters",
        "event": "NASA Space Apps 2026 Niğde",
        "data": {
            "collections": {
                COLLECTION_QR2: "SPHEREx Quick Release 2 (Oct 2025+, weekly)",
                COLLECTION_DR1: "SPHEREx Data Release 1 (Nov 13 2026, uniform reprocessing)",
            },
            "archive": "NASA/IPAC IRSA (Caltech/JPL)",
            "doi_qr1": "10.26131/IRSA629",
            "doi_qr2": "10.26131/IRSA652",
            "wavelength_range": "0.75 – 5.0 µm (102 channels)",
            "pixel_scale_arcsec": 6.2,
        },
    }


# ---------------------------------------------------------------------------
# /api/resolve
# ---------------------------------------------------------------------------


@app.get("/api/resolve")
async def resolve_name(name: str = Query(..., description="Object name, e.g. 'Barnard\\'s Star'")):
    """Resolve an object name to ICRS RA/Dec via SIMBAD/Sesame."""
    if not name.strip():
        raise HTTPException(400, "name must not be empty")
    try:
        from astropy.coordinates import SkyCoord
        coord = SkyCoord.from_name(name.strip())
        return {
            "name": name.strip(),
            "ra": round(float(coord.ra.deg), 6),
            "dec": round(float(coord.dec.deg), 6),
            "ra_hms": coord.ra.to_string(unit="hour", sep="hms", precision=2),
            "dec_dms": coord.dec.to_string(sep="dms", precision=1),
        }
    except Exception as exc:
        raise HTTPException(404, f"Could not resolve '{name}': {exc}")


# ---------------------------------------------------------------------------
# /api/frames
# ---------------------------------------------------------------------------


@app.get("/api/frames")
async def frames(
    ra: float = Query(..., description="Right Ascension (decimal degrees)"),
    dec: float = Query(..., description="Declination (decimal degrees)"),
    fov: float = Query(0.5, ge=0.05, le=3.0, description="FOV in degrees"),
    collection: str = Query(COLLECTION_QR2, description="spherex_qr2 or spherex_dr1"),
):
    """
    List SPHEREx exposures that cover (ra, dec), sorted by time.
    Each item contains obs_id, mjd, utc, wav_min_um, wav_max_um, detector.
    """
    _validate_coords(ra, dec)
    try:
        result = query_frames(ra, dec, fov, collection)
    except Exception as exc:
        logger.error("query_frames error: %s", exc)
        raise HTTPException(500, f"Archive query failed: {exc}")

    if not result:
        return {
            "frames": [],
            "ra": ra,
            "dec": dec,
            "fov": fov,
            "collection": collection,
            "message": (
                "No SPHEREx coverage found at these coordinates yet. "
                "SPHEREx science operations began May 2025; some sky regions "
                "may not yet be in the selected data release."
            ),
        }

    # Strip access_url from public response (keep it internal)
    public = []
    for f in result:
        public.append({
            "id": f["obs_id"],
            "mjd": f["mjd"],
            "utc": f["utc"],
            "wav_min_um": f["wav_min_um"],
            "wav_max_um": f["wav_max_um"],
            "detector": f["detector"],
            "collection": f["collection"],
            "demo_mode": f.get("demo_mode", False),
        })

    return {
        "frames": public,
        "count": len(public),
        "ra": ra,
        "dec": dec,
        "fov": fov,
        "collection": collection,
    }


# ---------------------------------------------------------------------------
# /api/frame/{obs_id}
# ---------------------------------------------------------------------------

# In-process frame lookup cache (populated at discovery time, cleared on restart)
_frame_cache: dict[str, dict] = {}


@app.get("/api/frame/{obs_id}")
async def get_frame_png(
    obs_id: str,
    ra: float = Query(...),
    dec: float = Query(...),
    fov: float = Query(0.5, ge=0.05, le=3.0),
    stretch: str = Query("zscale", regex="^(zscale|percentile)$"),
    collection: str = Query(COLLECTION_QR2),
):
    """Return a PNG-rendered SPHEREx cutout for obs_id."""
    _validate_coords(ra, dec)

    # Look up or rebuild the frame dict
    frame = _frame_cache.get(obs_id)
    if frame is None:
        # Re-query to find this obs_id
        all_frames = query_frames(ra, dec, fov, collection)
        for f in all_frames:
            _frame_cache[f["obs_id"]] = f
        frame = _frame_cache.get(obs_id)

    if frame is None:
        # obs_id might be a DEMO frame – reconstruct it
        if obs_id.startswith("DEMO_"):
            demo_frames = _synthetic_frames(ra, dec, fov)
            for f in demo_frames:
                _frame_cache[f["obs_id"]] = f
            frame = _frame_cache.get(obs_id)

    if frame is None:
        raise HTTPException(404, f"Frame {obs_id!r} not found. Try refreshing the frame list.")

    try:
        png_bytes = render_frame_png(frame, ra, dec, fov, stretch)
    except Exception as exc:
        logger.error("render_frame_png error for %s: %s", obs_id, exc)
        raise HTTPException(500, f"Render failed: {exc}")

    return Response(content=png_bytes, media_type="image/png", headers={
        "Cache-Control": "public, max-age=3600",
        "X-Demo-Mode": str(frame.get("demo_mode", False)),
        "X-UTC": frame.get("utc", ""),
        "X-MJD": str(frame.get("mjd", "")),
        "X-Wavelength": f"{frame.get('wav_min_um', '')}-{frame.get('wav_max_um', '')} um",  # HTTP headers must be latin-1
    })


# ---------------------------------------------------------------------------
# /api/spectrum
# ---------------------------------------------------------------------------


@app.get("/api/spectrum")
async def spectrum(
    ra: float = Query(...),
    dec: float = Query(...),
    radius: float = Query(6.0, ge=1.0, le=60.0, description="Aperture radius in arcsec"),
    collection: str = Query(COLLECTION_QR2),
):
    """Extract SPHEREx spectrum at (ra, dec) across all available bands."""
    _validate_coords(ra, dec)
    try:
        result = extract_spectrum(ra, dec, radius, collection)
        return result
    except Exception as exc:
        logger.error("extract_spectrum error: %s", exc)
        raise HTTPException(500, f"Spectrum extraction failed: {exc}")


# ---------------------------------------------------------------------------
# /api/gaia
# ---------------------------------------------------------------------------


@app.get("/api/gaia")
async def gaia(
    ra: float = Query(...),
    dec: float = Query(...),
    fov: float = Query(0.5, ge=0.05, le=3.0),
):
    """Return Gaia DR3 stars within the field of view."""
    _validate_coords(ra, dec)
    try:
        return await get_gaia_stars(ra, dec, fov)
    except Exception as exc:
        logger.error("gaia query error: %s", exc)
        raise HTTPException(500, f"Gaia query failed: {exc}")


# ---------------------------------------------------------------------------
# /api/wise
# ---------------------------------------------------------------------------


@app.get("/api/wise")
async def wise(
    ra: float = Query(...),
    dec: float = Query(...),
    fov: float = Query(0.5, ge=0.05, le=3.0),
):
    """Return WISE/NEOWISE sources within the field of view."""
    _validate_coords(ra, dec)
    try:
        return await get_wise_sources(ra, dec, fov)
    except Exception as exc:
        logger.error("wise query error: %s", exc)
        raise HTTPException(500, f"WISE query failed: {exc}")


# ---------------------------------------------------------------------------
# Legacy endpoints (kept for compatibility with existing frontend)
# ---------------------------------------------------------------------------


@app.get("/api/spherex/epochs")
async def legacy_epochs(
    ra: float = Query(133.794),
    dec: float = Query(-7.245),
    fov: float = Query(0.5),
    band: int = Query(50),
):
    """Legacy endpoint – use /api/frames instead."""
    result = await frames(ra=ra, dec=dec, fov=fov, collection=COLLECTION_QR2)
    return result


@app.get("/")
async def root():
    return {"message": "OpenAtlas API v2 — visit /docs for Swagger UI"}


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _validate_coords(ra: float, dec: float) -> None:
    if not (0.0 <= ra <= 360.0):
        raise HTTPException(400, f"RA must be 0–360°, got {ra}")
    if not (-90.0 <= dec <= 90.0):
        raise HTTPException(400, f"Dec must be −90–+90°, got {dec}")
