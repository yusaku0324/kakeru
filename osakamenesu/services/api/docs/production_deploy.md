# Production Deployment Checklist

1. Copy `scripts/deploy_api.prod.env.example` to `.env.prod` (or a secure path outside git) and populate:
   - `PROJECT`, `REGION`, `SERVICE`, `MEILI_SERVICE`
   - public URLs (`SITE_BASE_URL`, `MEILI_HOST`) とメール送信設定（`MAIL_APIKEY`, `MAIL_FROM_ADDRESS` など）
   - leave `AUTH_MAGIC_LINK_DEBUG=false` unless you are temporarily troubleshooting authentication
2. Authenticate gcloud with production credentials, e.g. `CLOUDSDK_CONFIG=/secure/config gcloud auth login` and `gcloud config set project <PROJECT>`.
3. Rotate secrets and deploy:
   ```bash
   CLOUDSDK_CONFIG=/secure/config ./scripts/deploy_api.sh --env-file .env.prod --rotate
   ```
   The script prints freshly generated Cloud SQL and Meilisearch secrets—store them securely.
4. Verify the API by requesting a magic link:
   ```bash
   CLOUDSDK_CONFIG=/secure/config API_HOST=<prod-api-url> ./scripts/dev_magic_link.sh
   ```
   If debugging is disabled you will _not_ see `MAGIC_LINK_DEBUG` logs; turn it on temporarily only if safe.
5. Roll back by redeploying the previous container image and restoring prior secrets if anything fails.

> Tip: set `AUTH_MAGIC_LINK_DEBUG=true` only during incident response, then redeploy with it disabled. This keeps production magic links out of Cloud Logging during normal operation.

6. Web フロントの API 参照先を更新:
   ```bash
   PROJECT=<project> REGION=asia-northeast1 API_SERVICE=osakamenesu-api \
     WEB_SERVICE=osakamenesu-web ./apps/web/scripts/update_api_base_env.sh
   ```
   Cloud Run のドメインから API の URL を自動取得し、`NEXT_PUBLIC_OSAKAMENESU_API_BASE` / `NEXT_PUBLIC_API_BASE` を設定します。
