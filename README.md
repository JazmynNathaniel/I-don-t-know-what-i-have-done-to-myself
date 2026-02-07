# Job Board (Fictional)

Stack:
- Backend: Flask (Python)
- Frontend: React + Vite
- Jobs API: Adzuna (proxied through backend)
 - Features: filters, debounced search, pagination, job details + shareable links, saved jobs page, caching, rate limiting

## Backend

1. Create and activate a virtual env, then install deps:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

2. Configure env:

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` with your Adzuna credentials.
Optional:
- `CACHE_TTL_SEC` cache time in seconds
- `RATE_LIMIT_PER_MIN` simple per-IP rate limit

3. Run:

```powershell
python backend\app.py
```

Backend runs on `http://localhost:5000`.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## API

- `GET /api/health`
- `GET /api/jobs?q=python&location=remote&page=1&results_per_page=20`
- Optional params: `salary_min`, `salary_max`, `job_type`, `company`, `max_days_old`, `sort_by`

Notes:
- Remote-only and company matching are also applied client-side for extra filtering.
- Keyboard shortcut: `/` focuses the main search input.
