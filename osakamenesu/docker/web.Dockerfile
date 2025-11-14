# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=node:22-alpine
ARG PNPM_VERSION=10.20.0

FROM ${NODE_VERSION} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/root/.local/share/pnpm
ENV NEXT_TELEMETRY_DISABLED=1
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app/apps/web

FROM base AS install
COPY apps/web/pnpm-lock.yaml apps/web/package.json ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 pnpm fetch
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 pnpm install --offline --frozen-lockfile

FROM install AS builder
COPY apps/web .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    --mount=type=cache,target=/app/apps/web/.next/cache \
    pnpm exec next build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
