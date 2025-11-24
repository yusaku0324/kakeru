#!/bin/zsh
# @raycast.schemaVersion 1
# @raycast.title Restart API+Web (pnpm dev)
# @raycast.mode silent
# @raycast.packageName osakamenesu
# @raycast.icon ♻️

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

resolve_repo_dir() {
  if [[ -n "${OSAKAMENESU_REPO_DIR:-}" && -d "${OSAKAMENESU_REPO_DIR}" ]]; then
    printf '%s\n' "$OSAKAMENESU_REPO_DIR"
    return
  fi
  local repo_alt="$HOME/Repositories/kakeru-local"
  if [[ -d "$repo_alt" ]]; then
    printf '%s\n' "$repo_alt"
    return
  fi
  local legacy="$HOME/dev/osakamenesu"
  if [[ -d "$legacy" ]]; then
    printf '%s\n' "$legacy"
    return
  fi
  printf 'Raycast script error: set OSAKAMENESU_REPO_DIR to your repo path.\n' >&2
  exit 1
}

REPO_DIR="$(resolve_repo_dir)"
ROOT="$REPO_DIR/osakamenesu"

if [[ -x "$REPO_DIR/scripts/raycast/osakamenesu-api-stop.sh" ]]; then
  "$REPO_DIR/scripts/raycast/osakamenesu-api-stop.sh" >/dev/null 2>&1 || true
fi
if [[ -x "$REPO_DIR/scripts/raycast/osakamenesu-web-stop.sh" ]]; then
  "$REPO_DIR/scripts/raycast/osakamenesu-web-stop.sh" >/dev/null 2>&1 || true
fi

osascript <<'APPLESCRIPT'
tell application "Terminal"
  if not (exists window 1) then reopen
  activate
end tell
APPLESCRIPT

osascript <<APPLESCRIPT
tell application "Terminal"
  do script "cd '$ROOT' && pnpm dev"
end tell
APPLESCRIPT
