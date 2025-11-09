# syntax=docker/dockerfile:1.7
FROM node:20-slim AS base
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PNPM_VERSION=10.20.0
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      wget \
      gnupg \
      ca-certificates \
      libasound2 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libgbm1 \
      libglib2.0-0 \
      libgtk-3-0 \
      libnss3 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libxshmfence1 \
      xdg-utils \
      fonts-noto-color-emoji \
      fonts-noto-cjk && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate && \
    npx playwright@1.56.1 install --with-deps chromium
