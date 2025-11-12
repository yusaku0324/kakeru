#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${E2E_TEST_AUTH_SECRET:-}" && -z "${TEST_AUTH_SECRET:-}" ]]; then
  echo "[run-e2e-real] E2E_TEST_AUTH_SECRET もしくは TEST_AUTH_SECRET を設定してください。" >&2
  exit 1
fi

if [[ -z "${ADMIN_API_KEY:-${OSAKAMENESU_ADMIN_API_KEY:-}}" ]]; then
  echo "[run-e2e-real] ADMIN_API_KEY (または OSAKAMENESU_ADMIN_API_KEY) が必要です。" >&2
  exit 1
fi

if [[ -z "${ADMIN_BASIC_USER:-}" || -z "${ADMIN_BASIC_PASS:-}" ]]; then
  echo "[run-e2e-real] ADMIN_BASIC_USER / ADMIN_BASIC_PASS を設定してください。" >&2
  exit 1
fi

export FAVORITES_API_MODE="${FAVORITES_API_MODE:-real}"
export NEXT_PUBLIC_FAVORITES_API_MODE="${NEXT_PUBLIC_FAVORITES_API_MODE:-$FAVORITES_API_MODE}"
export NEXT_PUBLIC_OSAKAMENESU_API_BASE="${NEXT_PUBLIC_OSAKAMENESU_API_BASE:-/api}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://127.0.0.1:3000}"
export OSAKAMENESU_API_INTERNAL_BASE="${OSAKAMENESU_API_INTERNAL_BASE:-http://127.0.0.1:8000}"
export API_INTERNAL_BASE="${API_INTERNAL_BASE:-$OSAKAMENESU_API_INTERNAL_BASE}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:3000}"

echo "[run-e2e-real] baseURL=${E2E_BASE_URL} api=${OSAKAMENESU_API_INTERNAL_BASE}"
pnpm exec playwright test "$@"
