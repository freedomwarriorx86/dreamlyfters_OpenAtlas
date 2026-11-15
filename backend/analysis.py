"""
Multi-frame analysis on the aligned grid: stacks, difference images, moving /
variable source candidates and animated GIF export.

Frames from different detectors sample different wavelengths and have very
different surface brightness, so every frame is first turned into a robust
z-score image ((img - median) / MAD-sigma) before it is combined.
"""

from __future__ import annotations

import io
import logging
import math
import warnings
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import numpy as np

import spherex as sx

DIFF_OPS = ("pair", "median", "range")
logger = logging.getLogger("openatlas.analysis")


def load_aligned(frames: list[dict], ra: float, dec: float, fov: float, workers: int = 6):
    """Aligned (img, flags) for each frame; frames that fail are skipped."""
    def one(f):
        try:
            img, fl, _ = sx.aligned(f, ra, dec, fov)
            return f, img, fl
        except Exception as exc:
            logger.warning("skipping frame %s: %s", f["id"], exc)
            return None
    with ThreadPoolExecutor(max_workers=workers) as ex:
        out = [r for r in ex.map(one, frames) if r is not None]
    return out


def zimage(img: np.ndarray, fl: np.ndarray | None = None, mask: bool = True) -> np.ndarray:
    z = img.astype(np.float32).copy()
    if mask and fl is not None:
        z[(fl & sx.MASK_BITS) != 0] = np.nan
    med, sig = sx.robust_stats(z)
    return (z - med) / sig


def _nanmedian(stack: list[np.ndarray]) -> np.ndarray:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return np.nanmedian(np.stack(stack), axis=0)


def stack_png(frames, ra, dec, fov, stretch="asinh", size=512) -> bytes:
    items = load_aligned(frames, ra, dec, fov)
    if not items:
        raise ValueError("no frames could be loaded")
    st = _nanmedian([zimage(img, fl) for _, img, fl in items])
    t = sx.normalize(st, stretch)
    return sx.to_png(sx.colorize(t, sx.SKY_LUT, ~np.isfinite(st)), size)


def diff_image(frames: list[dict], ra, dec, fov, op: str = "pair", a: str | None = None, b: str | None = None):
    """Return (D, meta). D is in units of combined sigma; positive = brighter in A / later."""
    items = load_aligned(sorted(frames, key=lambda f: f["mjd"]), ra, dec, fov)
    if len(items) < 2:
        raise ValueError("need at least two frames for a difference image")
    zs = {f["id"]: zimage(img, fl) for f, img, fl in items}
    by_id = {f["id"]: f for f, _, _ in items}
    ordered = [f for f, _, _ in items]
    if op == "pair":
        fa = by_id.get(a or "") or ordered[-1]
        fb = by_id.get(b or "")
        if fb is None or fb is fa:
            same = [f for f in ordered if f["detector"] == fa["detector"] and f is not fa]
            pool = same or [f for f in ordered if f is not fa]
            fb = min(pool, key=lambda f: f["mjd"])
        D = _scaled_diff(zs[fa["id"]], zs[fb["id"]])
        meta = {"a": fa["id"], "b": fb["id"], "a_utc": fa["utc"], "b_utc": fb["utc"],
                "same_detector": fa["detector"] == fb["detector"]}
    elif op == "median":
        fa = by_id.get(a or "") or ordered[-1]
        same = [f for f in ordered if f["detector"] == fa["detector"] and f is not fa]
        ref = same or [f for f in ordered if f is not fa]
        D = _scaled_diff(zs[fa["id"]], _nanmedian([zs[f["id"]] for f in ref]))
        meta = {"a": fa["id"], "a_utc": fa["utc"], "b": "median", "n_ref": len(ref),
                "same_detector": bool(same)}
    else:  # range: late half vs early half, computed per detector then combined
        split = float(np.median([f["mjd"] for f in ordered]))
        halves = _detector_halves(ordered, zs, split)
        if halves:
            D = _nanmean([_scaled_diff(L, E) for E, L in halves.values()])
        else:
            h = len(ordered) // 2
            D = _scaled_diff(_nanmedian([zs[f["id"]] for f in ordered[h:]]),
                             _nanmedian([zs[f["id"]] for f in ordered[:h]]))
        meta = {"a": "late", "b": "early", "split_utc": sx.mjd_to_utc(split),
                "detectors": sorted(halves), "same_detector": bool(halves)}
    _, sig = sx.robust_stats(D)
    return D / sig, meta


