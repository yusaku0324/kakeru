#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID=$(gcloud config get-value project 2>/dev/null)

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Failed to resolve current gcloud project. Run 'gcloud config set project <PROJECT_ID>' and retry." >&2
  exit 1
fi

SECRETS="ADMIN_API_KEY=ADMIN_API_KEY:latest,OSAKAMENESU_ADMIN_API_KEY=OSAKAMENESU_ADMIN_API_KEY:latest,MEILI_MASTER_KEY=MEILI_MASTER_KEY:latest"

ENV_VARS="DATABASE_URL=postgresql+asyncpg://app:osakamenesu@/osaka_menesu?host=/cloudsql/gen-lang-client-0412098348:asia-northeast1:osakamenesu-pg,MEILI_HOST=https://osakamenesu-meili-g4sue2ytha-an.a.run.app,SITE_BASE_URL=https://osakamenesu-web-794815346083.asia-northeast1.run.app,AUTH_MAGIC_LINK_DEBUG=true,AUTH_MAGIC_LINK_RATE_LIMIT=100,MAIL_APIKEY=re_VSHq8ksv_Asftio9pUfVkrPJTkExEbyCY,MAIL_FROM_ADDRESS=dmarc@osakamenesu.com,NEXT_PUBLIC_OSAKAMENESU_API_BASE=https://osakamenesu-api-794815346083.asia-northeast1.run.app,MAIL_PROVIDER_BASE_URL=https://api.resend.com"

exec gcloud run deploy osakamenesu-api \
  --region=asia-northeast1 \
  --source=. \
  --allow-unauthenticated \
  --set-secrets="${SECRETS}" \
  --set-env-vars="${ENV_VARS}"
