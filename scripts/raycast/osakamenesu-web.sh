#!/bin/zsh
# @raycast.schemaVersion 1
# @raycast.title Web (Next.js dev_web)
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
  do script "cd '$REPO_DIR' && doppler run --project osakamenesu --config dev_web -- pnpm dev"
end tell
APPLESCRIPT
