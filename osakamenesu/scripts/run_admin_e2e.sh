#!/bin/bash
set -euo pipefail
cd /workspace
pnpm install
cd apps/web
for i in {1..60}; do
  if getent hosts api >/dev/null 2>&1 && getent hosts web >/dev/null 2>&1; then
    if curl -fsS http://api:8000/healthz >/dev/null && curl -fsS http://web:3000 >/dev/null; then
      break
    fi
  fi
  sleep 2
done
export PLAYWRIGHT_WORKERS="${PLAYWRIGHT_WORKERS:-4}"
ADMIN_SPEC="${PLAYWRIGHT_ADMIN_SPEC:-e2e/admin-smoke.spec.ts}"
pnpm exec playwright test "$ADMIN_SPEC" --reporter=line --workers="${PLAYWRIGHT_WORKERS}"
TEST_EXIT=$?
pnpm exec playwright merge-reports --report-dir=playwright-report ./blob-report >/dev/null 2>&1 || true
exit ${TEST_EXIT}
