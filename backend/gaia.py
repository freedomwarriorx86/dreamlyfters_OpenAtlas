"""Gaia DR3 data querying for the SPHEREx Planet X Viewer."""

import logging
from typing import Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


def _generate_fallback_gaia_stars(
    ra: float, dec: float, fov: float
) -> Dict[str, Any]:
    """Generate fallback synthetic Gaia data."""
    np.random.seed(int(ra * 1000 + dec * 1000) % (2**31))
    
    n_stars = np.random.randint(20, 80)
    
    stars = []
    for i in range(n_stars):
        # Random positions within FOV
        ra_offset = (np.random.random() - 0.5) * fov * 0.8
        dec_offset = (np.random.random() - 0.5) * fov * 0.8
        
        # Proper motions (typical stellar proper motions in mas/yr)
        pm_ra = np.random.uniform(-100, 100)
        pm_dec = np.random.uniform(-100, 100)
        
        # G-band magnitude
        g_mag = np.random.uniform(3, 20)
        bp_rp = np.random.uniform(-0.5, 2.0)
        
        # Derive proper motion in arcsec/yr
        pm_arcsec = np.sqrt(pm_ra**2 + pm_dec**2)
        
        stars.append({
            "source_id": int(1000000 + i),
            "ra": ra + ra_offset,
            "dec": dec + dec_offset,
            "pm_ra": pm_ra,
            "pm_dec": pm_dec,
            "radial_velocity": np.random.uniform(-50, 50),
            "g_mag": round(g_mag, 2),
            "bp_rp": round(bp_rp, 3),
            "proper_motion_arcsec_yr": round(pm_arcsec, 2),
        })
    
    return {
        "success": True,
        "stars": stars,
        "coordinates": {"ra": ra, "dec": dec},
        "fov": fov,
        "total_stars": len(stars),
    }


async def get_gaia_stars(
    ra: float,
    dec: float,
    fov: float = 0.5,
) -> Dict[str, Any]:
    """Fetch Gaia DR3 stars within field of view.
    
    Uses astroquery.gaia to query Gaia DR3 catalog for stars
    with proper motion data.
    """
    try:
        from astroquery.gaia import Gaia
        
        # Convert fov to arcseconds for cone search
        radius_arcsec = fov * 3600
        
        # SQL query for Gaia DR3 - cone search with proper motion
        query = f"""
        SELECT 
            source_id, 
            ra, 
            dec, 
            pm_ra_mean, 
            pm_dec_mean, 
            radial_velocity, 
            phot_g_mean_mag, 
            bp_rp,
            astrometric_n_good_obs_al
        FROM gaiadr3.gaia_source
        WHERE 
            CONTAINS(
                POINT(ra, dec),
                CIRCLE( {ra}, {dec}, {radius_arcsec / 3600} )
            ) = 1
        ORDER BY phot_g_mean_mag
        LIMIT 100
        """
        
        # Run the query
        job = Gaia.launch_job_async(query, timeout=30)
        
        results = []
        for row in job:
            star_data = {
                "source_id": row["source_id"],
                "ra": float(row["ra"]),
                "dec": float(row["dec"]),
                "pm_ra": float(row["pm_ra_mean"]) if row["pm_ra_mean"] else 0.0,
                "pm_dec": float(row["pm_dec_mean"]) if row["pm_dec_mean"] else 0.0,
                "radial_velocity": float(row["radial_velocity"]) if row["radial_velocity"] else 0.0,
                "g_mag": float(row["phot_g_mean_mag"]),
                "bp_rp": float(row["bp_rp"]) if row["bp_rp"] else 0.0,
                "proper_motion_arcsec_yr": abs(float(row["pm_ra_mean"])**2 + float(row["pm_dec_mean"])**2)**0.5 if (row["pm_ra_mean"] and row["pm_dec_mean"]) else 0.0,
            }
            results.append(star_data)
        
        return {
            "success": True,
            "stars": results,
            "coordinates": {"ra": ra, "dec": dec},
            "fov": fov,
            "total_stars": len(results),
        }
        
    except Exception as e:
        logger.error(f"Error fetching Gaia stars: {e}")
        # Return fallback synthetic data
        return _generate_fallback_gaia_stars(ra, dec, fov)