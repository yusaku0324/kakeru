#!/usr/bin/env bash
set -euo pipefail

# Usage: scripts/deploy_api.sh [--env-file path] [--image gcr.io/project/custom-image]
# Relies on gcloud CLI being authenticated. Required environment variables (either exported
# beforehand or provided via --env-file) are:
#   DATABASE_URL (URL-encoded password)
#   SITE_BASE_URL
#   MEILI_HOST
#   MEILI_MASTER_KEY
#   NOTIFY_SMTP_HOST / PORT / USERNAME / PASSWORD / FROM_EMAIL
# Optional: AUTH_MAGIC_LINK_DEBUG (default true)

PROJECT=${PROJECT:-gen-lang-client-0412098348}
REGION=${REGION:-asia-northeast1}
SERVICE=${SERVICE:-osakamenesu-api}
MEILI_SERVICE=${MEILI_SERVICE:-osakamenesu-meili}
IMAGE_DEFAULT="gcr.io/${PROJECT}/osakamenesu-api"
IMAGE="$IMAGE_DEFAULT"
ENV_FILE=""
ROTATE_CREDENTIALS=false

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
    --rotate|--rotate-credentials)
      ROTATE_CREDENTIALS=true
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
    echo "[deploy_api] env file not found: $ENV_FILE" >&2
    exit 1
  fi
  echo "[deploy_api] loading variables from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

SITE_BASE_URL=${SITE_BASE_URL:-https://gemini-stg-794815346083.asia-northeast1.run.app}
MEILI_HOST=${MEILI_HOST:-https://osakamenesu-meili-794815346083.asia-northeast1.run.app}
NOTIFY_SMTP_HOST=${NOTIFY_SMTP_HOST:-sandbox.smtp.mailtrap.io}
NOTIFY_SMTP_PORT=${NOTIFY_SMTP_PORT:-2525}
NOTIFY_SMTP_USERNAME=${NOTIFY_SMTP_USERNAME:-d7f28b27f7218e}
NOTIFY_SMTP_PASSWORD=${NOTIFY_SMTP_PASSWORD:-e1705971ebda5b}
NOTIFY_FROM_EMAIL=${NOTIFY_FROM_EMAIL:-no-reply@osakamenesu-stg.local}
AUTH_MAGIC_LINK_DEBUG=${AUTH_MAGIC_LINK_DEBUG:-true}
AUTH_SESSION_COOKIE_SAMESITE=${AUTH_SESSION_COOKIE_SAMESITE:-lax}
AUTH_SESSION_COOKIE_SECURE=${AUTH_SESSION_COOKIE_SECURE:-}
AUTH_SESSION_COOKIE_DOMAIN=${AUTH_SESSION_COOKIE_DOMAIN:-}

if [[ "${AUTH_MAGIC_LINK_DEBUG,,}" == "true" ]]; then
  echo "[deploy_api] note: AUTH_MAGIC_LINK_DEBUG is enabled. Disable this in production unless actively troubleshooting." >&2
fi

if $ROTATE_CREDENTIALS; then
  echo "[deploy_api] rotating Cloud SQL password"
  NEW_PASS=$(openssl rand -base64 24)
  echo "[deploy_api] new Cloud SQL password: $NEW_PASS"
  gcloud sql users set-password app \
    --project="$PROJECT" \
    --instance=osakamenesu-pg \
    --password="$NEW_PASS"

  ENCODED_PASS=$(python -c "import urllib.parse, sys; print(urllib.parse.quote_plus(sys.argv[1]))" "$NEW_PASS")
  DATABASE_URL="postgresql+asyncpg://app:${ENCODED_PASS}@/osaka_menesu?host=/cloudsql/${PROJECT}:${REGION}:osakamenesu-pg"

  echo "[deploy_api] rotating Meilisearch master key"
  MEILI_MASTER_KEY=$(openssl rand -base64 32)
  echo "[deploy_api] new Meili master key: $MEILI_MASTER_KEY"
  gcloud run services update "$MEILI_SERVICE" \
    --project="$PROJECT" \
    --region="$REGION" \
    --set-env-vars=MEILI_MASTER_KEY="$MEILI_MASTER_KEY"
else
  REQUIRED=(
    DATABASE_URL
    MEILI_MASTER_KEY
    ADMIN_API_KEY
  )

  missing=()
  for var in "${REQUIRED[@]}"; do
    if [[ -z "${!var-}" ]]; then
      missing+=("$var")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    echo "[deploy_api] missing required variables: ${missing[*]}" >&2
    exit 1
  fi
fi

ROOT_DIR=$(git rev-parse --show-toplevel)
API_DIR="$ROOT_DIR/osakamenesu/services/api"

if [[ ! -d "$API_DIR" ]]; then
  echo "[deploy_api] unable to locate services/api directory at $API_DIR" >&2
  exit 1
fi

echo "[deploy_api] building container image ($IMAGE)"
gcloud builds submit "$API_DIR" \
  --project="$PROJECT" \
  --tag="$IMAGE"

env_pairs=(
  "DATABASE_URL=$DATABASE_URL"
  "SITE_BASE_URL=$SITE_BASE_URL"
  "MEILI_HOST=$MEILI_HOST"
  "MEILI_MASTER_KEY=$MEILI_MASTER_KEY"
  "AUTH_MAGIC_LINK_DEBUG=$AUTH_MAGIC_LINK_DEBUG"
  "NOTIFY_SMTP_HOST=$NOTIFY_SMTP_HOST"
  "NOTIFY_SMTP_PORT=$NOTIFY_SMTP_PORT"
  "NOTIFY_SMTP_USERNAME=$NOTIFY_SMTP_USERNAME"
  "NOTIFY_SMTP_PASSWORD=$NOTIFY_SMTP_PASSWORD"
  "NOTIFY_FROM_EMAIL=$NOTIFY_FROM_EMAIL"
  "ADMIN_API_KEY=$ADMIN_API_KEY"
  "OSAKAMENESU_ADMIN_API_KEY=$ADMIN_API_KEY"
  "AUTH_SESSION_COOKIE_SAMESITE=$AUTH_SESSION_COOKIE_SAMESITE"
)

if [[ -n "$AUTH_SESSION_COOKIE_SECURE" ]]; then
  env_pairs+=("AUTH_SESSION_COOKIE_SECURE=$AUTH_SESSION_COOKIE_SECURE")
fi

if [[ -n "$AUTH_SESSION_COOKIE_DOMAIN" ]]; then
  env_pairs+=("AUTH_SESSION_COOKIE_DOMAIN=$AUTH_SESSION_COOKIE_DOMAIN")
fi

env_arg=$(IFS=, ; echo "${env_pairs[*]}")

echo "[deploy_api] updating Cloud Run service ($SERVICE)"
gcloud run services update "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --image="$IMAGE" \
  --add-cloudsql-instances="${PROJECT}:${REGION}:osakamenesu-pg" \
  --set-env-vars="$env_arg"

echo "[deploy_api] deployment complete"
