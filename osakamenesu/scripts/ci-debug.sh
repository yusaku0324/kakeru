#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! command -v gh >/dev/null 2>&1; then
  echo "[ci-debug] GitHub CLI (gh) is required." >&2
  exit 1
fi

if ! command -v rg >/dev/null 2>&1; then
  echo "[ci-debug] ripgrep (rg) is required." >&2
  exit 1
fi

usage() {
  cat <<'USAGE'
Usage: scripts/ci-debug.sh [run-id] [--job JOB_NAME]

- If run-id is omitted, the latest failed run on the current branch is used.
- Set RG_PATTERN to override the default error regex (ERROR|FAIL|Traceback|AssertionError).
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
      if [[ -z "$RUN_ID" ]]; then
        RUN_ID="$1"
        shift 1
      else
        POSITIONAL+=("$1")
        shift 1
      fi
      ;;
  esac
done

if [[ ${#POSITIONAL[@]} -gt 0 ]]; then
  echo "Unknown arguments: ${POSITIONAL[*]}" >&2
  exit 1
fi

BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"

if [[ -z "$RUN_ID" ]]; then
  RUN_ID="$(gh run list --branch "$BRANCH" --limit 1 --status failure --json databaseId --jq '.[0].databaseId' || true)"
  if [[ -z "$RUN_ID" || "$RUN_ID" == "null" ]]; then
    echo "No failed runs found for branch '$BRANCH'." >&2
    exit 1
  fi
fi

LOG_DIR="$REPO_ROOT/tmp/ci-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/run-${RUN_ID}${JOB_NAME:+-$JOB_NAME}.log"

CMD=(gh run view "$RUN_ID" --log)
if [[ -n "$JOB_NAME" ]]; then
  CMD+=(--job "$JOB_NAME")
fi

"${CMD[@]}" > "$LOG_FILE"
echo "Downloaded log → $LOG_FILE"

PATTERN="${RG_PATTERN:-ERROR|FAIL|Traceback|AssertionError|UnhandledPromiseRejection}"
if ! rg -n --passthru -C3 "$PATTERN" "$LOG_FILE"; then
  echo "No matches for pattern '$PATTERN'." >&2
fi
