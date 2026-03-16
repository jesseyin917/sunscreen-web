import os
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SunSmart AU Backend",
    version="0.4.0",
    description="FastAPI backend for UV retrieval, suburb/postcode lookup, and dynamic clothing recommendations.",
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


def clothing_payload(risk: str):
    payloads = {
        "Low": {
            "theme": "low",
            "headline": "Light protection is enough for most short outdoor trips.",
            "outfitTitle": "Low UV outfit guide",
            "outfitItems": [
                "T-shirt or light overshirt is usually fine for short outdoor time.",
                "Bring sunglasses if you will stay out through midday.",
                "Keep sunscreen ready for longer exposure."
            ],
            "materials": [
                "Breathable fabrics are fine.",
                "A slightly tighter weave gives extra protection.",
                "Light layers work well if conditions change."
            ],
            "accessories": [
                "Sunglasses are still a smart add-on.",
                "A hat is helpful but not always essential for short exposure.",
                "Carry sunscreen if you expect longer time outside."
            ],
            "caution": "Comfort matters, but midday sun can still build up exposure over time.",
            "campaign": "Easy day, still play it smart."
        },
        "Moderate": {
            "theme": "moderate",
            "headline": "Start thinking about protection before staying outdoors.",
            "outfitTitle": "Moderate UV outfit guide",
            "outfitItems": [
                "Breathable long sleeves or a tighter-weave overshirt.",
                "Shorts are okay, but exposed skin should be protected.",
                "Use SPF 50+ on uncovered areas."
            ],
            "materials": [
                "Tighter-weave cotton or UPF-rated fabrics work better.",
                "Avoid thin, see-through materials.",
                "Breathable layers help keep coverage practical."
            ],
            "accessories": [
                "Sunglasses recommended.",
                "Bucket hat or wide-brim hat recommended.",
                "Sunscreen should be part of the routine now."
            ],
            "caution": "This is the level where people often underestimate risk because it does not feel extreme.",
            "campaign": "Looks casual. Needs protection."
        },
        "High": {
            "theme": "high",
            "headline": "Protective clothing should now be part of your outfit, not an afterthought.",
            "outfitTitle": "High UV outfit guide",
            "outfitItems": [
                "Choose long sleeves or UPF-rated tops.",
                "Longer shorts or lightweight pants are better for extended outdoor time.",
                "Cover exposed skin with SPF 50+."
            ],
            "materials": [
                "UPF-rated materials are ideal.",
                "Tightly woven fabrics perform better than thin casual wear.",
                "Light but covering layers are best."
            ],
            "accessories": [
                "Wide-brim hat strongly recommended.",
                "Sunglasses are essential.",
                "Look for shade during peak UV hours."
            ],
            "caution": "High UV can damage skin quickly, even when weather feels comfortable.",
            "campaign": "Dress for the UV, not just the temperature."
        },
        "Very High": {
            "theme": "very-high",
            "headline": "This level needs serious protection and reduced direct exposure.",
            "outfitTitle": "Very High UV outfit guide",
            "outfitItems": [
                "Wear long sleeves with strong coverage.",
                "Use long pants or fuller lower-body coverage where possible.",
                "SPF 50+ is essential on all exposed skin."
            ],
            "materials": [
                "UPF-rated or tightly woven fabrics are strongly recommended.",
                "Loose, breathable coverage is better than thin minimal clothing.",
                "Covering the neck area is helpful."
            ],
            "accessories": [
                "Wide-brim hat essential.",
                "Sunglasses essential.",
                "Take shade breaks and avoid long direct exposure."
            ],
            "caution": "Very High UV means skin damage can begin fast. Clothing should actively reduce exposure.",
            "campaign": "Good style, stronger protection."
        },
        "Extreme": {
            "theme": "extreme",
            "headline": "Maximum protection is recommended. Minimise direct sun exposure where possible.",
            "outfitTitle": "Extreme UV outfit guide",
            "outfitItems": [
                "Maximum-coverage clothing: long sleeves and full-leg coverage.",
                "Prioritise shaded routes and reduce time outdoors.",
                "SPF 50+ on any exposed skin is non-negotiable."
            ],
            "materials": [
                "UPF-rated clothing is best.",
                "Dense fabrics protect better than light fashion layers.",
                "Full coverage should come before style convenience."
            ],
            "accessories": [
                "Wide-brim hat essential.",
                "Sunglasses essential.",
                "Plan outdoor activities around lower-risk times if possible."
            ],
            "caution": "Extreme UV should be treated as a real hazard, not just sunny weather.",
            "campaign": "The sun is winning unless you plan for it."
        },
    }
    return payloads[risk]


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

    risk = uv_risk_label(float(uvi))
    clothing = clothing_payload(risk)

    return {
        "location": resolved_label or f"{lat:.2f}, {lon:.2f}",
        "lat": lat,
        "lon": lon,
        "uvIndex": uvi,
        "risk": risk,
        "message": "Live response from FastAPI backend using OpenWeather.",
        "source": "OpenWeather One Call 3.0 via FastAPI backend",
        "clothing": clothing,
    }
