# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=node:22-alpine
ARG PNPM_VERSION=10.20.0
ARG NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
ARG OSAKAMENESU_API_INTERNAL_BASE=http://osakamenesu-api:8000
ARG NEXT_PUBLIC_OSAKAMENESU_API_BASE=http://127.0.0.1:8000

FROM ${NODE_VERSION} AS base
ARG PNPM_VERSION
ARG NEXT_PUBLIC_SITE_URL
ARG OSAKAMENESU_API_INTERNAL_BASE
ARG NEXT_PUBLIC_OSAKAMENESU_API_BASE
ENV PNPM_HOME=/root/.local/share/pnpm
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV OSAKAMENESU_API_INTERNAL_BASE=$OSAKAMENESU_API_INTERNAL_BASE
ENV API_INTERNAL_BASE=$OSAKAMENESU_API_INTERNAL_BASE
ENV NEXT_PUBLIC_OSAKAMENESU_API_BASE=$NEXT_PUBLIC_OSAKAMENESU_API_BASE
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
    pnpm run build
RUN pnpm prune --prod

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/web/package.json ./package.json
EXPOSE 3000
CMD ["pnpm", "start"]
