"""
OpenAtlas — FastAPI backend for the SPHEREx Planet X viewer.

All handlers are plain `def`: FastAPI runs them in its thread pool, so a slow
archive call never blocks the other requests.

Endpoints (fov is always the full field width in arcminutes)
  GET /api/health                          status, data releases
  GET /api/releases                        selectable SPHEREx collections
  GET /api/flags                           SPHEREx pixel-flag classes and bits
  GET /api/resolve?name=                   Sesame name -> RA/Dec (proper motion applied)
  GET /api/frames?ra&dec&collection        exposures covering the target (one per detector)
  GET /api/frame/{id}?ra&dec&fov&stretch&flags&mask&size   aligned PNG cutout
  GET /api/frame/{id}/values?ra&dec&fov    128x128 float32 grid (base64) for cursor readout
  GET /api/photometry?ra&dec&ids=          aperture photometry per frame (light curve, spectrum)
  GET /api/stack?ra&dec&fov&ids&stretch    median stack PNG
  GET /api/diff?ra&dec&fov&ids&op&a&b      difference PNG (op = pair | median | range)
  GET /api/candidates?ra&dec&fov&ids       moving / variable source candidates
  GET /api/export.gif?ra&dec&fov&ids       animated GIF
  GET /api/gaia?ra&dec&fov                 Gaia DR3 sources (epoch 2016.0, with proper motions)
  GET /api/wise?ra&dec&fov                 AllWISE sources
"""

from __future__ import annotations

import base64
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

import analysis
import catalogs
import spherex as sx

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("openatlas")

app = FastAPI(
    title="OpenAtlas — SPHEREx Planet X Viewer",
    version="3.0.0",
    description=(
        "dreamlyfters team · NASA Space Apps 2026 Niğde · "
        "Data: NASA/IPAC IRSA SPHEREx (DOI 10.26131/IRSA629 / 10.26131/IRSA652)"
    ),
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])

FOV_Q = Query(5.0, ge=sx.MIN_FOV_ARCMIN, le=sx.MAX_FOV_ARCMIN, description="Field width in arcmin")
STRETCH_Q = Query("asinh", pattern="^(linear|asinh|log|zscale|percentile)$")
COLL_Q = Query(sx.DEFAULT_COLLECTION, description="spherex_dr1 | spherex_qr2 | spherex_qr")
MAX_IDS = 80
CACHE_HDR = {"Cache-Control": "public, max-age=86400"}


def _coords(ra: float, dec: float) -> None:
    if not (0.0 <= ra <= 360.0):
        raise HTTPException(400, f"RA must be 0–360°, got {ra}")
    if not (-90.0 <= dec <= 90.0):
        raise HTTPException(400, f"Dec must be −90–+90°, got {dec}")


def _collection(c: str) -> str:
    if c not in sx.COLLECTIONS:
        raise HTTPException(400, f"Unknown collection {c!r}. Use one of {list(sx.COLLECTIONS)}")
    return c


def _frames_for(ids: str, ra: float, dec: float, collection: str) -> list[dict]:
    wanted = [i for i in (ids or "").split(",") if i.strip()]
    if not wanted:
        raise HTTPException(400, "ids must list at least one frame id")
    if len(wanted) > MAX_IDS:
        raise HTTPException(400, f"at most {MAX_IDS} frames per request")
    out, missing = [], []
    for fid in wanted:
        f = sx.get_frame(fid.strip(), ra, dec, collection)
        (out if f else missing).append(f or fid)
    if missing and not out:
        raise HTTPException(404, f"Unknown frame ids: {', '.join(missing[:5])}")
    return out


def _png(data: bytes) -> Response:
    return Response(content=data, media_type="image/png", headers=CACHE_HDR)


