FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /workspace
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PNPM_VERSION=10.20.0 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
COPY package.json pnpm-lock.yaml ./ 
RUN pnpm install --frozen-lockfile
COPY . .
