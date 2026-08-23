# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Collaborative Whiteboard — web (Next.js 15, standalone output)
# Multi-stage: deps+install, build (next build), runtime (node slim)
# ---------------------------------------------------------------------------

FROM node:20-slim AS base
WORKDIR /app

# ---------------------------------------------------------------------------
# Stage 1 — install all workspace dependencies (build + dev)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2 — build the web app (prebuild compiles @whiteboard/shared first)
# ---------------------------------------------------------------------------
FROM base AS builder
ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_URL=http://localhost:3001
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.2
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=
ARG SENTRY_AUTH_TOKEN=
ARG SENTRY_RELEASE=

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=$NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN \
    SENTRY_RELEASE=$SENTRY_RELEASE \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/apps/web/package.json ./apps/web/package.json
COPY --from=deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=deps /app/packages/shared/package.json ./packages/shared/package.json
COPY . .

RUN npm run build --workspace @whiteboard/web

# ---------------------------------------------------------------------------
# Stage 3 — runtime image (standalone server, non-root)
# ---------------------------------------------------------------------------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001').then(r=>process.exit(r.status>=200&&r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
