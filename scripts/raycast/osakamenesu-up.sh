#!/bin/zsh
# @raycast.schemaVersion 1
# @raycast.title Docker Up (dev_docker)
# @raycast.mode fullOutput
# @raycast.packageName osakamenesu
# @raycast.icon ▶️

set -euo pipefail
export PATH="/opt/homebrew/bin:$PATH"

REPO_DIR="${OSAKAMENESU_REPO_DIR:-$HOME/dev/osakamenesu}"
cd "$REPO_DIR"

doppler run --project osakamenesu --config dev_docker -- docker compose up -d
echo "Docker: up 完了"
