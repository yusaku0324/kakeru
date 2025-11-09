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
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 pnpm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app/apps/web
COPY apps/web/pnpm-lock.yaml apps/web/package.json ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 pnpm fetch
RUN --mount=type=cache,target=/root/.local/share/pnpm/store/v3 pnpm install --offline --frozen-lockfile --prod
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/next.config.ts ./next.config.ts
COPY --from=builder /app/apps/web/tailwind.config.ts ./tailwind.config.ts
COPY --from=builder /app/apps/web/postcss.config.js ./postcss.config.js
COPY --from=builder /app/apps/web/src ./src
EXPOSE 8080
CMD ["sh","-c","pnpm run start -- -p ${PORT:-8080} --hostname 0.0.0.0"]
