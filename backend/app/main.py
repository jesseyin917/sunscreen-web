from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SunSmart AU Backend",
    version="0.1.0",
    description="FastAPI backend for live UV retrieval and deployment-ready API integration using Open-Meteo.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def uv_risk_label(uvi: float) -> str:
    if uvi < 3:
        return "Low"
    if uvi < 6:
        return "Moderate"
    if uvi < 8:
        return "High"
    if uvi < 11:
        return "Very High"
    return "Extreme"


@app.get("/")
def read_root():
    return {
        "name": "SunSmart AU Backend",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/uv/current")
async def get_current_uv(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    label: Optional[str] = Query(None, description="Human-readable location label"),
):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "uv_index",
        "timezone": "auto",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upstream request failed: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=data)

    uvi = data.get("current", {}).get("uv_index")
    if uvi is None:
        raise HTTPException(status_code=502, detail="UV data missing in upstream response")

    return {
        "location": label or f"{lat:.2f}, {lon:.2f}",
        "lat": lat,
        "lon": lon,
        "uvIndex": uvi,
        "risk": uv_risk_label(float(uvi)),
        "message": "Live response from FastAPI backend using Open-Meteo.",
        "source": "Open-Meteo via FastAPI backend",
    }
