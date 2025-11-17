#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage: scripts/ci-debug.sh [run-id] [--job JOB_NAME]
USAGE
}

RUN_ID=""
JOB_NAME=""
POSITIONAL=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --job)
      if [[ $# -lt 2 ]]; then
        echo "--job requires a job name" >&2
        exit 1
      fi
      JOB_NAME="$2"
      shift 2
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

if [[ ${#POSITIONAL[@]} -ge 1 ]]; then
  RUN_ID="${POSITIONAL[0]}"
fi

cd "$REPO_ROOT"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ -z "$RUN_ID" ]]; then
  RUN_ID=$(gh run list --branch "$BRANCH" --workflow CI --json databaseId,conclusion | jq 'map(select(.conclusion=="failure"))[0].databaseId')
fi

if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
  echo "[ci-debug] Could not determine failed run" >&2
  exit 1
fi

if [[ -z "$JOB_NAME" ]]; then
  gh run view "$RUN_ID" --log
  exit 0
fi

JOB_ID=$(gh run view "$RUN_ID" --json jobs | jq -r --arg name "$JOB_NAME" '.jobs[] | select(.name==$name) | .databaseId')
if [[ -z "$JOB_ID" || "$JOB_ID" == "null" ]]; then
  echo "[ci-debug] failed to find job $JOB_NAME in run $RUN_ID" >&2
  exit 1
fi

OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

if ! gh api "/repos/$OWNER_REPO/actions/jobs/$JOB_ID/logs" >"$TMP"; then
  echo "[ci-debug] failed to download logs for job $JOB_NAME (id=$JOB_ID) in run $RUN_ID" >&2
  exit 1
fi

cat "$TMP"
