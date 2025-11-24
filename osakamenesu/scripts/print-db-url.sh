#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  cat <<'MSG' >&2
[print-db-url] DATABASE_URL is not set.
- Run via Doppler: doppler run --project osakamenesu --config dev_api -- scripts/print-db-url.sh
- Or export DATABASE_URL manually before invoking this script.
MSG
  exit 1
fi

python3 <<'PY'
import os
from urllib.parse import urlparse

raw_url = os.environ["DATABASE_URL"]
parsed = urlparse(raw_url)

driver = parsed.scheme
if "+" in driver:
  driver = driver.split("+", 1)[0]

user = parsed.username or ""
password = parsed.password or ""
host = parsed.hostname or ""
port = parsed.port or ""
db_name = (parsed.path or "/").lstrip("/")

standard_uri = parsed._replace(scheme=driver).geturl()

print("Driver     :", driver)
print("Host       :", host)
print("Port       :", port)
print("Database   :", db_name)
print("User       :", user)
print("Password   :", password)
print("Full URI   :", standard_uri)

psql_cmd = f"PGPASSWORD='{password}' psql -h {host} -p {port or 5432} -U {user} {db_name}"
print("\npsql command:")
print(psql_cmd)
PY
