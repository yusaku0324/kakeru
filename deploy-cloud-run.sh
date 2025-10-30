#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME=${SERVICE_NAME:-osakamenesu-api}
REGION=${REGION:-asia-northeast1}

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Failed to resolve current gcloud project. Run 'gcloud config set project <PROJECT_ID>' and retry." >&2
  exit 1
fi

if ! gcloud secrets describe "MAIL_APIKEY" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "Secret Manager entry 'MAIL_APIKEY' is not accessible in project ${PROJECT_ID}." >&2
  exit 1
fi

SECRETS="ADMIN_API_KEY=ADMIN_API_KEY:latest,OSAKAMENESU_ADMIN_API_KEY=OSAKAMENESU_ADMIN_API_KEY:latest,MEILI_MASTER_KEY=MEILI_MASTER_KEY:latest,MAIL_APIKEY=MAIL_APIKEY:latest"

DATABASE_URL=${DATABASE_URL:-postgresql+asyncpg://app:osakamenesu@/osaka_menesu?host=/cloudsql/${PROJECT_ID}:${REGION}:osakamenesu-pg}
MEILI_HOST=${MEILI_HOST:-https://osakamenesu-meili-g4sue2ytha-an.a.run.app}
SITE_BASE_URL=${SITE_BASE_URL:-https://osakamenesu-web-794815346083.asia-northeast1.run.app}
AUTH_MAGIC_LINK_DEBUG=${AUTH_MAGIC_LINK_DEBUG:-true}
AUTH_MAGIC_LINK_RATE_LIMIT=${AUTH_MAGIC_LINK_RATE_LIMIT:-100}
MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS:-dmarc@osakamenesu.com}
MAIL_PROVIDER_BASE_URL=${MAIL_PROVIDER_BASE_URL:-https://api.resend.com}
NEXT_PUBLIC_OSAKAMENESU_API_BASE=${NEXT_PUBLIC_OSAKAMENESU_API_BASE:-https://osakamenesu-api-794815346083.asia-northeast1.run.app}

ENV_FILE=$(mktemp)
trap 'rm -f "$ENV_FILE"' EXIT
export DATABASE_URL MEILI_HOST SITE_BASE_URL AUTH_MAGIC_LINK_DEBUG AUTH_MAGIC_LINK_RATE_LIMIT MAIL_FROM_ADDRESS MAIL_PROVIDER_BASE_URL NEXT_PUBLIC_OSAKAMENESU_API_BASE ENV_FILE
python3 <<'PY'
import os
keys = [
    "DATABASE_URL",
    "MEILI_HOST",
    "SITE_BASE_URL",
    "AUTH_MAGIC_LINK_DEBUG",
    "AUTH_MAGIC_LINK_RATE_LIMIT",
    "MAIL_FROM_ADDRESS",
    "MAIL_PROVIDER_BASE_URL",
    "NEXT_PUBLIC_OSAKAMENESU_API_BASE",
]
path = os.environ["ENV_FILE"]
with open(path, "w", encoding="utf-8") as fh:
    for key in keys:
        value = os.environ.get(key, "")
        fh.write(f"{key}={value}\n")
PY

if gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  gcloud run services update "${SERVICE_NAME}" \
    --region "${REGION}" \
    --remove-env-vars "MAIL_APIKEY" \
    --remove-secrets "MAIL_APIKEY" \
    --quiet
fi

exec gcloud run deploy "${SERVICE_NAME}" \
  --region="${REGION}" \
  --source=. \
  --allow-unauthenticated \
  --env-vars-file="${ENV_FILE}" \
  --set-secrets="${SECRETS}" \
  --quiet
