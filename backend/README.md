# SunSmart AU FastAPI Backend

This backend mirrors the reference project structure: a frontend plus a separate FastAPI service.

## Run locally

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements.txt
export OPENWEATHER_API_KEY=your_key_here
python -m uvicorn app.main:app --reload --app-dir backend
```

## Endpoints

- `GET /` - API root
- `GET /health` - health check
- `GET /api/uv/current?lat=-37.8136&lon=144.9631&label=Melbourne` - live UV endpoint

## Notes

- This backend uses OpenWeather One Call 3.0 for live UV retrieval.
- The frontend should call this backend instead of the third-party API directly.
- Keep the API key in an environment variable, not in frontend code.
