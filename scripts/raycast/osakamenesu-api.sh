#!/bin/zsh
# @raycast.schemaVersion 1
# @raycast.title API (FastAPI dev_docker)
# @raycast.mode silent
# @raycast.packageName osakamenesu
# @raycast.icon 🟢

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

REPO_DIR="${OSAKAMENESU_REPO_DIR:-$HOME/dev/osakamenesu}"

osascript <<'APPLESCRIPT'
tell application "Terminal"
  if not (exists window 1) then reopen
  activate
end tell
APPLESCRIPT

osascript <<APPLESCRIPT
tell application "Terminal"
  do script "cd '$REPO_DIR' && doppler run --project osakamenesu --config dev_docker -- uvicorn app.main:app --reload --port 8000 --reload-exclude 'node_modules|.next|dist|venv|.git'"
end tell
APPLESCRIPT
