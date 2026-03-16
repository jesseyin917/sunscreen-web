import os
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SunSmart AU Backend",
    version="0.1.0",
    description="FastAPI backend for live UV retrieval and deployment-ready API integration.",
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
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing OPENWEATHER_API_KEY environment variable")

    url = "https://api.openweathermap.org/data/2.5/onecall"
    params = {
        "lat": lat,
        "lon": lon,
        "units": "metric",
        "appid": api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Upstream request failed: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=data)

    uvi = data.get("current", {}).get("uvi")
    if uvi is None:
        raise HTTPException(status_code=502, detail="UV data missing in upstream response")

    return {
        "location": label or f"{lat:.2f}, {lon:.2f}",
        "lat": lat,
        "lon": lon,
        "uvIndex": uvi,
        "risk": uv_risk_label(float(uvi)),
        "message": "Live response from FastAPI backend using OpenWeather.",
        "source": "OpenWeather via FastAPI backend",
    }
