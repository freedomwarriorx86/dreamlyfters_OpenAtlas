"""
SPHEREx data access and image processing for OpenAtlas.

Pipeline
  1. Discovery   IRSA SIA2 (collection spherex_dr1 / quick releases) -> one row per
                 exposure *and* detector. Frame id = "<obs_id>_D<detector>".
  2. Registry    every discovered frame is persisted to disk so /api/frame/<id>
                 keeps working across restarts.
  3. Cutouts     IRSA IBE cutout (?center=&size=) of a fixed 15' patch around the
                 target, cached as .npz (IMAGE, FLAGS, VARIANCE, WCS header,
                 per-pixel wavelength at the target).
  4. Alignment   each cutout is resampled (SIP-aware WCS) onto a common north-up
                 TAN grid centred on the target, so frames can be blinked,
                 stacked and differenced pixel by pixel.
  5. Products    PNG rendering (linear/asinh/log/zscale stretches, flag overlay,
                 flag masking), aperture photometry (light curve + spectrum).
  6. Fallback    clearly labelled synthetic demo frames when IRSA is unreachable.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import io
import json
import logging
import os
import re
import tempfile
import threading
import time
import warnings
from collections import OrderedDict
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger("openatlas.spherex")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SIA_URL = "https://irsa.ipac.caltech.edu/SIA"

COLLECTION_DR1 = "spherex_dr1"
COLLECTION_QR2 = "spherex_qr2"
COLLECTION_QR1 = "spherex_qr"
COLLECTIONS: dict[str, dict[str, str]] = {
    COLLECTION_DR1: {"label": "DR1", "description": "Released 13 Nov 2026 · uniformly reprocessed set"},
    COLLECTION_QR2: {"label": "Quick Release · QR2", "description": "Weekly releases · improved calibration"},
    COLLECTION_QR1: {"label": "Quick Release · QR1", "description": "Earlier calibration"},
}
DEFAULT_COLLECTION = COLLECTION_DR1

WAV_MIN_UM = 0.75
WAV_MAX_UM = 5.0
N_BANDS = 102
PIX_SCALE_ARCSEC = 6.15
OMEGA_PIX_SR = (PIX_SCALE_ARCSEC / 206264.806) ** 2

CUT_SIZE_DEG = 0.25          # one download per frame+target, cropped locally
MAX_FOV_ARCMIN = 15.0
MIN_FOV_ARCMIN = 0.5
GRID_N = 256                 # aligned grid size (pixels)

DETECTOR_RANGES_UM = {1: (0.75, 1.09), 2: (1.10, 1.62), 3: (1.63, 2.42),
                      4: (2.43, 3.82), 5: (3.83, 4.41), 6: (4.41, 5.00)}

QUERY_TTL_S = 6 * 3600

CACHE_DIR = Path(os.environ.get("OPENATLAS_CACHE_DIR") or Path(tempfile.gettempdir()) / "openatlas_cache")
for _sub in ("queries", "frames", "cutouts", "phot", "png"):
    (CACHE_DIR / _sub).mkdir(parents=True, exist_ok=True)

# SPHEREx L2 FLAGS planes (from the MSKN#### header keywords)
FLAG_BITS: dict[int, str] = {
    0: "TRANSIENT", 1: "OVERFLOW", 2: "SUR_ERROR", 6: "NONFUNC", 7: "DICHROIC",
    9: "MISSING_DATA", 10: "HOT", 11: "COLD", 12: "FULLSAMPLE", 14: "PHANMISS",
    15: "NONLINEAR", 17: "PERSIST", 19: "OUTLIER", 20: "CROSSTALK", 21: "SOURCE",
    22: "GHOST", 23: "GHOST_FPA", 24: "GHOST_EXT", 25: "STREAK", 26: "BLOOM",
    27: "SNOWBALL", 28: "HALO",
}
FLAG_CLASSES: list[dict[str, Any]] = [
    {"key": "contamination", "label": "Contamination", "detail": "ghosts, streaks, halos, blooms, crosstalk",
     "color": "#FFB86B", "bits": [20, 22, 23, 24, 25, 26, 27, 28]},
    {"key": "bad", "label": "Unreliable pixels", "detail": "hot, cold, overflow, missing, non-linear",
     "color": "#A78BFA", "bits": [1, 2, 6, 9, 10, 11, 14, 15]},
    {"key": "transient", "label": "Transients and persistence", "detail": "cosmic rays, outliers, persistent charge",
     "color": "#F9A8D4", "bits": [0, 17, 19]},
    {"key": "source", "label": "Known source", "detail": "pixel mapped to a catalogued source",
     "color": "#7DD3FC", "bits": [21]},
]
for _c in FLAG_CLASSES:
    _c["mask"] = int(sum(1 << b for b in _c["bits"]))
MASK_BITS = int(sum(c["mask"] for c in FLAG_CLASSES if c["key"] != "source"))
# FULLSAMPLE and SOURCE are informational (SOURCE is set on most pixels in DR1 cutouts)
REPORT_BITS = int(sum(1 << b for b in FLAG_BITS if b not in (12, 21)))
DEFAULT_OVERLAY = ("contamination", "bad", "transient")


class ArchiveError(RuntimeError):
    """IRSA could not be reached or returned something unusable."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _key(*parts: Any) -> str:
    return hashlib.md5("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


def safe_id(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", s)


def mjd_to_utc(mjd: float) -> str:
    try:
        t = _dt.datetime(1858, 11, 17) + _dt.timedelta(days=float(mjd))
        return t.strftime("%Y-%m-%dT%H:%M:%S")
    except Exception:
        return ""


def band_to_wavelength(band: int) -> float:
    b = max(1, min(int(band), N_BANDS))
    return round(WAV_MIN_UM + (WAV_MAX_UM - WAV_MIN_UM) * (b - 1) / (N_BANDS - 1), 3)


def detector_from_wav(wav_um: float) -> int:
    for det, (lo, hi) in DETECTOR_RANGES_UM.items():
        if wav_um <= hi:
            return det
    return 6


def clamp_fov(fov_arcmin: float) -> float:
    return float(min(MAX_FOV_ARCMIN, max(MIN_FOV_ARCMIN, fov_arcmin)))


def _atomic_write(path: Path, data: bytes) -> None:
    tmp = path.with_suffix(path.suffix + f".{os.getpid()}.{threading.get_ident()}.tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


class _LRU(OrderedDict):
    def __init__(self, maxsize: int):
        super().__init__()
        self.maxsize = maxsize
        self.lock = threading.Lock()

    def get_(self, k):
        with self.lock:
            if k in self:
                self.move_to_end(k)
                return self[k]
        return None

    def put(self, k, v):
        with self.lock:
            self[k] = v
            self.move_to_end(k)
            while len(self) > self.maxsize:
                self.popitem(last=False)


# ---------------------------------------------------------------------------
# Discovery + registry
# ---------------------------------------------------------------------------

_query_mem: dict[str, tuple[float, dict]] = {}
_registry: dict[str, dict] = {}
_registry_lock = threading.Lock()


def _parse_region(s: str) -> list[list[float]]:
    nums = re.findall(r"[-+]?\d+\.\d+(?:[eE][-+]?\d+)?", s or "")
    vals = [float(n) for n in nums]
    return [[round(vals[i], 5), round(vals[i + 1], 5)] for i in range(0, len(vals) - 1, 2)]


def _sia_query(ra: float, dec: float, collection: str) -> list[dict]:
    import requests
    from astropy.io.votable import parse_single_table

    params = {"COLLECTION": collection, "POS": f"CIRCLE {ra} {dec} 0.0005", "MAXREC": 5000}
    r = None
    for attempt in range(3):  # IRSA occasionally resets connections or answers 5xx
        try:
            r = requests.get(SIA_URL, params=params, timeout=(10, 60))
            if r.status_code >= 500:
                raise ArchiveError(f"IRSA returned {r.status_code}")
            r.raise_for_status()
            break
        except Exception as exc:
            if attempt == 2:
                raise ArchiveError(f"IRSA SIA query failed: {exc}") from exc
            time.sleep(1.5 * (attempt + 1))
    if b"<TR>" not in r.content:
        if b'value="ERROR"' in r.content:
            raise ArchiveError("IRSA SIA returned an error status")
        return []
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        tbl = parse_single_table(io.BytesIO(r.content)).to_table(use_names_over_ids=True)

    def col(row, name, default=None):
        try:
            v = row[name]
        except KeyError:
            return default
        if np.ma.is_masked(v):
            return default
        return v

    frames: list[dict] = []
    for row in tbl:
        subtype = str(col(row, "dataproduct_subtype", "science")).lower()
        if subtype not in ("science", ""):
            continue
        url = str(col(row, "access_url", "") or "")
        if not url:
            continue
        obs_id = str(col(row, "obs_id", ""))
        em_min = float(col(row, "em_min", WAV_MIN_UM * 1e-6)) * 1e6
        em_max = float(col(row, "em_max", WAV_MAX_UM * 1e-6)) * 1e6
        m = re.search(r"D(\d)", str(col(row, "energy_bandpassname", "")))
        det = int(m.group(1)) if m else detector_from_wav((em_min + em_max) / 2)
        t_min = float(col(row, "t_min", 0.0))
        t_max = float(col(row, "t_max", t_min))
        mjd = (t_min + t_max) / 2.0
        frames.append({
            "id": safe_id(f"{obs_id}_D{det}"),
            "obs_id": obs_id,
            "detector": det,
            "mjd": round(mjd, 6),
            "utc": mjd_to_utc(mjd),
            "wav_min_um": round(em_min, 4),
            "wav_max_um": round(em_max, 4),
            "exptime_s": round(float(col(row, "t_exptime", 0.0) or 0.0), 2),
            "region": _parse_region(str(col(row, "s_region", ""))),
            "access_url": url,
            "collection": str(col(row, "obs_collection", collection)),
            "demo_mode": False,
        })
    # de-duplicate (same exposure/detector listed twice) and sort by time
    uniq = {f["id"]: f for f in frames}
    return sorted(uniq.values(), key=lambda f: (f["mjd"], f["detector"]))


def _register(frames: list[dict]) -> None:
    with _registry_lock:
        for f in frames:
            _registry[f["id"]] = f
    for f in frames:
        if f.get("demo_mode"):
            continue
        p = CACHE_DIR / "frames" / f"{f['id']}.json"
        if not p.exists():
            try:
                _atomic_write(p, json.dumps(f).encode())
            except OSError as exc:
                logger.debug("could not persist frame %s: %s", f["id"], exc)


def query_frames(ra: float, dec: float, collection: str = DEFAULT_COLLECTION) -> dict:
    """Return {"frames": [...], "source": "irsa"|"cache"|"demo", "error": str|None}."""
    key = _key(collection, f"{ra:.4f}", f"{dec:.4f}")
    now = time.time()
    hit = _query_mem.get(key)
    if hit and hit[0] > now:
        return hit[1]

    path = CACHE_DIR / "queries" / f"{key}.json"
    if path.exists() and now - path.stat().st_mtime < QUERY_TTL_S:
        try:
            result = json.loads(path.read_text())
            _register(result["frames"])
            _query_mem[key] = (now + 600, result)
            return result
        except Exception:
            pass

    t0 = time.time()
    try:
        frames = _sia_query(ra, dec, collection)
        result = {"frames": frames, "source": "irsa", "demo_mode": False, "error": None,
                  "query_seconds": round(time.time() - t0, 2)}
        _atomic_write(path, json.dumps(result).encode())
        expiry = now + QUERY_TTL_S
    except ArchiveError as exc:
        logger.warning("%s", exc)
        if path.exists():  # stale cache beats demo data
            result = json.loads(path.read_text())
            result["source"] = "cache"
            result["error"] = str(exc)
        else:
            result = {"frames": synthetic_frames(ra, dec), "source": "demo", "demo_mode": True,
                      "error": str(exc), "query_seconds": round(time.time() - t0, 2)}
        expiry = now + 30  # retry IRSA soon
    _register(result["frames"])
    _query_mem[key] = (expiry, result)
    return result


def get_frame(fid: str, ra: float | None = None, dec: float | None = None,
              collection: str | None = None) -> dict | None:
    fid = safe_id(fid)
    f = _registry.get(fid)
    if f:
        return f
    p = CACHE_DIR / "frames" / f"{fid}.json"
    if p.exists():
        try:
            f = json.loads(p.read_text())
            _register([f])
            return f
        except Exception:
            pass
    if ra is None or dec is None:
        return None
    if fid.startswith("DEMO_"):
        _register(synthetic_frames(ra, dec))
        return _registry.get(fid)
    query_frames(ra, dec, collection or DEFAULT_COLLECTION)
    return _registry.get(fid)


# ---------------------------------------------------------------------------
# Cutouts
# ---------------------------------------------------------------------------

_dl_sem = threading.BoundedSemaphore(int(os.environ.get("OPENATLAS_DOWNLOADS", "4")))
_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()
_cut_mem = _LRU(256)


def _lock_for(name: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(name, threading.Lock())


def _cut_name(frame: dict, ra: float, dec: float) -> str:
    return safe_id(f"{frame['id']}_{ra:.4f}_{dec:.4f}")


def _download_cutout(frame: dict, ra: float, dec: float) -> dict:
    import requests
    from astropy.io import fits
    from astropy.wcs import WCS

    url = f"{frame['access_url']}?center={ra:.6f},{dec:.6f}&size={CUT_SIZE_DEG}"
    last: Exception | None = None
    content = b""
    for attempt in range(4):
        with _dl_sem:
            try:
                r = requests.get(url, timeout=(10, 90))
                if r.status_code in (429, 500, 502, 503, 504):
                    raise ArchiveError(f"IRSA returned {r.status_code}")
                r.raise_for_status()
                content = r.content
                break
            except Exception as exc:
                last = exc
        time.sleep(2.0 * (attempt + 1))  # back off outside the semaphore
    if not content:
        raise ArchiveError(f"cutout download failed for {frame['id']}: {last}")

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with fits.open(io.BytesIO(content)) as h:
            names = [x.name for x in h]
            if "IMAGE" not in names:
                raise ArchiveError(f"cutout for {frame['id']} has no IMAGE extension")
            img = np.asarray(h["IMAGE"].data, dtype=np.float32)
            hdr = h["IMAGE"].header
            flags = (np.asarray(h["FLAGS"].data, dtype=np.int32) if "FLAGS" in names
                     else np.zeros(img.shape, np.int32))
            var = (np.asarray(h["VARIANCE"].data, dtype=np.float32) if "VARIANCE" in names
                   else np.full(img.shape, np.nan, np.float32))
            wl, bw = (frame["wav_min_um"] + frame["wav_max_um"]) / 2, float("nan")
            try:
                x, y = WCS(hdr).all_world2pix([[ra, dec]], 0)[0]
                ww = WCS(hdr, fobj=h, key="W")
                wl, bw = (float(v) for v in ww.pixel_to_world_values(x, y))
            except Exception as exc:
                logger.debug("wavelength WCS failed for %s: %s", frame["id"], exc)
            mjd = float(hdr.get("MJD-AVG", frame["mjd"]))
            # keep only the celestial WCS cards (drop the bulky/irrelevant ones)
            wh = WCS(hdr).to_header(relax=True)
            if "A_ORDER" in wh:
                for k in ("CTYPE1", "CTYPE2"):
                    if not str(wh.get(k, "")).endswith("-SIP"):
                        wh[k] = str(wh[k]) + "-SIP"
            hdr_str = wh.tostring()
    return {"image": img, "flags": flags, "variance": var, "header": hdr_str,
            "wave": np.array([wl, bw], dtype=np.float64), "mjd": mjd}


def get_cutout(frame: dict, ra: float, dec: float) -> dict:
    """Cached cutout dict with a ready astropy WCS under key 'wcs'."""
    from astropy.io import fits
    from astropy.wcs import WCS

    name = _cut_name(frame, ra, dec)
    c = _cut_mem.get_(name)
    if c is not None:
        return c
    path = CACHE_DIR / "cutouts" / f"{name}.npz"
    with _lock_for(name):
        c = _cut_mem.get_(name)
        if c is not None:
            return c
        if path.exists():
            with np.load(path, allow_pickle=False) as z:
                data = {k: z[k] for k in z.files}
            data["header"] = str(data["header"])
            data["mjd"] = float(data["mjd"])
        else:
            data = _download_cutout(frame, ra, dec)
            buf = io.BytesIO()
            np.savez_compressed(buf, image=data["image"], flags=data["flags"], variance=data["variance"],
                                header=np.array(data["header"]), wave=data["wave"], mjd=np.array(data["mjd"]))
            _atomic_write(path, buf.getvalue())
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            data["wcs"] = WCS(fits.Header.fromstring(data["header"]))
        _cut_mem.put(name, data)
        return data


def is_cached(frame: dict, ra: float, dec: float) -> bool:
    if frame.get("demo_mode"):
        return True
    name = _cut_name(frame, ra, dec)
    return _cut_mem.get_(name) is not None or (CACHE_DIR / "cutouts" / f"{name}.npz").exists()


# ---------------------------------------------------------------------------
# Alignment onto a common north-up grid
# ---------------------------------------------------------------------------

def target_wcs(ra: float, dec: float, fov_arcmin: float, n: int = GRID_N):
    from astropy.wcs import WCS
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [ra, dec]
    w.wcs.crpix = [n / 2 + 0.5, n / 2 + 0.5]
    s = fov_arcmin / 60.0 / n
    w.wcs.cdelt = [-s, s]
    return w


@lru_cache(maxsize=64)
def _grid_world(ra: float, dec: float, fov_arcmin: float, n: int):
    w = target_wcs(ra, dec, fov_arcmin, n)
    yy, xx = np.mgrid[0:n, 0:n]
    wra, wdec = w.pixel_to_world_values(xx.ravel(), yy.ravel())
    return np.asarray(wra), np.asarray(wdec)


_aligned_mem = _LRU(160)


def aligned(frame: dict, ra: float, dec: float, fov_arcmin: float, n: int = GRID_N):
    """(image, flags, variance) on the target grid. Row 0 = south, column 0 = east."""
    fov_arcmin = clamp_fov(fov_arcmin)
    k = (frame["id"], round(ra, 4), round(dec, 4), round(fov_arcmin, 3), n)
    hit = _aligned_mem.get_(k)
    if hit is not None:
        return hit
    if frame.get("demo_mode"):
        out = _synthetic_aligned(frame, ra, dec, fov_arcmin, n)
    else:
        from scipy.ndimage import map_coordinates
        c = get_cutout(frame, ra, dec)
        wra, wdec = _grid_world(round(ra, 6), round(dec, 6), round(fov_arcmin, 4), n)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                sx, sy = c["wcs"].all_world2pix(wra, wdec, 0, quiet=True)
            except Exception:
                sx, sy = c["wcs"].wcs_world2pix(wra, wdec, 0)
        coords = np.vstack([sy, sx])
        img = map_coordinates(c["image"], coords, order=1, mode="constant", cval=np.nan).reshape(n, n)
        var = map_coordinates(c["variance"], coords, order=1, mode="constant", cval=np.nan).reshape(n, n)
        fl = map_coordinates(c["flags"].astype(np.float64), coords, order=0, mode="constant",
                             cval=0).reshape(n, n).astype(np.int64)
        out = (img.astype(np.float32), fl, var.astype(np.float32))
    _aligned_mem.put(k, out)
    return out


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _lut(stops: list[tuple[float, str]]) -> np.ndarray:
    xs = np.array([s[0] for s in stops])
    cols = np.array([_hex(s[1]) for s in stops], dtype=float)
    t = np.linspace(0, 1, 256)
    return np.stack([np.interp(t, xs, cols[:, i]) for i in range(3)], axis=1).astype(np.uint8)


SKY_LUT = _lut([(0.0, "#04070d"), (0.18, "#0d1730"), (0.42, "#1f3b66"), (0.72, "#5EEAD4"), (1.0, "#ffffff")])
# dark plateau around zero so ±1–2σ noise stays quiet; real changes saturate to violet/orange
DIFF_LUT = _lut([(0.0, "#F5F3FF"), (0.14, "#A78BFA"), (0.36, "#151a36"), (0.5, "#0b1426"),
                 (0.64, "#261a10"), (0.86, "#FFB86B"), (1.0, "#FFF7ED")])
NAN_RGB = np.array(_hex("#060b16"), dtype=np.uint8)
STRETCHES = ("linear", "asinh", "log", "zscale", "percentile")


def robust_stats(img: np.ndarray) -> tuple[float, float]:
    f = img[np.isfinite(img)]
    if f.size < 8:
        return 0.0, 1.0
    med = float(np.median(f))
    mad = float(np.median(np.abs(f - med))) * 1.4826
    if not np.isfinite(mad) or mad <= 0:
        mad = float(np.std(f)) or 1.0
    return med, mad


def normalize(img: np.ndarray, stretch: str = "asinh") -> np.ndarray:
    f = img[np.isfinite(img)]
    if f.size < 8:
        return np.zeros(img.shape, np.float32)
    med, sig = robust_stats(img)
    if stretch == "zscale":
        try:
            from astropy.visualization import ZScaleInterval
            vmin, vmax = ZScaleInterval().get_limits(f)
        except Exception:
            vmin, vmax = np.percentile(f, [1, 99])
    elif stretch == "linear":
        vmin, vmax = np.percentile(f, [1.0, 99.5])
    elif stretch == "percentile":
        vmin, vmax = np.percentile(f, [0.5, 99.8])
    else:  # asinh, log: fixed sigma range so saturated stars do not crush faint sources
        vmin = med - 1.0 * sig
        vmax = min(float(np.percentile(f, 99.9)), med + 150.0 * sig)
        vmax = max(vmax, med + 20.0 * sig)
    if not vmax > vmin:
        vmax = vmin + 1.0
    t = np.clip((img - vmin) / (vmax - vmin), 0.0, 1.0)
    if stretch == "asinh":
        t = np.arcsinh(t * 12.0) / np.arcsinh(12.0)
    elif stretch == "log":
        t = np.log10(1.0 + 999.0 * t) / 3.0
    return np.nan_to_num(t, nan=0.0).astype(np.float32)


def colorize(t: np.ndarray, lut: np.ndarray, nanmask: np.ndarray | None = None) -> np.ndarray:
    rgb = lut[np.clip((t * 255).astype(np.int32), 0, 255)]
    if nanmask is not None:
        rgb[nanmask] = NAN_RGB
    return rgb


def overlay_flags(rgb: np.ndarray, flags: np.ndarray, classes=DEFAULT_OVERLAY) -> np.ndarray:
    out = rgb.astype(np.float32)
    for c in reversed(FLAG_CLASSES):
        if c["key"] not in classes:
            continue
        m = (flags & c["mask"]) != 0
        if m.any():
            out[m] = 0.4 * out[m] + 0.6 * np.array(_hex(c["color"]), dtype=np.float32)
    return out.astype(np.uint8)


def to_png(rgb: np.ndarray, size: int = 512, flip: bool = True) -> bytes:
    from PIL import Image
    arr = np.flipud(rgb) if flip else rgb
    im = Image.fromarray(np.ascontiguousarray(arr), "RGB")
    if size and size != im.width:
        im = im.resize((size, size), Image.BICUBIC if size > im.width else Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="PNG", compress_level=6)
    return buf.getvalue()


def render_frame(frame: dict, ra: float, dec: float, fov_arcmin: float, stretch: str = "asinh",
                 show_flags: bool = False, mask_flags: bool = False, size: int = 512) -> bytes:
    fov_arcmin = clamp_fov(fov_arcmin)
    stretch = stretch if stretch in STRETCHES else "asinh"
    size = int(min(1024, max(48, size)))
    ck = _key(frame["id"], f"{ra:.4f}", f"{dec:.4f}", f"{fov_arcmin:.3f}", stretch, show_flags, mask_flags, size, "v3")
    cfile = CACHE_DIR / "png" / f"{ck}.png"
    if cfile.exists() and not frame.get("demo_mode"):
        return cfile.read_bytes()
    img, fl, _ = aligned(frame, ra, dec, fov_arcmin)
    if mask_flags:
        img = img.copy()
        img[(fl & MASK_BITS) != 0] = np.nan
    t = normalize(img, stretch)
    rgb = colorize(t, SKY_LUT, ~np.isfinite(img))
    if show_flags:
        rgb = overlay_flags(rgb, fl)
    png = to_png(rgb, size)
    if not frame.get("demo_mode"):
        try:
            _atomic_write(cfile, png)
        except OSError:
            pass
    return png


def frame_values(frame: dict, ra: float, dec: float, fov_arcmin: float, n: int = 128) -> np.ndarray:
    """Aligned image block-averaged to n x n, display orientation (row 0 = north)."""
    img, _, _ = aligned(frame, ra, dec, fov_arcmin)
    f = GRID_N // n
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        small = np.nanmean(img[: n * f, : n * f].reshape(n, f, n, f), axis=(1, 3))
    return np.flipud(small).astype(np.float32)


# ---------------------------------------------------------------------------
# Photometry (light curve + spectrum)
# ---------------------------------------------------------------------------

AP_RADIUS_PX = 2.0
ANN_IN_PX, ANN_OUT_PX = 4.0, 7.0
# pixels left out of the aperture sum: cosmic rays/outliers, dead/hot/cold and missing pixels
PHOT_MASK = (1 << 0) | (1 << 19) | (1 << 9) | (1 << 6) | (1 << 10) | (1 << 11)


def flag_names(bits: int) -> list[str]:
    return [name for b, name in FLAG_BITS.items() if (REPORT_BITS >> b) & 1 and bits & (1 << b)]


def photometry(frame: dict, ra: float, dec: float) -> dict:
    base = {"id": frame["id"], "mjd": frame["mjd"], "utc": frame["utc"], "detector": frame["detector"],
            "wav_min_um": frame["wav_min_um"], "wav_max_um": frame["wav_max_um"],
            "demo_mode": bool(frame.get("demo_mode"))}
    if frame.get("demo_mode"):
        return {**base, **_synthetic_phot(frame, ra, dec)}

    name = _cut_name(frame, ra, dec)
    pfile = CACHE_DIR / "phot" / f"{name}_v2.json"
    if pfile.exists():
        try:
            return {**base, **json.loads(pfile.read_text())}
        except Exception:
            pass

    c = get_cutout(frame, ra, dec)
    img, var, fl = c["image"], c["variance"], c["flags"]
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        x, y = c["wcs"].all_world2pix([[ra, dec]], 0)[0]
    res: dict[str, Any] = {"wavelength_um": round(float(c["wave"][0]), 4),
                           "bandwidth_um": (None if not np.isfinite(c["wave"][1]) else round(float(c["wave"][1]), 4)),
                           "mjd": round(float(c["mjd"]), 6), "x": float(x), "y": float(y)}
    res["utc"] = mjd_to_utc(res["mjd"])
    h, w = img.shape
    if not (0 <= x < w and 0 <= y < h):
        res.update(flux_ujy=None, err_ujy=None, snr=None, flags=[], note="target outside cutout")
    else:
        yy, xx = np.indices(img.shape)
        r = np.hypot(xx - x, yy - y)
        ap = r <= AP_RADIUS_PX
        ann = (r >= ANN_IN_PX) & (r <= ANN_OUT_PX) & np.isfinite(img) & ((fl & MASK_BITS) == 0)
        good = ap & np.isfinite(img) & ((fl & PHOT_MASK) == 0)
        if good.sum() < 0.5 * ap.sum() or good.sum() < 3 or ann.sum() < 8:
            res.update(flux_ujy=None, err_ujy=None, snr=None, flags=[], note="not enough valid pixels")
        else:
            bkg = float(np.median(img[ann]))
            bkg_sig = float(np.std(img[ann]))
            n_ap = float(ap.sum())
            flux = float(np.sum(img[good] - bkg)) * n_ap / float(good.sum())
            v = var[good]
            v = v[np.isfinite(v)]
            var_sum = float(np.sum(v)) * n_ap / max(1.0, float(v.size)) if v.size else 0.0
            err = float(np.sqrt(max(var_sum, 0.0) + (n_ap * bkg_sig) ** 2 / ann.sum()))
            k = OMEGA_PIX_SR * 1e12  # MJy/sr * sr -> uJy
            bits = int(np.bitwise_or.reduce(fl[ap].ravel())) & REPORT_BITS
            res.update(flux_ujy=round(flux * k, 3), err_ujy=round(err * k, 3),
                       snr=round(flux / err, 2) if err > 0 else None, flags=flag_names(bits),
                       background_mjysr=round(bkg, 5))
    try:
        _atomic_write(pfile, json.dumps(res).encode())
    except OSError:
        pass
    return {**base, **res}


# ---------------------------------------------------------------------------
# Synthetic demo data (only when IRSA is unreachable; always labelled)
# ---------------------------------------------------------------------------

def synthetic_frames(ra: float, dec: float, n: int = 24) -> list[dict]:
    base = 60796.0  # 2025-05-01
    frames = []
    for i in range(n):
        det = i % 6 + 1
        lo, hi = DETECTOR_RANGES_UM[det]
        mjd = base + i * 365.0 / n + (det - 1) * 0.01
        frames.append({
            "id": f"DEMO_{_key(round(ra, 4), round(dec, 4))}_{i:02d}_D{det}",
            "obs_id": f"DEMO_{i:02d}", "detector": det, "mjd": round(mjd, 6), "utc": mjd_to_utc(mjd),
            "wav_min_um": lo, "wav_max_um": hi, "exptime_s": 113.6, "region": [],
            "access_url": "", "collection": "demo", "demo_mode": True,
        })
    return frames


def _synthetic_field(ra: float, dec: float):
    rng = np.random.default_rng(int(abs(ra * 1e4 + dec * 1e4)) % (2**31))
    n = 500
    half = CUT_SIZE_DEG * 3600 / 2
    de = rng.uniform(-half, half, n)
    dn = rng.uniform(-half, half, n)
    amp = rng.pareto(1.6, n) * 0.4 + 0.05
    return de, dn, amp


def _synthetic_aligned(frame: dict, ra: float, dec: float, fov_arcmin: float, n: int):
    scale = fov_arcmin * 60 / n  # arcsec / px
    de, dn, amp = _synthetic_field(ra, dec)
    dt_yr = (frame["mjd"] - 60796.0) / 365.25
    # one obvious mover so blink / difference / candidates have something to find
    de = np.append(de, -25.0 + 28.0 * dt_yr)
    dn = np.append(dn, 6.0 + 10.0 * dt_yr)
    amp = np.append(amp, 1.2)
    c = (n - 1) / 2
    xs = c - de / scale
    ys = c + dn / scale
    sig = max(0.7, 0.55 * PIX_SCALE_ARCSEC / scale)
    rng = np.random.default_rng(abs(hash(frame["id"])) % (2**31))
    img = rng.normal(0.18, 0.02, (n, n)).astype(np.float32)
    yy, xx = np.mgrid[0:n, 0:n]
    keep = (xs > -4 * sig) & (xs < n + 4 * sig) & (ys > -4 * sig) & (ys < n + 4 * sig)
    for x0, y0, a in zip(xs[keep], ys[keep], amp[keep]):
        x0i, y0i, r = int(x0), int(y0), int(5 * sig) + 1
        sl = (slice(max(0, y0i - r), min(n, y0i + r + 1)), slice(max(0, x0i - r), min(n, x0i + r + 1)))
        img[sl] += a * np.exp(-((xx[sl] - x0) ** 2 + (yy[sl] - y0) ** 2) / (2 * sig ** 2))
    fl = np.zeros((n, n), np.int64)
    hot = rng.integers(0, n, (6, 2))
    fl[hot[:, 0], hot[:, 1]] |= 1 << 10
    fl[int(n * 0.7):int(n * 0.78), int(n * 0.15):int(n * 0.3)] |= 1 << 22
    var = np.full((n, n), 0.02 ** 2, np.float32)
    return img, fl, var


def _synthetic_phot(frame: dict, ra: float, dec: float) -> dict:
    wl = (frame["wav_min_um"] + frame["wav_max_um"]) / 2
    temp = 450.0
    bb = 1.0 / (wl ** 5 * (np.exp(14388.0 / (wl * temp)) - 1.0))
    bb /= 1.0 / (4.5 ** 5 * (np.exp(14388.0 / (4.5 * temp)) - 1.0))
    var = 1.0 + 0.08 * np.sin(frame["mjd"] / 23.0)
    flux = 120.0 * bb * var + 2.0
    return {"wavelength_um": round(wl, 4), "bandwidth_um": None, "flux_ujy": round(float(flux), 3),
            "err_ujy": round(float(0.05 * flux + 0.5), 3), "snr": round(float(flux / (0.05 * flux + 0.5)), 2),
            "flags": [], "x": None, "y": None}
