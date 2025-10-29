#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/deploy_web.sh [--env-file path] [--image gcr.io/project/custom-image] [--skip-build]
# Relies on gcloud CLI being authenticated.
# Required environment variables (either exported beforehand or provided via --env-file) are:
#   NEXT_PUBLIC_SITE_URL
#   NEXT_PUBLIC_OSAKAMENESU_API_BASE (or NEXT_PUBLIC_API_BASE)
#   ADMIN_API_KEY (or OSAKAMENESU_ADMIN_API_KEY)
#
# Optional variables that will be forwarded when present:
#   OSAKAMENESU_API_INTERNAL_BASE (defaults to NEXT_PUBLIC_OSAKAMENESU_API_BASE)
#   API_INTERNAL_BASE
#   NEXT_PUBLIC_API_BASE (defaults to NEXT_PUBLIC_OSAKAMENESU_API_BASE)
#   ADMIN_BASIC_USER / ADMIN_BASIC_PASS
#   OSAKAMENESU_ADMIN_API_KEY (falls back to ADMIN_API_KEY)
#   NEXT_PUBLIC_GA_MEASUREMENT_ID, NEXT_PUBLIC_SENTRY_DSN, etc. (anything already exported before running)

PROJECT=${PROJECT:-gen-lang-client-0412098348}
REGION=${REGION:-asia-northeast1}
SERVICE=${SERVICE:-osakamenesu-web}
API_SERVICE=${API_SERVICE:-osakamenesu-api}
IMAGE_DEFAULT="gcr.io/${PROJECT}/osakamenesu-web"
IMAGE="$IMAGE_DEFAULT"
ENV_FILE=""
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="$2"
      shift 2
      ;;
    --image)
      IMAGE="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "[deploy_web] env file not found: $ENV_FILE" >&2
    exit 1
  fi
  echo "[deploy_web] loading variables from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "[deploy_web] gcloud CLI が見つかりません。先にインストール / 認証してください。" >&2
  exit 1
fi

if [[ -z "${NEXT_PUBLIC_OSAKAMENESU_API_BASE:-}" && -n "${NEXT_PUBLIC_API_BASE:-}" ]]; then
  NEXT_PUBLIC_OSAKAMENESU_API_BASE="$NEXT_PUBLIC_API_BASE"
fi

if [[ -z "${NEXT_PUBLIC_OSAKAMENESU_API_BASE:-}" ]]; then
  echo "[deploy_web] NEXT_PUBLIC_OSAKAMENESU_API_BASE が未指定のため、Cloud Run (${API_SERVICE}) から取得します"
  NEXT_PUBLIC_OSAKAMENESU_API_BASE=$(gcloud run services describe "$API_SERVICE" \
    --project="$PROJECT" \
    --region="$REGION" \
    --format='value(status.url)' || true)
fi

if [[ -z "${NEXT_PUBLIC_SITE_URL:-}" ]]; then
  echo "[deploy_web] NEXT_PUBLIC_SITE_URL が未設定です。既存サービスの URL 取得を試みます。"
  NEXT_PUBLIC_SITE_URL=$(gcloud run services describe "$SERVICE" \
    --project="$PROJECT" \
    --region="$REGION" \
    --format='value(status.url)' || true)
fi

ADMIN_KEY_VALUE=${ADMIN_API_KEY:-${OSAKAMENESU_ADMIN_API_KEY:-}}

REQUIRED=()
[[ -z "${NEXT_PUBLIC_SITE_URL:-}" ]] && REQUIRED+=("NEXT_PUBLIC_SITE_URL")
[[ -z "${NEXT_PUBLIC_OSAKAMENESU_API_BASE:-}" ]] && REQUIRED+=("NEXT_PUBLIC_OSAKAMENESU_API_BASE")
[[ -z "$ADMIN_KEY_VALUE" ]] && REQUIRED+=("ADMIN_API_KEY")

if (( ${#REQUIRED[@]} > 0 )); then
  echo "[deploy_web] missing required variables: ${REQUIRED[*]}" >&2
  exit 1
fi

if [[ -z "${NEXT_PUBLIC_API_BASE:-}" ]]; then
  NEXT_PUBLIC_API_BASE="$NEXT_PUBLIC_OSAKAMENESU_API_BASE"
fi

if [[ -z "${OSAKAMENESU_API_INTERNAL_BASE:-}" ]]; then
  OSAKAMENESU_API_INTERNAL_BASE="$NEXT_PUBLIC_OSAKAMENESU_API_BASE"
fi

ROOT_DIR=$(git rev-parse --show-toplevel)
WEB_DIR="$ROOT_DIR/osakamenesu/apps/web"

if [[ ! -d "$WEB_DIR" ]]; then
  echo "[deploy_web] unable to locate apps/web directory at $WEB_DIR" >&2
  exit 1
fi

if ! $SKIP_BUILD; then
  echo "[deploy_web] building container image ($IMAGE)"
  gcloud builds submit "$WEB_DIR" \
    --project="$PROJECT" \
    --tag="$IMAGE" \
    --build-arg=NEXT_PUBLIC_OSAKAMENESU_API_BASE="$NEXT_PUBLIC_OSAKAMENESU_API_BASE" \
    --build-arg=NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL"
else
  echo "[deploy_web] skipping build step (using existing image: $IMAGE)"
fi

env_pairs=(
  "NODE_ENV=production"
  "NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL"
  "NEXT_PUBLIC_OSAKAMENESU_API_BASE=$NEXT_PUBLIC_OSAKAMENESU_API_BASE"
  "NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE"
  "OSAKAMENESU_API_INTERNAL_BASE=$OSAKAMENESU_API_INTERNAL_BASE"
  "API_INTERNAL_BASE=$OSAKAMENESU_API_INTERNAL_BASE"
  "ADMIN_API_KEY=$ADMIN_KEY_VALUE"
  "OSAKAMENESU_ADMIN_API_KEY=$ADMIN_KEY_VALUE"
)

if [[ -n "${ADMIN_BASIC_USER:-}" ]]; then
  env_pairs+=("ADMIN_BASIC_USER=$ADMIN_BASIC_USER")
fi

if [[ -n "${ADMIN_BASIC_PASS:-}" ]]; then
  env_pairs+=("ADMIN_BASIC_PASS=$ADMIN_BASIC_PASS")
fi

if [[ -n "${NEXT_PUBLIC_GA_MEASUREMENT_ID:-}" ]]; then
  env_pairs+=("NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID")
fi

if [[ -n "${NEXT_PUBLIC_SENTRY_DSN:-}" ]]; then
  env_pairs+=("NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN")
fi

if [[ -n "${EXTRA_ENV_VARS:-}" ]]; then
  env_pairs+=("$EXTRA_ENV_VARS")
fi

env_arg=$(IFS=, ; echo "${env_pairs[*]}")

echo "[deploy_web] updating Cloud Run service ($SERVICE)"
gcloud run services update "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --set-env-vars="$env_arg"

echo "[deploy_web] deployment complete"
