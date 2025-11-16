# Agent Operating Rules

## 1. Canonical Repository & Directories
- Work **only** in `/Users/yusaku/Developer/kakeru/osakamenesu`.
- Never operate on `/Users/yusaku/Repositories/kakeru-local`, `/Users/yusaku/kakeru`, or `/Users/yusaku/kakeru-local-backup`.
- Run all git, test, build, and Docker commands inside the canonical repo.
- Default branch: `feat/guest-ux` (ask before switching).

## 2. Git Safety
- Before `git pull`/`git merge`: run `git status -sb` and ensure a clean tree; otherwise stop and ask.
- Never run `git reset --hard` or `git push --force` without explicit approval.

## 3. Standard Web (apps/web) Commands
```bash
cd /Users/yusaku/Developer/kakeru/osakamenesu/osakamenesu/apps/web
pnpm exec tsc --noEmit
pnpm test:unit
doppler run --project osakamenesu --config dev_web -- pnpm exec playwright test e2e/reservations-mvp.spec.ts
doppler run --project osakamenesu --config dev_web -- pnpm exec playwright test e2e/admin-dashboard.spec.ts --grep "店舗情報を更新して元に戻せる"
```
- Full E2E only on request: `doppler run --project osakamenesu --config dev_web -- pnpm test:e2e`.

## 4. Docker Usage
- Use docker-compose in `/Users/yusaku/Developer/kakeru/osakamenesu`.
- Start backend stack:
```bash
cd /Users/yusaku/Developer/kakeru/osakamenesu
docker compose up osakamenesu-db osakamenesu-redis osakamenesu-meili osakamenesu-api
```
- If `osakamenesu-api-1` exits, inspect logs first: `docker logs osakamenesu-api-1` and share traceback before changing DB/migrations.

## 5. Environment / Doppler
- Configs: `dev_api`/`dev_web` (dev), `stg_api`/`stg_web` (staging), `prod_*` (future).
- Wrap backend commands with `doppler run --project osakamenesu --config dev_api -- <cmd>`.
- Wrap web E2E/dev commands with `doppler run --project osakamenesu --config dev_web -- <cmd>`.
- Do not create/modify Doppler configs without approval.

## 6. Dangerous Operations (Ask First)
- Do not run: `git reset --hard`, `git push --force`, DB drops, destructive SQL, `alembic downgrade`, removing shared Docker volumes/images, or editing applied migrations without explicit approval.

## 7. Architecture Expectations
- **FastAPI:** keep routers thin; business logic in domain/service modules.
- **Next.js:** follow vertical slices: `features/<domain>/{model, infra, usecases, ui}`; never call FastAPI directly from components—use Next.js BFF route handlers and feature infra/usecases.
- Keep shared logic organized (e.g., `features/_shared`, `src/lib/domain`) and avoid random cross-cutting utilities.
