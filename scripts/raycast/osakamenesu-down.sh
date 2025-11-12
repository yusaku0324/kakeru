#!/bin/zsh
# @raycast.schemaVersion 1
# @raycast.title Docker Down (dev_docker)
# @raycast.mode fullOutput
# @raycast.needsConfirmation true
# @raycast.packageName osakamenesu
# @raycast.icon ⏹️

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
cd "$REPO_DIR"

doppler run --project osakamenesu --config dev_docker -- docker compose -f osakamenesu/docker-compose.yml down -v
echo "Docker: down 完了 (-v でボリュームも削除)"
