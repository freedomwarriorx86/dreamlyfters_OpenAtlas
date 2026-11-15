"""Gaia DR3 overlay queries for OpenAtlas."""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


async def get_gaia_stars(
    ra: float,
    dec: float,
    fov_deg: float = 0.5,
) -> dict[str, Any]:
    """
    Return Gaia DR3 stars within the FOV, with proper-motion arrows.
    Falls back to synthetic data when Gaia TAP is unreachable.
    """
    try:
        return await _query_gaia_tap(ra, dec, fov_deg)
    except Exception as exc:
        logger.warning("Gaia TAP failed: %s – using synthetic overlay", exc)
        return _synthetic_stars(ra, dec, fov_deg)


async def _query_gaia_tap(
    ra: float, dec: float, fov_deg: float
) -> dict[str, Any]:
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _gaia_tap_sync, ra, dec, fov_deg)


def _gaia_tap_sync(ra: float, dec: float, fov_deg: float) -> dict[str, Any]:
    from astroquery.gaia import Gaia

    radius_deg = fov_deg / 2.0

    adql = f"""
        SELECT TOP 150
            source_id, ra, dec,
            pmra, pmdec,
            phot_g_mean_mag,
            bp_rp,
            parallax
        FROM gaiadr3.gaia_source
        WHERE 1 = CONTAINS(
            POINT('ICRS', ra, dec),
            CIRCLE('ICRS', {ra}, {dec}, {radius_deg})
        )
        AND phot_g_mean_mag < 20
        ORDER BY phot_g_mean_mag
    """

    job = Gaia.launch_job(adql, verbose=False)
    table = job.get_results()

    stars = []
    for row in table:
        pmra = float(row["pmra"]) if row["pmra"] is not np.ma.masked else 0.0
        pmdec = float(row["pmdec"]) if row["pmdec"] is not np.ma.masked else 0.0
        gmag = float(row["phot_g_mean_mag"]) if row["phot_g_mean_mag"] is not np.ma.masked else 20.0
        bprp = float(row["bp_rp"]) if row["bp_rp"] is not np.ma.masked else 0.0
        stars.append({
            "source_id": str(row["source_id"]),
            "ra": float(row["ra"]),
            "dec": float(row["dec"]),
            "pm_ra_masyr": round(pmra, 2),
            "pm_dec_masyr": round(pmdec, 2),
            "pm_total_masyr": round(np.hypot(pmra, pmdec), 2),
            "g_mag": round(gmag, 2),
            "bp_rp": round(bprp, 3),
        })

    return {
        "stars": stars,
        "count": len(stars),
        "catalog": "Gaia DR3",
        "demo_mode": False,
    }


def _synthetic_stars(ra: float, dec: float, fov_deg: float) -> dict[str, Any]:
    rng = np.random.default_rng(int(abs(ra * 1e3 + dec * 1e3)) % (2**31))
    n = rng.integers(15, 50)
    half = fov_deg / 2
    stars = []
    for i in range(n):
        pmra = rng.uniform(-200, 200)
        pmdec = rng.uniform(-200, 200)
        stars.append({
            "source_id": str(1_000_000_000 + i),
            "ra": float(ra + rng.uniform(-half * 0.9, half * 0.9)),
            "dec": float(dec + rng.uniform(-half * 0.9, half * 0.9)),
            "pm_ra_masyr": round(float(pmra), 2),
            "pm_dec_masyr": round(float(pmdec), 2),
            "pm_total_masyr": round(float(np.hypot(pmra, pmdec)), 2),
            "g_mag": round(float(rng.uniform(8, 19)), 2),
            "bp_rp": round(float(rng.uniform(-0.3, 2.5)), 3),
        })
    return {
        "stars": stars,
        "count": len(stars),
        "catalog": "Gaia DR3 (demo)",
        "demo_mode": True,
    }
