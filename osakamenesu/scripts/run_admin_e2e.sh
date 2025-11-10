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
SHARD_ARGS=""
if [[ -n "${PLAYWRIGHT_TOTAL_SHARDS:-}" && -n "${PLAYWRIGHT_SHARD_INDEX:-}" ]]; then
  SHARD_ARGS=" --shard=${PLAYWRIGHT_SHARD_INDEX}/${PLAYWRIGHT_TOTAL_SHARDS}"
fi
pnpm test:e2e -- --workers="${PLAYWRIGHT_WORKERS}"${SHARD_ARGS}
TEST_EXIT=$?
pnpm exec playwright merge-reports --report-dir=playwright-report ./blob-report >/dev/null 2>&1 || true
exit ${TEST_EXIT}