def _nanmean(stack: list[np.ndarray]) -> np.ndarray:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return np.nanmean(np.stack(stack), axis=0)


def _scaled_diff(A: np.ndarray, B: np.ndarray) -> np.ndarray:
    """A - k*B, with k matching source fluxes (frames sample slightly different wavelengths)."""
    return A - _flux_scale(A, B) * B


def _detector_halves(ordered: list[dict], zs: dict, split_mjd: float) -> dict[int, tuple[np.ndarray, np.ndarray]]:
    """{detector: (early median, late median)} for detectors observed on both sides of split_mjd."""
    out = {}
    for det in sorted({f["detector"] for f in ordered}):
        early = [zs[f["id"]] for f in ordered if f["detector"] == det and f["mjd"] < split_mjd]
        late = [zs[f["id"]] for f in ordered if f["detector"] == det and f["mjd"] >= split_mjd]
        if early and late:
            out[det] = (_nanmedian(early), _nanmedian(late))
    return out


def _flux_scale(A: np.ndarray, B: np.ndarray) -> float:
    m = np.isfinite(A) & np.isfinite(B) & (A > 8) & (B > 8)
    if m.sum() < 15:
        return 1.0
    return float(np.clip(np.median(A[m] / B[m]), 0.2, 5.0))


def diff_png(frames, ra, dec, fov, op="pair", a=None, b=None, size=512, limit=8.0) -> bytes:
    D, _ = diff_image(frames, ra, dec, fov, op, a, b)
    t = np.clip(D / (2 * limit) + 0.5, 0, 1)
    return sx.to_png(sx.colorize(np.nan_to_num(t, nan=0.5), sx.DIFF_LUT, ~np.isfinite(D)), size)


# ---------------------------------------------------------------------------
# Candidates
# ---------------------------------------------------------------------------

def _peaks(S: np.ndarray, thr: float, size: int, edge: int):
    from scipy.ndimage import maximum_filter
    Sf = np.nan_to_num(S, nan=-np.inf)
    mx = maximum_filter(Sf, size=size, mode="constant", cval=-np.inf)
    m = (Sf == mx) & (Sf > thr)
    m[:edge, :] = m[-edge:, :] = m[:, :edge] = m[:, -edge:] = False
    ys, xs = np.nonzero(m)
    order = np.argsort(-Sf[ys, xs])
    return [(int(xs[i]), int(ys[i]), float(Sf[ys[i], xs[i]])) for i in order]


def _centroid(S: np.ndarray, x: int, y: int, r: int = 2) -> tuple[float, float]:
    y0, y1 = max(0, y - r), min(S.shape[0], y + r + 1)
    x0, x1 = max(0, x - r), min(S.shape[1], x + r + 1)
    w = np.clip(np.nan_to_num(S[y0:y1, x0:x1]), 0, None)
    if w.sum() <= 0:
        return float(x), float(y)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    return float((w * xx).sum() / w.sum()), float((w * yy).sum() / w.sum())


