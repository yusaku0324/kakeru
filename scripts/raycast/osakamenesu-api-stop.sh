#!/bin/zsh
# @raycast.schemaVersion 1
# @raycast.title Stop API (kill :8000)
# @raycast.mode compact
# @raycast.packageName osakamenesu
# @raycast.icon 🛑

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

PIDS=( $(lsof -t -iTCP:8000 -sTCP:LISTEN 2>/dev/null || true) )
if [[ ${#PIDS[@]} -eq 0 ]]; then
  echo "No process on port 8000"
  exit 0
fi
for pid in "${PIDS[@]}"; do
  kill "$pid" || true
done
sleep 1
REMAIN=( $(lsof -t -iTCP:8000 -sTCP:LISTEN 2>/dev/null || true) )
for pid in "${REMAIN[@]}"; do
  kill -9 "$pid" || true
done