# ---------------------------------------------------------------------------
# Info
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "version": app.version,
        "project": "OpenAtlas",
        "team": "dreamlyfters",
        "event": "NASA Space Apps 2026 Niğde",
        "data": {
            "collections": {k: v["label"] for k, v in sx.COLLECTIONS.items()},
            "archive": "NASA/IPAC IRSA (Caltech/JPL)",
            "doi_qr1": "10.26131/IRSA629",
            "doi_qr2": "10.26131/IRSA652",
            "wavelength_range_um": [sx.WAV_MIN_UM, sx.WAV_MAX_UM],
            "n_bands": sx.N_BANDS,
            "pixel_scale_arcsec": sx.PIX_SCALE_ARCSEC,
        },
    }


@app.get("/api/releases")
def releases():
    return {"default": sx.DEFAULT_COLLECTION,
            "releases": [{"id": k, **v} for k, v in sx.COLLECTIONS.items()]}


@app.get("/api/flags")
def flags():
    return {"classes": [{k: c[k] for k in ("key", "label", "detail", "color", "bits", "mask")} for c in sx.FLAG_CLASSES],
            "bits": {str(b): n for b, n in sx.FLAG_BITS.items()}}


@app.get("/api/resolve")
def resolve_name(name: str = Query(..., min_length=1, max_length=120),
                 epoch: float = Query(catalogs.DEFAULT_EPOCH, ge=1990, le=2040)):
    try:
        return catalogs.resolve(name, epoch)
    except LookupError as exc:
        raise HTTPException(404, str(exc))


# ---------------------------------------------------------------------------
# Frames
# ---------------------------------------------------------------------------

@app.get("/api/frames")
def frames(ra: float = Query(...), dec: float = Query(...), collection: str = COLL_Q):
    _coords(ra, dec)
    collection = _collection(collection)
    t0 = time.time()
    res = sx.query_frames(ra, dec, collection)
    public = [{k: f[k] for k in ("id", "obs_id", "detector", "mjd", "utc", "wav_min_um", "wav_max_um",
                                  "exptime_s", "region", "demo_mode")}
              for f in res["frames"]]
    out = {"frames": public, "count": len(public), "ra": ra, "dec": dec, "collection": collection,
           "source": res["source"], "demo_mode": res.get("demo_mode", False), "error": res.get("error"),
           "seconds": round(time.time() - t0, 2)}
    if public:
        out["first_utc"], out["latest_utc"] = public[0]["utc"], public[-1]["utc"]
    else:
        out["message"] = ("No SPHEREx exposures in this release cover these coordinates yet. "
                          "Try another release or position.")
    return out


@app.get("/api/frame/{fid}")
def frame_png(fid: str, ra: float = Query(...), dec: float = Query(...), fov: float = FOV_Q,
              stretch: str = STRETCH_Q, flags: bool = False, mask: bool = False,
              size: int = Query(512, ge=48, le=1024), collection: str = COLL_Q):
    _coords(ra, dec)
    f = sx.get_frame(fid, ra, dec, _collection(collection))
    if f is None:
        raise HTTPException(404, f"Frame {fid!r} is not in the {collection} archive at this position.")
    try:
        return _png(sx.render_frame(f, ra, dec, fov, stretch, flags, mask, size))
    except sx.ArchiveError as exc:
        logger.warning("frame %s: %s", fid, exc)
        raise HTTPException(502, f"{exc}. IRSA is busy; try again shortly.")


@app.get("/api/frame/{fid}/values")
def frame_values(fid: str, ra: float = Query(...), dec: float = Query(...), fov: float = FOV_Q,
                 collection: str = COLL_Q):
    _coords(ra, dec)
    f = sx.get_frame(fid, ra, dec, _collection(collection))
    if f is None:
        raise HTTPException(404, f"Frame {fid!r} not found")
    try:
        grid = sx.frame_values(f, ra, dec, fov, 128)
    except sx.ArchiveError as exc:
        raise HTTPException(502, str(exc))
    return {"n": grid.shape[0], "unit": "arbitrary (demo)" if f.get("demo_mode") else "MJy/sr",
            "orientation": "row 0 = north, column 0 = east",
            "data": base64.b64encode(grid.astype("<f4").tobytes()).decode()}


