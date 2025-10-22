FROM node:20-slim AS builder
ARG NEXT_PUBLIC_OSAKAMENESU_API_BASE
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_OSAKAMENESU_API_BASE=$NEXT_PUBLIC_OSAKAMENESU_API_BASE
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
ARG NEXT_PUBLIC_OSAKAMENESU_API_BASE
ARG NEXT_PUBLIC_SITE_URL
ENV NODE_ENV=production
ENV NEXT_PUBLIC_OSAKAMENESU_API_BASE=$NEXT_PUBLIC_OSAKAMENESU_API_BASE
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/tailwind.config.ts ./
COPY --from=builder /app/postcss.config.js ./
COPY --from=builder /app/src ./src
EXPOSE 8080
CMD ["sh","-c","npm run start -- -p ${PORT:-8080} --hostname 0.0.0.0"]
