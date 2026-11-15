"""WISE/NEOWISE source overlay queries for OpenAtlas."""

from __future__ import annotations

import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


async def get_wise_sources(
    ra: float,
    dec: float,
    fov_deg: float = 0.5,
) -> dict[str, Any]:
    """
    Return AllWISE / NEOWISE sources within the FOV.
    Falls back to synthetic data when IRSA TAP is unreachable.
    """
    try:
        return await _query_wise_tap(ra, dec, fov_deg)
    except Exception as exc:
        logger.warning("WISE TAP failed: %s – using synthetic overlay", exc)
        return _synthetic_sources(ra, dec, fov_deg)


async def _query_wise_tap(
    ra: float, dec: float, fov_deg: float
) -> dict[str, Any]:
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _wise_tap_sync, ra, dec, fov_deg)


def _wise_tap_sync(ra: float, dec: float, fov_deg: float) -> dict[str, Any]:
    import pyvo

    service = pyvo.dal.TAPService("https://irsa.ipac.caltech.edu/TAP")
    radius_deg = fov_deg / 2.0

    adql = f"""
        SELECT TOP 100
            designation,
            ra, dec,
            w1mpro, w2mpro, w3mpro, w4mpro,
            cc_flags, ext_flg, var_flg
        FROM allwise_p3as_psd
        WHERE 1 = CONTAINS(
            POINT('ICRS', ra, dec),
            CIRCLE('ICRS', {ra}, {dec}, {radius_deg})
        )
        AND w1mpro IS NOT NULL
        ORDER BY w1mpro
    """

    result = service.search(adql)
    table = result.to_table()

    sources = []
    for row in table:
        def _mag(col):
            v = row[col]
            if hasattr(v, "mask") and v.mask:
                return None
            return round(float(v), 3)

        sources.append({
            "designation": str(row["designation"]),
            "ra": float(row["ra"]),
            "dec": float(row["dec"]),
            "w1": _mag("w1mpro"),
            "w2": _mag("w2mpro"),
            "w3": _mag("w3mpro"),
            "w4": _mag("w4mpro"),
            "cc_flags": str(row["cc_flags"]).strip(),
            "ext_flg": int(row["ext_flg"]) if row["ext_flg"] is not None else 0,
        })

    return {
        "sources": sources,
        "count": len(sources),
        "catalog": "AllWISE",
        "demo_mode": False,
    }


def _synthetic_sources(ra: float, dec: float, fov_deg: float) -> dict[str, Any]:
    rng = np.random.default_rng(int(abs(ra * 1000 + dec * 1000)) % (2**31))
    n = rng.integers(10, 40)
    half = fov_deg / 2
    sources = []
    for i in range(n):
        w1 = float(rng.uniform(6, 16))
        w2 = w1 + float(rng.uniform(-0.5, 2.0))
        w3 = w2 + float(rng.uniform(-0.5, 3.0))
        w4 = w3 + float(rng.uniform(-0.5, 2.0))
        sources.append({
            "designation": f"J{int(ra * 1e4):08d}{'+' if dec >= 0 else ''}{int(dec * 1e4):08d}_{i:04d}",
            "ra": float(ra + rng.uniform(-half * 0.9, half * 0.9)),
            "dec": float(dec + rng.uniform(-half * 0.9, half * 0.9)),
            "w1": round(w1, 3),
            "w2": round(w2, 3),
            "w3": round(w3, 3),
            "w4": round(w4, 3),
            "cc_flags": "0000",
            "ext_flg": 0,
        })
    return {
        "sources": sources,
        "count": len(sources),
        "catalog": "AllWISE (demo)",
        "demo_mode": True,
    }
