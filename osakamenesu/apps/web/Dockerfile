# syntax=docker/dockerfile:1.7
ARG TARGETPLATFORM=linux/amd64
ARG NODE_IMAGE="node:22-alpine@sha256:b2358485e3e33bc3a33114d2b1bdb18cdbe4df01bd2b257198eb51beb1f026c5"
ARG PNPM_VERSION=10.20.0

FROM --platform=${TARGETPLATFORM} ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    pnpm install --frozen-lockfile

FROM deps AS builder
ARG NEXT_PUBLIC_OSAKAMENESU_API_BASE
ARG NEXT_PUBLIC_SITE_URL
ARG FAVORITES_API_MODE
ARG NEXT_PUBLIC_FAVORITES_API_MODE
ENV NEXT_PUBLIC_OSAKAMENESU_API_BASE=$NEXT_PUBLIC_OSAKAMENESU_API_BASE
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV FAVORITES_API_MODE=$FAVORITES_API_MODE
ENV NEXT_PUBLIC_FAVORITES_API_MODE=$NEXT_PUBLIC_FAVORITES_API_MODE
COPY . .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 \
    --mount=type=cache,target=/app/.next/cache \
    pnpm run build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node","server.js"]
