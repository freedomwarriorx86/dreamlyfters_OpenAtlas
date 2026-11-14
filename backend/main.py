"""Main FastAPI application for the SPHEREx Planet X Viewer."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .spherex import get_spherex_cutout, get_spherex_epochs
from .gaia import get_gaia_stars
from .wise import get_wise_cutout
from pydantic import BaseModel, Field, validator
from typing import Optional, List
import numpy as np

app = FastAPI(title="SPHEREx Planet X Viewer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CoordinateInput(BaseModel):
    """Coordinate input model accepting various formats."""

    ra_degrees: Optional[float] = Field(None, description="Right Ascension in decimal degrees")
    dec_degrees: Optional[float] = Field(None, description="Declination in decimal degrees")
    ra_hms: Optional[str] = Field(None, description="Right Ascension in HMS format (hh:mm:ss)")
    dec_dms: Optional[str] = Field(None, description="Declination in DMS format (dd:mm:ss)")
    fov: float = Field(0.5, ge=0.1, le=2.0, description="Field of view in degrees")
    band: int = Field(50, ge=1, le=102, description="SPHEREx band number (1-102)")
    epoch: int = Field(1, ge=1, le=10, description="Epoch number (1-10 approximately)")

    @validator("ra_degrees", pre=True)
    def convert_ra_if_hms(cls, v, values):
        """Convert RA from HMS to degrees if needed."""
        if v is None:
            return v
        if isinstance(v, str) and ":" in v:
            # Parse HMS format: hh:mm:ss
            parts = v.split(":")
            if len(parts) == 3:
                try:
                    h, m, s = float(parts[0]), float(parts[1]), float(parts[2])
                    return h * 15.0 + m * 0.25 + s * (0.25 / 60.0)
                except ValueError:
                    pass
        return v

    @validator("dec_degrees", pre=True)
    def convert_dec_if_dms(cls, v, values):
        """Convert Dec from DMS to degrees if needed."""
        if v is None:
            return v
        if isinstance(v, str) and ":" in v:
            # Parse DMS format: dd:mm:ss
            parts = v.split(":")
            if len(parts) == 3:
                try:
                    d, m, s = float(parts[0]), float(parts[1]), float(parts[2])
                    # Handle negative values
                    sign = -1 if d < 0 or (d == 0 and m < 0) else 1
                    abs_d = abs(d)
                    return sign * (abs_d + m / 60.0 + s / 3600.0)
                except ValueError:
                    pass
        return v


class URLState(BaseModel):
    """URL state model for encoding app state in query parameters."""

    ra: Optional[float] = None
    dec: Optional[float] = None
    fov: float = 0.5
    band: int = 50
    epoch: int = 1


@app.get("/")
async def root():
    return {"message": "SPHEREx Planet X Viewer API", "version": "1.0.0"}


@app.post("/api/coordinates")
async def set_coordinates(coord: CoordinateInput):
    """Validate and process coordinate input."""
    if coord.ra_degrees is None:
        raise HTTPException(status_code=400, detail="RA coordinate is required")
    if coord.dec_degrees is None:
        raise HTTPException(status_code=400, detail="Dec coordinate is required")
    return {
        "ra_degrees": coord.ra_degrees,
        "dec_degrees": coord.dec_degrees,
        "fov": coord.fov,
        "band": coord.band,
        "epoch": coord.epoch,
    }


@app.get("/api/state")
async def get_url_state():
    """Return current URL state for encoding in query parameters."""
    return {"ra": None, "dec": None, "fov": 0.5, "band": 50, "epoch": 1}


@app.get("/api/spherex/cutout")
async def spherex_cutout(
    ra: float = 133.794,
    dec: float = -7.245,
    fov: float = 0.5,
    band: int = 50,
    epoch: int = 1,
):
    """Fetch SPHEREx cutout image from IRSA."""
    try:
        result = await get_spherex_cutout(ra, dec, fov, band, epoch)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/spherex/epochs")
async def spherex_epochs(
    ra: float = 133.794,
    dec: float = -7.245,
    fov: float = 0.5,
    band: int = 50,
):
    """Fetch available SPHEREx epochs for given coordinates."""
    try:
        result = await get_spherex_epochs(ra, dec, fov, band)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gaia/stars")
async def gaia_stars(
    ra: float = 133.794,
    dec: float = -7.245,
    fov: float = 0.5,
):
    """Fetch Gaia DR3 stars within field of view."""
    try:
        result = await get_gaia_stars(ra, dec, fov)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/wise/cutout")
async def wise_cutout(
    ra: float = 133.794,
    dec: float = -7.245,
    fov: float = 0.5,
):
    """Fetch WISE/NEOWISE cutout image."""
    try:
        result = await get_wise_cutout(ra, dec, fov)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)