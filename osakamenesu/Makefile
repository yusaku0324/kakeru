SHELL := /bin/bash

COMPOSE := docker compose -f docker-compose.yml
ENV_FILE := .env

.PHONY: dev dev-api dev-web \
    osakamenesu-env osakamenesu-up osakamenesu-api osakamenesu-web \
    osakamenesu-dev osakamenesu-down osakamenesu-logs osakamenesu-ps \
    osakamenesu-reset-db osakamenesu-seed ops-sample-seed

dev:
	pnpm dev

dev-api:
	pnpm dev:api

dev-web:
	pnpm dev:web

osakamenesu-env:
	@echo "[docker] copying $(ENV_FILE).example -> $(ENV_FILE) (Docker専用。pnpm dev では不要)"
	cp -n $(ENV_FILE).example $(ENV_FILE) || true
	@echo "[docker] .env をホストの pnpm コマンドで使わないよう注意"

osakamenesu-up: osakamenesu-env
	$(COMPOSE) up -d --build osakamenesu-db osakamenesu-meili

osakamenesu-api: osakamenesu-env
	$(COMPOSE) up -d --build osakamenesu-api
	$(COMPOSE) logs -f osakamenesu-api

osakamenesu-web: osakamenesu-env
	$(COMPOSE) up -d --build osakamenesu-web
	$(COMPOSE) logs -f osakamenesu-web

osakamenesu-dev: osakamenesu-env
	$(COMPOSE) up -d --build
	$(COMPOSE) logs -f osakamenesu-api osakamenesu-web

osakamenesu-down:
	$(COMPOSE) down

osakamenesu-logs:
	$(COMPOSE) logs -f

osakamenesu-ps:
	$(COMPOSE) ps

osakamenesu-reset-db:
	$(COMPOSE) down -v
	$(COMPOSE) up -d osakamenesu-db

osakamenesu-seed:
	$(COMPOSE) exec osakamenesu-api python seed_dev.py

ops-sample-seed:
	cd services/api && \
		doppler run --project osakamenesu --config dev_web -- \
		python tools/seed_ops_samples.py