def candidates(frames: list[dict], ra: float, dec: float, fov: float,
               gaia: list[dict] | None = None, threshold: float = 4.0, max_out: int = 20) -> dict[str, Any]:
    """
    Relative astrometry + photometry between early and late frames.

    1. Bright sources are found in the median stack of all frames.
    2. For every detector observed both before and after the median epoch, each
       source is centroided in that detector's early and late median images
       (same wavelength range, so colour does not fake motion or variability).
    3. Per detector, the common field shift (registration error) and the
       common flux ratio are removed; the residuals are averaged over detectors.
    4. A residual shift well above the field's astrometric scatter -> "mover";
       a flux change well above the field's photometric scatter -> "variable".
       Movers matched to Gaia DR3 stars with large proper motion -> "known mover".
    """
    frames = sorted(frames, key=lambda f: f["mjd"])
    if len(frames) < 4:
        return {"candidates": [], "count": 0, "note": "Select at least 4 frames to search for movers."}
    items = load_aligned(frames, ra, dec, fov)
    if len(items) < 4:
        return {"candidates": [], "count": 0, "note": "Fewer than 4 frames could be loaded."}
    frames = [f for f, _, _ in items]
    zs = {f["id"]: zimage(img, fl, mask=False) for f, img, fl in items}
    split = float(np.median([f["mjd"] for f in frames]))
    halves = _detector_halves(frames, zs, split)
    # flagged pixels (cosmic rays, ghosts, persistence...) removed for the difference search
    halves_masked = _detector_halves(frames, {f["id"]: zimage(img, fl, mask=True) for f, img, fl in items}, split)
    early = [f for f in frames if f["mjd"] < split]
    late = [f for f in frames if f["mjd"] >= split]
    t_early = float(np.median([f["mjd"] for f in early])) if early else frames[0]["mjd"]
    t_late = float(np.median([f["mjd"] for f in late])) if late else frames[-1]["mjd"]
    dt_yr = max((t_late - t_early) / 365.25, 1e-3)
    base = {"threshold_sigma": threshold, "dt_years": round(dt_yr, 3), "n_frames": len(frames),
            "n_early": len(early), "n_late": len(late), "detectors_compared": sorted(halves),
            "early_utc": sx.mjd_to_utc(t_early), "late_utc": sx.mjd_to_utc(t_late)}
    if not halves:
        return {**base, "candidates": [], "count": 0,
                "note": "No detector was observed both early and late in this selection. "
                        "Select more frames spread over time (same detector)."}

    S = _nanmedian(list(zs.values()))
    n = S.shape[0]
    scale = fov * 60 / n                       # arcsec per grid pixel
    native = sx.PIX_SCALE_ARCSEC / scale        # grid pixels per SPHEREx pixel
    r = max(2, int(round(1.2 * native)))
    peaks = _peaks(S, 8.0, 2 * r + 1, r + 2)[:150]
    if len(peaks) < 5:
        return {**base, "candidates": [], "count": 0, "n_sources": len(peaks),
                "note": "Too few bright sources in this field to calibrate astrometry. Try a larger field of view."}

    def flux(img, x, y):
        y0, y1 = max(0, int(y) - r), min(n, int(y) + r + 1)
        x0, x1 = max(0, int(x) - r), min(n, int(x) + r + 1)
        return float(np.nansum(np.clip(img[y0:y1, x0:x1], 0, None)))

    P = len(peaks)
    # per-detector residual shifts (arcsec, east/north) and log flux ratios
    res_e = np.full((len(halves), P), np.nan)
    res_n = np.full((len(halves), P), np.nan)
    res_q = np.full((len(halves), P), np.nan)
    pos_e = np.zeros((len(halves), P, 2))
    pos_l = np.zeros((len(halves), P, 2))
    for di, (E, L) in enumerate(halves.values()):
        for pi, (px, py, _) in enumerate(peaks):
            ex, ey = _centroid(E, px, py, r)
            lx, ly = _centroid(L, px, py, r)
            pos_e[di, pi] = (ex, ey)
            pos_l[di, pi] = (lx, ly)
            res_e[di, pi] = -(lx - ex) * scale     # east is towards smaller x
            res_n[di, pi] = (ly - ey) * scale
            fe, fl_ = flux(E, px, py), flux(L, px, py)
            if fe > 0 and fl_ > 0:
                res_q[di, pi] = math.log(fl_ / fe)
        for arr in (res_e, res_n, res_q):
            row = arr[di]
            if np.isfinite(row).sum() >= 3:
                arr[di] = row - np.nanmedian(row)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        mE, mN, mQ = (np.nanmean(a, axis=0) for a in (res_e, res_n, res_q))
        pe, pl = pos_e.mean(axis=0), pos_l.mean(axis=0)
    shift = np.hypot(mE, mN)
    scatter = max(1.4826 * float(np.nanmedian(shift)), 0.08 * sx.PIX_SCALE_ARCSEC)
    q_sig = max(1.4826 * float(np.nanmedian(np.abs(mQ))), 0.03)

    w = sx.target_wcs(ra, dec, fov, n)

    def world(x, y):
        a, d = w.pixel_to_world_values(x, y)
        return float(a), float(d)

    out = []
    for pi, (px, py, s) in enumerate(peaks):
        sh = float(shift[pi])
        sh_sig = sh / scatter if np.isfinite(sh) else 0.0
        q = float(mQ[pi]) if np.isfinite(mQ[pi]) else 0.0
        v_sig = abs(q) / q_sig
        ratio = math.exp(q)
        if sh_sig >= threshold and sh >= 0.25 * sx.PIX_SCALE_ARCSEC:
            status = "mover"
        elif v_sig >= threshold and abs(ratio - 1) >= 0.15:
            status = "variable"
        else:
            continue
        (ex, ey), (lx, ly) = pe[pi], pl[pi]
        a2, d2 = world(lx, ly)
        a1, d1 = world(ex, ey)
        out.append({
            "status": status, "ra": round(a2, 6), "dec": round(d2, 6),
            "from_ra": round(a1, 6), "from_dec": round(d1, 6),
            "fx": round((lx + 0.5) / n, 4), "fy": round(1 - (ly + 0.5) / n, 4),
            "from_fx": round((ex + 0.5) / n, 4), "from_fy": round(1 - (ey + 0.5) / n, 4),
            "snr": round(s, 1), "shift_arcsec": round(sh, 2), "shift_sigma": round(sh_sig, 1),
            "motion_arcsec_yr": round(sh / dt_yr, 2) if status == "mover" else None,
            "pa_deg": (round((math.degrees(math.atan2(float(mE[pi]), float(mN[pi]))) + 360) % 360, 1)
                       if status == "mover" else None),
            "flux_ratio": round(ratio, 3), "variability_sigma": round(v_sig, 1),
        })

    out.extend(_fast_movers(halves_masked, n, scale, native, fov, dt_yr, world, out))

    late_year = 2000.0 + (t_late - 51544.5) / 365.25
    if gaia:
        from catalogs import GAIA_EPOCH, propagate
        gpos = [(g, *propagate(g["ra"], g["dec"], g["pmra_masyr"], g["pmdec_masyr"], GAIA_EPOCH, late_year))
                for g in gaia]
        cosd = math.cos(math.radians(dec))

        def nearest(a, d):
            best = None
            for g, gra, gdec in gpos:
                sep = math.hypot((gra - a) * cosd, gdec - d) * 3600
                if sep < 1.5 * sx.PIX_SCALE_ARCSEC and (best is None or sep < best[1]):
                    best = (g, sep)
            return best[0] if best else None

        kept = []
        for c in out:
            g = nearest(c["ra"], c["dec"])
            if c.get("method") == "difference":
                # a "fast mover" whose start or end sits on a slow Gaia star is a residual of that
                # star (PSF / ghost differences between the two observing seasons), not a mover
                g0 = nearest(c["from_ra"], c["from_dec"])
                if any(x is not None and x["pm_total_masyr"] < 100 for x in (g, g0)):
                    continue
            if g:
                c["gaia_source_id"] = g["source_id"]
                c["gaia_pm_masyr"] = g["pm_total_masyr"]
                if c["status"] == "mover" and g["pm_total_masyr"] >= 200:
                    c["status"] = "known mover"
            kept.append(c)
        out = kept
    rank = {"mover": 0, "known mover": 1, "variable": 2}
    out.sort(key=lambda c: (rank.get(c["status"], 3),
                            -(c["variability_sigma"] if c["status"] == "variable" else c["shift_sigma"])))
    out = out[:max_out]
    for i, c in enumerate(out, 1):
        c["n"] = i
    return {**base, "candidates": out, "count": len(out), "n_sources": P,
            "astrometric_scatter_arcsec": round(scatter, 2), "photometric_scatter": round(q_sig, 3)}


