import os
import time
import uuid
import logging
from flask import Flask, request, jsonify, g
from flask_cors import CORS
import requests
from dotenv import load_dotenv

load_dotenv()

ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY")
ADZUNA_COUNTRY = os.getenv("ADZUNA_COUNTRY", "us")

if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
    print("WARNING: Missing ADZUNA_APP_ID or ADZUNA_APP_KEY. Set them in backend/.env")

BASE_URL = f"https://api.adzuna.com/v1/api/jobs/{ADZUNA_COUNTRY}"
CACHE_TTL_SEC = int(os.getenv("CACHE_TTL_SEC", "60"))
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "60"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)

app = Flask(__name__)
CORS(app)

_cache = {}
_rate = {}


def _get_client_ip():
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _rate_limit_ok():
    now = time.time()
    ip = _get_client_ip()
    window = _rate.get(ip)
    if not window or now - window["start"] >= 60:
        _rate[ip] = {"start": now, "count": 1}
        return True
    if window["count"] >= RATE_LIMIT_PER_MIN:
        return False
    window["count"] += 1
    return True


def _parse_int(name, default, min_value, max_value):
    raw = request.args.get(name, default)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid {name}")
    if value < min_value or value > max_value:
        raise ValueError(f"Invalid {name}")
    return value


def _cache_get(key):
    now = time.time()
    entry = _cache.get(key)
    if not entry:
        return None
    ts, data = entry
    if now - ts > CACHE_TTL_SEC:
        _cache.pop(key, None)
        return None
    return data


def _cache_set(key, data):
    _cache[key] = (time.time(), data)


@app.before_request
def _start_timer():
    g.start_time = time.time()


@app.before_request
def _attach_request_id():
    g.request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())


@app.after_request
def _log_request(response):
    duration = int((time.time() - g.get("start_time", time.time())) * 1000)
    logging.info(
        "request_id=%s method=%s path=%s status=%s duration_ms=%s ip=%s",
        g.get("request_id"),
        request.method,
        request.path,
        response.status_code,
        duration,
        _get_client_ip()
    )
    response.headers["X-Request-Id"] = g.get("request_id")
    return response

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/jobs")
def jobs():
    """Proxy search to Adzuna with basic validation, caching, and rate limiting."""
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        return jsonify({"error": "Server not configured", "request_id": g.request_id}), 500

    if not _rate_limit_ok():
        return jsonify({"error": "Rate limit exceeded", "request_id": g.request_id}), 429

    try:
        page = _parse_int("page", "1", 1, 50)
        results_per_page = _parse_int("results_per_page", "20", 1, 50)
        salary_min = request.args.get("salary_min", "").strip()
        salary_max = request.args.get("salary_max", "").strip()
        max_days_old = request.args.get("max_days_old", "").strip()
    except ValueError as e:
        return jsonify({"error": str(e), "request_id": g.request_id}), 400

    q = request.args.get("q", "")
    location = request.args.get("location", "")
    company = request.args.get("company", "")
    job_type = request.args.get("job_type", "")
    sort_by = request.args.get("sort_by", "")

    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "what": q,
        "where": location,
        "page": page,
        "results_per_page": results_per_page,
        "content-type": "application/json",
    }

    if company:
        params["company"] = company
    if sort_by:
        if sort_by not in {"relevance", "date", "salary"}:
            return jsonify({"error": "Invalid sort_by", "request_id": g.request_id}), 400
        params["sort_by"] = sort_by

    if salary_min:
        if not salary_min.isdigit():
            return jsonify({"error": "Invalid salary_min", "request_id": g.request_id}), 400
        params["salary_min"] = salary_min
    if salary_max:
        if not salary_max.isdigit():
            return jsonify({"error": "Invalid salary_max", "request_id": g.request_id}), 400
        params["salary_max"] = salary_max
    if max_days_old:
        if not max_days_old.isdigit():
            return jsonify({"error": "Invalid max_days_old", "request_id": g.request_id}), 400
        params["max_days_old"] = max_days_old

    if job_type in {"full_time", "part_time", "contract", "permanent"}:
        params[job_type] = 1

    cache_key = tuple(sorted(params.items()))
    cached = _cache_get(cache_key)
    if cached is not None:
        return jsonify(cached)

    try:
        r = requests.get(f"{BASE_URL}/search/{page}", params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        _cache_set(cache_key, data)
        return jsonify(data)
    except requests.RequestException as e:
        return jsonify({"error": "Upstream request failed", "details": str(e), "request_id": g.request_id}), 502

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(debug=True, port=port)
