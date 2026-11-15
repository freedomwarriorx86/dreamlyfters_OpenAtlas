"""
Catalogue access for OpenAtlas: name resolution (Sesame), Gaia DR3 and AllWISE.

All queries go through VizieR/Sesame mirrors (CfA first, then CDS), with short
timeouts and on-disk caching. Nothing here returns made-up sources: when every
mirror fails the caller gets an empty list plus an "error" string.
"""

from __future__ import annotations

import json
import logging
import math
import time
import xml.etree.ElementTree as ET
from typing import Any
from urllib.parse import quote

from spherex import CACHE_DIR, _atomic_write, _key

logger = logging.getLogger("openatlas.catalogs")

VIZIER_MIRRORS = ["https://vizier.cfa.harvard.edu", "https://vizier.cds.unistra.fr"]
SESAME_MIRRORS = ["https://vizier.cfa.harvard.edu/viz-bin/nph-sesame",
                  "https://cds.unistra.fr/cgi-bin/nph-sesame"]
CAT_DIR = CACHE_DIR / "catalogs"
CAT_DIR.mkdir(parents=True, exist_ok=True)
CAT_TTL_S = 7 * 24 * 3600

# Epoch the viewer centres on by default (middle of SPHEREx DR1 coverage)
DEFAULT_EPOCH = 2026.0
GAIA_EPOCH = 2016.0
ALLWISE_EPOCH = 2010.5


def propagate(ra: float, dec: float, pmra_masyr: float, pmdec_masyr: float,
              from_epoch: float, to_epoch: float) -> tuple[float, float]:
    """Linear proper-motion propagation (pmra includes cos(dec))."""
    dt = to_epoch - from_epoch
    cosd = max(1e-6, math.cos(math.radians(dec)))
    return (ra + pmra_masyr * dt / 3.6e6 / cosd) % 360.0, dec + pmdec_masyr * dt / 3.6e6


# ---------------------------------------------------------------------------
# Name resolution
# ---------------------------------------------------------------------------

def resolve(name: str, epoch: float = DEFAULT_EPOCH) -> dict[str, Any]:
    import requests

    name = name.strip()
    ck = CAT_DIR / f"sesame_{_key(name.lower())}.json"
    data: dict[str, Any] | None = None
    if ck.exists():
        try:
            data = json.loads(ck.read_text())
        except Exception:
            data = None
    errors = []
    if data is None:
        for base in SESAME_MIRRORS:
            try:
                r = requests.get(f"{base}/-oxp/SNV?{quote(name)}", timeout=(5, 15))
                r.raise_for_status()
                data = _parse_sesame(r.text)
                if data:
                    _atomic_write(ck, json.dumps(data).encode())
                    break
                errors.append(f"{base}: not found")
            except Exception as exc:
                errors.append(f"{base}: {exc}")
    if not data:
        raise LookupError(f"Could not resolve '{name}'. " + "; ".join(errors[-1:]))

    ra, dec = data["ra_j2000"], data["dec_j2000"]
    pmra, pmdec = data.get("pmra_masyr"), data.get("pmdec_masyr")
    if pmra is not None and pmdec is not None:
        ra, dec = propagate(ra, dec, pmra, pmdec, 2000.0, epoch)
    return {**data, "name": name, "ra": round(ra, 6), "dec": round(dec, 6), "epoch": epoch,
            "ra_hms": _hms(ra), "dec_dms": _dms(dec)}


def _parse_sesame(text: str) -> dict[str, Any] | None:
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return None
    for res in root.iter("Resolver"):
        ra = res.findtext("jradeg")
        dec = res.findtext("jdedeg")
        if not ra or not dec:
            continue
        out: dict[str, Any] = {"ra_j2000": float(ra), "dec_j2000": float(dec),
                               "otype": res.findtext("otype") or "",
                               "resolver": res.get("name", "")}
        pm = res.find("pm")
        if pm is not None and pm.findtext("pmRA") and pm.findtext("pmDE"):
            out["pmra_masyr"] = float(pm.findtext("pmRA"))
            out["pmdec_masyr"] = float(pm.findtext("pmDE"))
        oname = res.findtext("oname")
        if oname:
            out["canonical"] = oname
        return out
    return None


def _hms(ra: float) -> str:
    h = ra / 15.0
    hh = int(h)
    mm = int((h - hh) * 60)
    ss = ((h - hh) * 60 - mm) * 60
    return f"{hh:02d}h{mm:02d}m{ss:05.2f}s"


def _dms(dec: float) -> str:
    sign = "-" if dec < 0 else "+"
    d = abs(dec)
    dd = int(d)
    mm = int((d - dd) * 60)
    ss = ((d - dd) * 60 - mm) * 60
    return f"{sign}{dd:02d}°{mm:02d}′{ss:04.1f}″"


