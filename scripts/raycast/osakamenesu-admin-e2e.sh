#!/bin/zsh
# @raycast.schemaVersion 1
# @raycast.title Admin E2E (Docker)
# @raycast.mode fullOutput
# @raycast.packageName osakamenesu
# @raycast.icon 🧪

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
  printf 'Set OSAKAMENESU_REPO_DIR to your repo path.\n' >&2
  exit 1
}

ROOT="$(resolve_repo_dir)/osakamenesu"
cd "$ROOT"

echo "Generating .env.admin-e2e via Doppler..."
doppler secrets download --project osakamenesu --config stg --format env --no-file > .env.admin-e2e

echo "Starting admin E2E docker-compose stack..."
docker compose -f docker-compose.admin-e2e.yml up --build --abort-on-container-exit e2e
ecode=$?

echo "Tearing down stack..."
docker compose -f docker-compose.admin-e2e.yml down -v || true
exit $ecode
