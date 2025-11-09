#!/usr/bin/env bash
set -euo pipefail

cd /app

echo "[migrate] upgrading DB..."
alembic upgrade head || true
# Prefer Doppler's API_PORT but allow overriding via PORT (e.g. Render/Heroku)
PORT=${PORT:-${API_PORT:-8080}}
echo "[start] uvicorn on port ${PORT}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
