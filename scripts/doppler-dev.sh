#!/usr/bin/env bash
set -euo pipefail

CONFIG="${1:-dev_docker}"
PROJECT="osakamenesu"
SERVICES="${2:-osakamenesu-db osakamenesu-meili osakamenesu-redis osakamenesu-api osakamenesu-web}"

if ! command -v doppler >/dev/null 2>&1; then
  echo "doppler CLI が見つかりません。先に https://docs.doppler.com/docs/install-cli を参照してインストールしてください。" >&2
  exit 1
fi

echo "Doppler config=${CONFIG} で docker compose (${SERVICES}) を起動します。"
exec doppler run --project "${PROJECT}" --config "${CONFIG}" -- docker compose up ${SERVICES}
