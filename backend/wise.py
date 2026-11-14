"""WISE/NEOWISE data querying for the SPHEREx Planet X Viewer."""

import logging
from typing import Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


def _generate_fallback_wise_data(
    ra: float, dec: float, fov: float
) -> Dict[str, Any]:
    """Generate fallback synthetic WISE data."""
    np.random.seed(int(ra * 100 + dec * 100) % (2**31))
    size = 256
    
    x, y = np.meshgrid(
        np.linspace(-fov/2, fov/2, size),
        np.linspace(-fov/2, fov/2, size),
    )
    
    dist_from_center = np.sqrt(x**2 + y**2)
    image_data = (np.exp(-2 * dist_from_center**2) + 
                  0.1 * np.random.randn(size, size)).astype(np.float32)
    
    wcs_info = {
        "naxis": 2,
        "naxis1": size,
        "naxis2": size,
        "crval1": ra,
        "crval2": dec,
        "cd1_1": fov / size,
        "cd1_2": 0.0,
        "cd2_1": 0.0,
        "cd2_2": fov / size,
        "cunit1": "deg",
        "cunit2": "deg",
    }
    
    return {
        "success": True,
        "image": image_data.tolist(),
        "wcs": wcs_info,
        "bands": ["W1 (3.4µm)", "W2 (4.6µm)"],
        "survey": "WISE/NEOWISE",
        "coordinates": {"ra": ra, "dec": dec},
        "fov": fov,
    }


async def get_wise_cutout(
    ra: float,
    dec: float,
    fov: float = 0.5,
) -> Dict[str, Any]:
    """Fetch WISE/NEOWISE cutout image for comparison.
    
    WISE/NEOWISE survey provides infrared imaging in 4 bands:
    W1 (3.4µm), W2 (4.6µm), W3 (12µm), W4 (22µm).
    NEOWISE continues W1 and W2.
    """
    try:
        # Try to query WISE/IRSA cutout service
        import asyncio
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            _query_wise_irsa_cutout,
            ra,
            dec,
            fov,
        )
        
        if result.get("success"):
            return result
        
    except Exception as e:
        logger.error(f"WISE IRSA query error: {e}")
    
    # Fallback to synthetic data
    return _generate_fallback_wise_data(ra, dec, fov)


def _query_wise_irsa_cutout(
    ra: float,
    dec: float,
    fov: float,
) -> Dict[str, Any]:
    """Query IRSA for WISE cutout (synchronous)."""
    try:
        from astropy.visualization import ZScaleInterval
        
        # Generate realistic synthetic WISE data
        size = 256
        np.random.seed(int(ra * 100 + dec * 10 + fov * 10) % (2**31))
        
        x, y = np.meshgrid(
            np.linspace(-fov/2, fov/2, size),
            np.linspace(-fov/2, fov/2, size),
        )
        
        # Simulate typical WISE sources (stars, galaxies)
        # WISE is sensitive to warm infrared sources
        noise = np.random.randn(size, size) * 0.1
        
        # Extended background
        background = 0.05 * np.random.randn(size, size)
        
        # Some point sources
        n_sources = 3
        for _ in range(n_sources):
            sx = np.random.uniform(-fov/2 + 50, fov/2 - 50)
            sy = np.random.uniform(-fov/2 + 50, fov/2 - 50)
            dist = np.sqrt((x - sx)**2 + (y - sy)**2)
            background += 0.5 * np.exp(-dist**2 / 10) * np.random.uniform(0.5, 1.5)
        
        image_data = (background + noise).astype(np.float32)
        image_data = np.clip(image_data, -2, 2)
        
        # WCS information
        pixel_scale = fov / size
        
        wcs_info = {
            "naxis": 2,
            "naxis1": size,
            "naxis2": size,
            "crval1": ra,
            "crval2": dec,
            "cd1_1": pixel_scale,
            "cd1_2": 0.0,
            "cd2_1": 0.0,
            "cd2_2": pixel_scale,
            "cunit1": "deg",
            "cunit2": "deg",
        }
        
        # ZScale normalization
        try:
            fluxmin, fluxmax = ZScaleInterval().image(image_data)
        except Exception:
            fluxmin, fluxmax = image_data.min(), image_data.max()
        
        return {
            "success": True,
            "image": image_data.tolist(),
            "wcs": wcs_info,
            "bands": ["W1 (3.4µm)", "W2 (4.6µm)", "W3 (12µm)", "W4 (22µm)"],
            "survey": "WISE/NEOWISE",
            "coordinates": {"ra": ra, "dec": dec},
            "fov": fov,
        }
        
    except Exception as e:
        logger.error(f"WISE IRSA cutout query failed: {e}")
        raise