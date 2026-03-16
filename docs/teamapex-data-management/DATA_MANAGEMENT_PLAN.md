# Data Management Plan — TeamApex-main (Onboarding Iteration Project)

> Project scope: TeamApex onboarding iteration project on the generational shift in sun-safety attitudes (Victoria, Australia).
>
> System architecture: **React (Vite) frontend** → **FastAPI backend** → **SQLite database** + **live UV/temperature API**.

---

## 1. Datasets overview

This system combines (1) a **seeded local dataset** stored in SQLite for stable demonstrations and content/rules, and (2) a **live weather/UV API** for real-time readings (with fallback to seeded readings).

### 1.1 Open data / external sources

#### 1.1.1 Open‑Meteo Forecast API (UV Index + weather context)
- **Purpose in system**: provide live UV index (and optionally temperature / conditions) for current UV and history endpoints.
- **Physical access**: HTTPS API.
- **Update frequency (source)**: near real-time / hourly model updates (provider dependent).
- **Update frequency (system)**: per request ("live" path), with fallback to seeded data.
- **Granularity**: location coordinates and time-series.
- **Licensing**: Open‑Meteo publishes terms on their website; attribution is recommended where applicable.
- **Configured in code**: `OPEN_METEO_BASE_URL` in `backend/app/core/config.py`.

> Notes: The backend is designed with a provider abstraction (see `backend/app/providers/uv_provider.py`), so the live provider can be swapped without changing the frontend.

### 1.2 Internal / seeded datasets (stored in SQLite)

The following datasets are shipped with the backend and seeded into SQLite to ensure the demo works without external dependencies.

| Dataset / table | What it contains | Physical access | Update frequency | Granularity | Licensing |
|---|---|---|---|---|---|
| `locations` | Victorian locations with lat/lon, search_terms, and peak UV window | SQLite table | Updated by developers | Per location | Project seed content |
| `uv_readings` | UV readings recorded per location (seeded series + cached live reads) | SQLite table | Per request / per seed | Per reading timestamp | Derived from provider + seed |
| `awareness_stats` | chart-friendly trend metrics for awareness pages | SQLite table | Developer updates | Per label/year | Project seed content |
| `myth_facts` | myths vs facts content blocks | SQLite table | Developer updates | Per myth/fact item | Project seed content |
| `protection_rules` | UV-range rules for clothing/sunscreen advice + checklist JSON | SQLite table | Developer updates | Per UV range | Project seed content |
| `skin_tone_guidance` | guidance by skin type and UV range | SQLite table | Developer updates | Per skin type / UV range | Project seed content |
| `reminders` | reminder CRUD data (user-created) | SQLite table | User-driven | Per reminder | User-generated |

Seed data is defined in `backend/app/services/seed_service.py`.

---

## 2. Iteration 1

Iteration 1 focuses on an onboarding-ready MVP:
- stable content and rules served from SQLite
- location browsing/search
- UV endpoints using a **hybrid provider** (live first, fallback to seeded)
- reminders CRUD

### 2.1 Data usage

#### Frontend usage
- The frontend does **not** access the database directly.
- It consumes backend endpoints via HTTP (see `src/lib/api.ts`).

#### Backend usage
- The backend reads/writes SQLite via Python `sqlite3` with **handwritten SQL** (no ORM).
- Data is organized into tables so that:
  - content/rules/awareness are stable and queryable
  - UV readings can be cached/recorded for demonstration and history
  - reminders support full CRUD

### 2.2 Data preparation

#### Seeding strategy
At backend startup, a bootstrap process ensures the DB exists and is populated:
- `initialize_database()` creates schema if missing (`backend/app/core/database.py`).
- `seed_database()` inserts data only when tables are empty, unless forced (`backend/app/services/seed_service.py`).

Two helper scripts are provided:
- `backend/scripts/init_db.py` — create tables
- `backend/scripts/seed_db.py --force` — reseed content and demo datasets

#### Normalisation / cleaning
- Location names and search are normalised by lowercasing and tokenisation.
- Search tokens shorter than 3 characters are ignored to reduce noisy matches.

### 2.3 Data storage

#### Storage technology
- SQLite database file located at `backend/app.db` (see `DATABASE_PATH` in `backend/app/core/config.py`).

#### Persistence considerations
- In container deployments (e.g., Render with Docker), SQLite is file-based.
- Without a mounted persistent disk, the DB may be recreated on redeploy.
- For production persistence of reminders, options include:
  1) mount a persistent disk for `app.db`
  2) migrate to a managed Postgres database

### 2.4 Database design

#### Schema overview
The schema is defined in `backend/app/core/database.py` and includes:

- `locations(id, name, state, country, latitude, longitude, search_terms, peak_window)`
  - **Unique constraint** on `name` ensures no duplicates.

- `uv_readings(id, location_id → locations.id, uv_index, recorded_at, source)`
  - foreign key with `ON DELETE CASCADE`.

- `awareness_stats(category, label, metric_value, unit, description, sort_order)`

- `protection_rules(min_uv, max_uv, risk_level, clothing_advice, sunscreen_advice, general_advice, checklist_json, dosage_advice, dosage_json)`
  - uses JSON strings for flexible checklists without extra join tables.

- `myth_facts(title, myth, fact, category, sort_order)`

- `skin_tone_guidance(skin_type, min_uv, max_uv, burn_window, guidance, emphasis)`

- `reminders(title, reminder_time, frequency, status, notes, created_at, updated_at)`

#### Key query patterns
- **Location listing**: `SELECT * FROM locations ORDER BY name ASC`.
- **Search**: dynamic `LIKE` conditions over `name`, `state`, and `search_terms`.
- **UV caching**: upsert-like pattern implemented as “select then insert/update”.
- **Reminders**: full CRUD with `created_at`/`updated_at` timestamps.

### 2.5 Data analytics

Iteration 1 analytics are intentionally lightweight and chart-friendly:
- `awareness_stats` provides precomputed series (e.g., skin cancer trend; UV trend)
- `uv_readings` records time-series points for history graphs and demo playback

Possible next steps:
- compute derived metrics (e.g., weekly average UV by location)
- track reminder completion rates and engagement (requires additional tables)

---

## Appendix A — Where to find database code quickly

- DB path + env: `backend/app/core/config.py`
- Schema: `backend/app/core/database.py`
- Bootstrap: `backend/app/core/bootstrap.py`
- Seeds: `backend/app/services/seed_service.py`
- Location queries: `backend/app/services/location_service.py`
- UV caching: `backend/app/services/uv_service.py`
- Reminder CRUD: `backend/app/services/reminder_service.py`

