FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /workspace
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PNPM_STORE_DIR=/pnpm-store
RUN npm install -g pnpm@10.20.0 && \
    mkdir -p "$PNPM_STORE_DIR"
COPY package.json pnpm-lock.yaml ./
# postinstall scripts expect apps/web to exist for pnpm --dir invocations
COPY apps ./apps
RUN --mount=type=cache,target=/pnpm-store pnpm install --frozen-lockfile
COPY . .
