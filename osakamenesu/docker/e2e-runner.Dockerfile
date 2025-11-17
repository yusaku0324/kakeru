FROM mcr.microsoft.com/playwright:v1.56.1-jammy
WORKDIR /workspace
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PNPM_STORE_DIR=/pnpm-store
RUN apt-get update && \
    apt-get install -y python3 && \
    ln -sf python3 /usr/bin/python && \
    npm install -g pnpm@10.20.0 && \
    mkdir -p "$PNPM_STORE_DIR" && \
    npx playwright --version
COPY package.json pnpm-lock.yaml ./
# postinstall scripts expect apps/web to exist for pnpm --dir invocations
COPY apps ./apps
RUN --mount=type=cache,target=/pnpm-store pnpm install --frozen-lockfile
COPY . .
RUN if command -v apt-get >/dev/null 2>&1; then \
        apt-get update && \
        DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata && \
        rm -rf /var/lib/apt/lists/*; \
    elif command -v apk >/dev/null 2>&1; then \
        apk add --no-cache tzdata; \
    else \
        echo "tzdata install not implemented for base image" >&2 && exit 1; \
    fi