# ---------------------------------------------------------------------------
# VizieR cone search
# ---------------------------------------------------------------------------

def _num(v: str) -> float | None:
    v = v.strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def vizier_cone(source: str, ra: float, dec: float, radius_arcmin: float, columns: list[str],
                sort: str | None = None, max_rows: int = 400) -> tuple[list[dict[str, str]], str | None]:
    import requests

    ck = CAT_DIR / f"viz_{_key(source, f'{ra:.4f}', f'{dec:.4f}', f'{radius_arcmin:.2f}', ','.join(columns), max_rows)}.json"
    if ck.exists() and time.time() - ck.stat().st_mtime < CAT_TTL_S:
        try:
            return json.loads(ck.read_text()), None
        except Exception:
            pass
    params = {"-source": source, "-c": f"{ra:.6f} {dec:+.6f}", "-c.rm": f"{radius_arcmin:.3f}",
              "-out": ",".join(columns), "-out.max": str(max_rows)}
    if sort:
        params["-sort"] = sort
    last = None
    for base in VIZIER_MIRRORS:
        try:
            r = requests.get(f"{base}/viz-bin/asu-tsv", params=params, timeout=(5, 25))
            r.raise_for_status()
            if "text/tab-separated-values" not in r.headers.get("content-type", "") and "\t" not in r.text:
                raise ValueError("unexpected response")
            rows = _parse_tsv(r.text)
            _atomic_write(ck, json.dumps(rows).encode())
            return rows, None
        except Exception as exc:
            last = f"{base}: {exc}"
            logger.warning("VizieR %s failed via %s", source, last)
    return [], last


def _parse_tsv(text: str) -> list[dict[str, str]]:
    lines = [ln for ln in text.splitlines() if ln and not ln.startswith("#")]
    if len(lines) < 3:
        return []
    header = [h.strip() for h in lines[0].split("\t")]
    rows = []
    for ln in lines[3:]:  # skip units + dashes rows
        if ln.startswith("-") or not ln.strip():
            continue
        vals = ln.split("\t")
        rows.append({h: (vals[i] if i < len(vals) else "") for i, h in enumerate(header)})
    return rows


def gaia_stars(ra: float, dec: float, fov_arcmin: float) -> dict[str, Any]:
    radius = fov_arcmin / 2 * math.sqrt(2)
    rows, err = vizier_cone("I/355/gaiadr3", ra, dec, radius,
                            ["Source", "RA_ICRS", "DE_ICRS", "pmRA", "pmDE", "Plx", "Gmag", "BP-RP"],
                            sort="Gmag", max_rows=400)
    stars = []
    for r in rows:
        ra_, dec_ = _num(r.get("RA_ICRS", "")), _num(r.get("DE_ICRS", ""))
        if ra_ is None or dec_ is None:
            continue
        pmra, pmdec = _num(r.get("pmRA", "")) or 0.0, _num(r.get("pmDE", "")) or 0.0
        stars.append({"source_id": r.get("Source", "").strip(), "ra": ra_, "dec": dec_,
                      "pmra_masyr": pmra, "pmdec_masyr": pmdec,
                      "pm_total_masyr": round(math.hypot(pmra, pmdec), 2),
                      "parallax_mas": _num(r.get("Plx", "")), "g_mag": _num(r.get("Gmag", "")),
                      "bp_rp": _num(r.get("BP-RP", ""))})
    return {"stars": stars, "count": len(stars), "catalog": "Gaia DR3", "epoch": GAIA_EPOCH, "error": err}


def wise_sources(ra: float, dec: float, fov_arcmin: float) -> dict[str, Any]:
    radius = fov_arcmin / 2 * math.sqrt(2)
    rows, err = vizier_cone("II/328/allwise", ra, dec, radius,
                            ["AllWISE", "RAJ2000", "DEJ2000", "W1mag", "W2mag", "W3mag", "W4mag", "ccf", "ex"],
                            sort="W1mag", max_rows=400)
    sources = []
    for r in rows:
        ra_, dec_ = _num(r.get("RAJ2000", "")), _num(r.get("DEJ2000", ""))
        if ra_ is None or dec_ is None:
            continue
        sources.append({"designation": r.get("AllWISE", "").strip(), "ra": ra_, "dec": dec_,
                        "w1": _num(r.get("W1mag", "")), "w2": _num(r.get("W2mag", "")),
                        "w3": _num(r.get("W3mag", "")), "w4": _num(r.get("W4mag", "")),
                        "cc_flags": r.get("ccf", "").strip(), "ext_flg": _num(r.get("ex", ""))})
    return {"sources": sources, "count": len(sources), "catalog": "AllWISE", "epoch": ALLWISE_EPOCH, "error": err}
