# SunSmart AU

Youth campaign style sunscreen-awareness web project with:

- **US1.1** Localised UV alert via a **FastAPI backend**, supporting suburb/postcode search and current location
- **US2.1** Two visualisations using real Australian public datasets
- **US3.3** UV-based clothing recommendations

## Project structure

- `index.html`, `app.js`, `styles.css`, `data.js` - frontend
- `backend/` - FastAPI backend for secure API integration
- `sunscreen-web/` - mirrored project folder version kept in repo

## Backend setup

```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn app.main:app --reload --app-dir backend
```

Backend endpoints:

- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/api/uv/current?lat=-37.8136&lon=144.9631&label=Melbourne`

## Frontend setup

```bash
python3 -m http.server 8008
```

Then open:

- `http://127.0.0.1:8008`

## Public deployment

### Backend (Render)

This repo includes `render.yaml` for the FastAPI backend. Deploy the backend first and copy the public backend URL.

### Frontend

Set `config.js`:

```js
window.APP_CONFIG = {
  apiBase: 'https://your-backend-url.onrender.com'
};
```

Then deploy the frontend statically (GitHub Pages / Netlify / Vercel static hosting).

## Data sources

- Australian Cancer Incidence and Mortality (data.gov.au / AIHW)
- 2021 SoE Climate Annual mean temperature anomaly Australia (1910 to 2020)
- Open-Meteo live UV via backend API
