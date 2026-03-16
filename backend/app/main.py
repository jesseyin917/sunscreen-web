import os
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SunSmart AU Backend",
    version="0.3.0",
    description="FastAPI backend for UV retrieval and suburb/postcode lookup using OpenWeather + geocoding.",
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


@app.get("/api/location/search")
async def search_location(q: str = Query(..., description="Australian suburb or postcode")):
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {
        "name": q,
        "count": 5,
        "language": "en",
        "format": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, params=params)
            data = response.json()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Geocoding request failed: {exc}") from exc

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=data)

    results = data.get("results") or []
    if not results:
        raise HTTPException(status_code=404, detail="No matching suburb or postcode found")

    australian = [
        item for item in results
        if (item.get("country_code") or "").upper() == "AU"
    ]
    chosen = (australian or results)[0]

    return {
        "query": q,
        "name": chosen.get("name"),
        "admin1": chosen.get("admin1"),
        "country": chosen.get("country"),
        "country_code": chosen.get("country_code"),
        "lat": chosen.get("latitude"),
        "lon": chosen.get("longitude"),
        "displayName": ", ".join(
            part for part in [chosen.get("name"), chosen.get("admin1"), chosen.get("country")] if part
        ),
    }


@app.get("/api/uv/current")
async def get_current_uv(
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    label: Optional[str] = Query(None, description="Human-readable location label"),
    q: Optional[str] = Query(None, description="Australian suburb or postcode"),
):
    resolved_label = label

    if q and (lat is None or lon is None):
        lookup = await search_location(q)
        lat = float(lookup["lat"])
        lon = float(lookup["lon"])
        resolved_label = lookup["displayName"]

    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="Provide lat/lon or q (suburb/postcode)")

    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing OPENWEATHER_API_KEY environment variable")

    url = "https://api.openweathermap.org/data/3.0/onecall"
    params = {
        "lat": lat,
        "lon": lon,
        "units": "metric",
        "exclude": "minutely,hourly,daily,alerts",
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
        "location": resolved_label or f"{lat:.2f}, {lon:.2f}",
        "lat": lat,
        "lon": lon,
        "uvIndex": uvi,
        "risk": uv_risk_label(float(uvi)),
        "message": "Live response from FastAPI backend using OpenWeather.",
        "source": "OpenWeather One Call 3.0 via FastAPI backend",
    }