@app.get("/api/photometry")
def photometry(ra: float = Query(...), dec: float = Query(...), ids: str = Query(...),
               collection: str = COLL_Q):
    _coords(ra, dec)
    fr = _frames_for(ids, ra, dec, _collection(collection))

    def one(f):
        try:
            return sx.photometry(f, ra, dec)
        except Exception as exc:
            return {"id": f["id"], "mjd": f["mjd"], "utc": f["utc"], "detector": f["detector"],
                    "flux_ujy": None, "error": str(exc)}
    with ThreadPoolExecutor(max_workers=6) as ex:
        pts = list(ex.map(one, fr))
    return {"points": pts, "unit": "uJy", "aperture_arcsec": sx.AP_RADIUS_PX * sx.PIX_SCALE_ARCSEC}


# ---------------------------------------------------------------------------
# Multi-frame products
# ---------------------------------------------------------------------------

@app.get("/api/stack")
def stack(ra: float = Query(...), dec: float = Query(...), ids: str = Query(...), fov: float = FOV_Q,
          stretch: str = STRETCH_Q, size: int = Query(512, ge=48, le=1024), collection: str = COLL_Q):
    _coords(ra, dec)
    fr = _frames_for(ids, ra, dec, _collection(collection))
    try:
        return _png(analysis.stack_png(fr, ra, dec, fov, stretch, size))
    except ValueError as exc:
        raise HTTPException(422, str(exc))


@app.get("/api/diff")
def diff(ra: float = Query(...), dec: float = Query(...), ids: str = Query(...), fov: float = FOV_Q,
         op: str = Query("pair", pattern="^(pair|median|range)$"), a: Optional[str] = None,
         b: Optional[str] = None, size: int = Query(512, ge=48, le=1024), collection: str = COLL_Q):
    _coords(ra, dec)
    fr = _frames_for(ids, ra, dec, _collection(collection))
    try:
        return _png(analysis.diff_png(fr, ra, dec, fov, op, a, b, size))
    except ValueError as exc:
        raise HTTPException(422, str(exc))


@app.get("/api/candidates")
def candidates(ra: float = Query(...), dec: float = Query(...), ids: str = Query(...), fov: float = FOV_Q,
               threshold: float = Query(4.0, ge=2.0, le=20.0), collection: str = COLL_Q):
    _coords(ra, dec)
    fr = _frames_for(ids, ra, dec, _collection(collection))
    gaia = catalogs.gaia_stars(ra, dec, fov)
    try:
        res = analysis.candidates(fr, ra, dec, fov, gaia["stars"], threshold)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    res["gaia_crossmatch"] = gaia["error"] is None
    res["demo_mode"] = any(f.get("demo_mode") for f in fr)
    return res


@app.get("/api/export.gif")
def export_gif(ra: float = Query(...), dec: float = Query(...), ids: str = Query(...), fov: float = FOV_Q,
               stretch: str = STRETCH_Q, fps: float = Query(2.0, ge=0.2, le=20), flags: bool = False,
               size: int = Query(384, ge=128, le=768), collection: str = COLL_Q):
    _coords(ra, dec)
    fr = _frames_for(ids, ra, dec, _collection(collection))
    try:
        data = analysis.gif_bytes(fr, ra, dec, fov, stretch, fps, size, flags)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    name = f"openatlas_{ra:.4f}_{dec:+.4f}.gif"
    return Response(content=data, media_type="image/gif",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


# ---------------------------------------------------------------------------
# Catalogue overlays
# ---------------------------------------------------------------------------

@app.get("/api/gaia")
def gaia(ra: float = Query(...), dec: float = Query(...), fov: float = FOV_Q):
    _coords(ra, dec)
    return catalogs.gaia_stars(ra, dec, fov)


@app.get("/api/wise")
def wise(ra: float = Query(...), dec: float = Query(...), fov: float = FOV_Q):
    _coords(ra, dec)
    return catalogs.wise_sources(ra, dec, fov)


@app.get("/")
def root():
    return {"message": "OpenAtlas API v3 — visit /docs for Swagger UI"}
