# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Collaborative Whiteboard — api (NestJS 11, Prisma 7 driver adapter)
# Multi-stage: deps+install, build (nest build), runtime (node slim + migrate)
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
# Stage 2 — build the API (prebuild compiles @whiteboard/shared + prisma generate)
# ---------------------------------------------------------------------------
FROM base AS builder
# prisma generate resolves DATABASE_URL from prisma.config.ts; a placeholder is
# enough at build time because no connection is made.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build?schema=public
ENV DATABASE_URL=$DATABASE_URL \
    NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/apps/web/package.json ./apps/web/package.json
COPY --from=deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=deps /app/packages/shared/package.json ./packages/shared/package.json
COPY . .

RUN npm run build --workspace @whiteboard/api

# ---------------------------------------------------------------------------
# Stage 3 — runtime image (prod deps only, non-root, optional migrations)
# ---------------------------------------------------------------------------
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nestjs

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
# The shared workspace is consumed at runtime through its compiled dist.
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --chown=nestjs:nodejs apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x ./apps/api/docker-entrypoint.sh

USER nestjs
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/apps/api
ENTRYPOINT ["./docker-entrypoint.sh"]
