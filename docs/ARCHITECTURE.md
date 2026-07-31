# Architecture

## System Overview

```
                         ┌────────────────────────────────────────────┐
                         │                  Browser                    │
                         │  Next.js 15 · React 19 · Konva · Zustand    │
                         └───────┬─────────────────────────┬──────────┘
                                 │ REST (fetch)            │ Socket.IO (realtime)
                                 ▼                         ▼
                        ┌─────────────────┐        ┌──────────────────┐
                        │    NestJS API    │◄──────►│  Socket.IO       │
                        │  (REST + Guards) │        │  Gateway         │
                        └───────┬─────────┘        └────────┬─────────┘
                                │ Prisma                   │ Redis Adapter
                                ▼                          ▼
                       ┌────────────────┐        ┌────────────────────┐
                       │  PostgreSQL     │        │  Redis (presence,  │
                       │  (source of     │        │  rate limit,       │
                       │   truth)        │        │  token denylist)   │
                       └────────────────┘        └────────────────────┘
                                │
                                ▼
                      Cloudinary (image/asset storage)
```

## Architectural Decisions (ADR Log)

The ADR log is the authoritative record of non-obvious decisions. Every entry
follows the template below. Sessions MUST read all entries before implementing.

### ADR-0001: npm workspaces monorepo

- **Status**: Accepted
- **Context**: Two applications (Next.js, NestJS) and a shared contract package must stay version-synced and deployable independently.
- **Decision**: Single git repository with `npm workspaces` (`apps/*`, `packages/*`). `@whiteboard/shared` holds cross-cutting types, DTOs, and validation schemas consumed by both apps.
- **Consequences**: One PR per phase, shared lockfile, atomic cross-app refactors. Trade-off: full CI build every change (mitigated by CI workflow scoping in Phase 15).

### ADR-0002: TypeScript-first contract via shared package

- **Status**: Accepted
- **Context**: REST DTOs and Socket.IO payloads are duplicated risks between frontend and backend.
- **Decision**: Single source of truth in `packages/shared`. Backend DTO classes validate at runtime (class-validator); frontend consumes the same shapes through generated types + Zod schemas.
- **Consequences**: Type drift eliminated; validation rules live in one place.

### ADR-0003: Redis adapter for Socket.IO horizontal scaling

- **Status**: Accepted
- **Context**: Realtime features (presence, cursors, drawing) must survive multiple API instances.
- **Decision**: Socket.IO Redis adapter (pub/sub) with presence registry in Redis. Board events are scoped to per-board rooms. Details land in Phase 6.
- **Consequences**: Adds Redis as a hard dependency of the API; makes presence queryable outside a single Node process.

### ADR-0004: Last-write-wins with per-element versioning

- **Status**: Proposed
- **Context**: Concurrent edits to the same board element by multiple users.
- **Decision**: Each board element carries a monotonic version + lastModifiedBy; server accepts LWW per element with an optional CRDT upgrade path (see Future Enhancements).
- **Consequences**: Simple, predictable conflict model. Concurrent edits to different elements never conflict. Fine-grained merge conflicts are out of scope for v1.

### ADR-0005: Debounced autosave + offline queue

- **Status**: Proposed
- **Context**: Board edits are frequent; network failures and offline usage are expected.
- **Decision**: 1.5s debounced autosave over REST with an IndexedDB-backed offline mutation queue flushed on reconnect; server rejects stale versions to surface conflicts.
- **Consequences**: Near-zero save latency perception; requires version/conflict detection in Phase 13.

### ADR-0006: Access + rotating refresh tokens

- **Status**: Proposed
- **Context**: Short-lived JWTs are safer but poor UX; long-lived ones are risky.
- **Decision**: 15-minute access token + 30-day refresh token stored hashed in `Session` with rotation on use, device/IP metadata, and server-side revocation. Redis denylist for immediate logout.
- **Consequences**: Requires session table + revocation endpoint; OAuth-less flows remain stateless per request.

### ADR-0007: Uniform API envelope + centralized errors

- **Status**: Accepted
- **Context**: Frontend needs one shape for success and failure responses, and backend must never leak internals to clients.
- **Decision**: Every HTTP response uses `{ success, data }` or `{ success: false, data: null, error: { code, message, details } }` via a global transform interceptor and a single all-exceptions filter (maps `HttpException` and Prisma errors P2002/P2003/P2025 to typed codes). Internal details are hidden outside `NODE_ENV=development`.
- **Consequences**: Consistent client handling; validation errors surface as `VALIDATION_ERROR` with a `details` array.

### ADR-0008: Prisma 7 with generated client + driver adapter

- **Status**: Accepted
- **Context**: Prisma 7 moved to a driver-adapter + generated-prisma-client model (no `url` in the datasource).
- **Decision**: `generator client` with `provider = "prisma-client"` writes to `src/generated/prisma` (committed); the runtime uses `@prisma/adapter-pg`; `DATABASE_URL` lives in `prisma.config.ts` + env. Jest resolves the generated `.js` import specifiers via a scoped `moduleNameMapper`.
- **Consequences**: Type-safe, bundled client; generated code is part of the repo, so the test/build pipeline needs no network.

### ADR-0009: Request-Id correlation + request logging

- **Status**: Accepted
- **Context**: Distributed debugging needs a single id per request across logs and client responses.
- **Decision**: Functional Express middleware sets `x-request-id` (honours inbound header, else UUID) on `req.id` and the response; a global logging interceptor records method, path, status, duration with the id. Registered via `app.use` so it covers every route including prefix-excluded paths.
- **Consequences**: All log lines and HTTP responses are correlated by request id.

### ADR-0010: Joi-validated config with explicit defaults

- **Status**: Accepted
- **Context**: Env drift between dev, test, and prod causes runtime surprises; `process.env` reads are unchecked.
- **Decision**: One Joi schema (`env.validation.ts`) validates `process.env` at boot (fail fast, `abortEarly: false`); typed config access via `@nestjs/config` factory (`configuration.ts`). Optional keys use `.empty('')` so blank `.env` placeholders are treated as absent.
- **Consequences**: Startup fails with a complete list of invalid vars; consumers get typed, defaulted config.

## Scaling Strategy (summary)

- **Stateless API** — horizontal scaling behind a load balancer.
- **Redis-backed presence** — member→board mapping survives instance restarts.
- **Socket.IO adapter** — broadcasts fan out across instances.
- **PostgreSQL** — read replicas for board listing/search; cursor pagination everywhere.
- **CDN** — Cloudinary for images/thumbnails; Next.js ISR for public share pages.
- **Queue** — out-of-band email/notification work moves to a job queue (BullMQ) in Phase 7.

## Future Enhancements

See `docs/PRD.md` (Part 16): offline-first via CRDTs, AI diagram generation, AI assistant, voice/video, plugin system, template marketplace.
