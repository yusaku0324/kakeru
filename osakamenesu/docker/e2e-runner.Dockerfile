FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /workspace
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package.json pnpm-lock.yaml ./ 
RUN pnpm install --frozen-lockfile
COPY . .