def _fast_movers(halves, n, scale, native, fov, dt_yr, world, existing) -> list[dict]:
    """
    Objects that moved more than ~1.5 SPHEREx pixels between the early and late
    epochs vanish from the median stack, so they are searched for directly in the
    late-minus-early difference: a positive blob (late position) paired with a
    negative blob (early position), each present in one epoch only.

    To reject single-frame artefacts (cosmic rays, ghosts, persistence) both ends
    must be confirmed independently in at least two detectors.
    """
    if len(halves) < 2:
        return []
    Ds, Ls, Es = [], [], []
    for E, L in halves.values():
        Es_ = _flux_scale(L, E) * E
        d = L - Es_
        _, s = sx.robust_stats(d)
        Ds.append(d / s)
        Ls.append(L)
        Es.append(Es_)
    Dstack = np.stack(Ds)
    D = _nanmean(Ds)
    _, sig = sx.robust_stats(D)
    D = D / sig
    Lm, Em = _nanmean(Ls), _nanmean(Es)
    size = max(3, int(round(1.5 * native)))
    edge = max(2, n // 30)
    pos = _peaks(D, 6.0, size, edge)[:40]
    neg = _peaks(-D, 6.0, size, edge)[:40]
    min_sep = 1.5 * sx.PIX_SCALE_ARCSEC
    max_sep = min(fov * 60 * 0.6, 240.0)
    r = max(1, int(round(0.6 * native)))

    def box(img, x, y):
        return img[..., max(0, y - r):y + r + 1, max(0, x - r):x + r + 1]

    def val(img, x, y):
        v = box(img, x, y)
        return float(np.nanmax(v)) if np.isfinite(v).any() else float("nan")

    def confirmed(x, y, sign):
        per_det = box(Dstack, x, y).reshape(len(Ds), -1)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            best = np.nanmax(sign * per_det, axis=1)
        return int(np.sum(best > 3.0))

    taken = {(round(c["fx"], 2), round(c["fy"], 2)) for c in existing}
    used = set()
    out = []
    for (px, py, s) in pos:
        lp, ep = val(Lm, px, py), val(Em, px, py)
        if not (lp > 0 and ep < 0.35 * lp):        # must be absent early
            continue
        if confirmed(px, py, +1) < 2:
            continue
        best = None
        for j, (nx, ny, ns) in enumerate(neg):
            if j in used:
                continue
            sep = math.hypot(nx - px, ny - py) * scale
            if not (min_sep <= sep <= max_sep):
                continue
            en_j, ln_j = val(Em, nx, ny), val(Lm, nx, ny)
            if not (en_j > 0 and ln_j < 0.35 * en_j):    # must be absent late
                continue
            if not (1 / 3 <= lp / en_j <= 3):            # similar brightness at both ends
                continue
            if confirmed(nx, ny, -1) < 2:
                continue
            if best is None or sep < best[1]:
                best = (j, sep, en_j)
        if best is None:
            continue
        j, sep, en = best
        used.add(j)
        nx, ny, ns = neg[j]
        cx, cy = _centroid(D, px, py)
        ncx, ncy = _centroid(-D, nx, ny)
        fx, fy = round((cx + 0.5) / n, 4), round(1 - (cy + 0.5) / n, 4)
        if (round(fx, 2), round(fy, 2)) in taken:
            continue
        a2, d2 = world(cx, cy)
        a1, d1 = world(ncx, ncy)
        de = -(cx - ncx) * scale
        dn = (cy - ncy) * scale
        sh = math.hypot(de, dn)
        out.append({
            "status": "mover", "method": "difference", "ra": round(a2, 6), "dec": round(d2, 6),
            "from_ra": round(a1, 6), "from_dec": round(d1, 6), "fx": fx, "fy": fy,
            "from_fx": round((ncx + 0.5) / n, 4), "from_fy": round(1 - (ncy + 0.5) / n, 4),
            "snr": round(min(s, ns), 1), "shift_arcsec": round(sh, 2), "shift_sigma": round(min(s, ns), 1),
            "motion_arcsec_yr": round(sh / dt_yr, 2),
            "pa_deg": round((math.degrees(math.atan2(de, dn)) + 360) % 360, 1),
            "flux_ratio": round(lp / en, 3), "variability_sigma": 0.0,
            "detectors_confirmed": min(confirmed(px, py, +1), confirmed(nx, ny, -1)),
        })
    return out


# ---------------------------------------------------------------------------
# GIF export
# ---------------------------------------------------------------------------

def gif_bytes(frames: list[dict], ra, dec, fov, stretch="asinh", fps: float = 2.0, size: int = 384,
              show_flags: bool = False) -> bytes:
    from PIL import Image, ImageDraw
    frames = sorted(frames, key=lambda f: f["mjd"])[:60]
    items = load_aligned(frames, ra, dec, fov)
    if not items:
        raise ValueError("no frames could be loaded")
    imgs = []
    for f, img, fl in items:
        t = sx.normalize(img, stretch)
        rgb = sx.colorize(t, sx.SKY_LUT, ~np.isfinite(img))
        if show_flags:
            rgb = sx.overlay_flags(rgb, fl)
        im = Image.open(io.BytesIO(sx.to_png(rgb, size))).convert("RGB")
        d = ImageDraw.Draw(im)
        label = f"{f['utc'][:10]}  D{f['detector']}  {(f['wav_min_um'] + f['wav_max_um']) / 2:.2f} um"
        d.rectangle([6, 6, 12 + 6 * len(label), 22], fill=(6, 9, 18))
        d.text((9, 8), label, fill=(232, 238, 248))
        c = size // 2
        d.ellipse([c - 14, c - 14, c + 14, c + 14], outline=(94, 234, 212), width=1)
        imgs.append(im.convert("P", palette=Image.ADAPTIVE, colors=128))
    buf = io.BytesIO()
    imgs[0].save(buf, format="GIF", save_all=True, append_images=imgs[1:],
                 duration=int(1000 / max(0.2, min(fps, 20))), loop=0, disposal=2)
    return buf.getvalue()
