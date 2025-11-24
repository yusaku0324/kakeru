#!/usr/bin/env bash
set -euo pipefail

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew が見つかりません。https://brew.sh を参照してください。" >&2
  exit 1
fi

PACKAGES=(
  direnv
  mise
  lefthook
  bat
  fd
  ripgrep
  exa
)

echo "[install-dev-tools] installing via brew: ${PACKAGES[*]}"
brew install "${PACKAGES[@]}"

echo "[install-dev-tools] done"
