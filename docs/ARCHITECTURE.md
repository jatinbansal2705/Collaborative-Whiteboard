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
- **Decision**: Socket.IO Redis adapter (pub/sub) with presence registry in Redis. Board events are scoped to per-board rooms (`board:<boardId>`). Implemented in Phase 6: `RedisService` owns three ioredis clients (primary + a pub/sub pair handed to the adapter via a custom `SocketIoAdapter`).
- **Consequences**: Adds Redis as a hard dependency of the API; makes presence queryable outside a single Node process.

### ADR-0004: Last-write-wins with per-element versioning

- **Status**: Accepted
- **Context**: Concurrent edits to the same board element by multiple users.
- **Decision**: Each board element carries a monotonic version + lastModifiedBy; the server accepts LWW per element via an atomic compare-and-set in Redis (`board:version:<boardId>:<elementId>`, strictly-higher versions win) and rejects stale writes with `STALE_VERSION`. An optional CRDT upgrade path remains (see Future Enhancements).
- **Consequences**: Simple, predictable conflict model. Concurrent edits to different elements never conflict. Fine-grained merge conflicts are out of scope for v1.

### ADR-0005: Debounced autosave + offline queue

- **Status**: Accepted
- **Context**: Board edits are frequent; network failures and offline usage are expected.
- **Decision**: 1.5s debounced autosave over REST with an IndexedDB-backed offline mutation queue flushed on reconnect; server rejects stale versions to surface conflicts. Versions are immutable full-board snapshots written on autosave (capped per board) and restored non-destructively (current canvas is preserved as a new version on restore). Autosave state (idle/saving/saved/error/offline/pending-restore) is tracked in a client store and surfaced in the header. Realtime `board:revision`/`board:restored` events sync the autosave base so remote edits never trigger a false stale-write; board snapshots, timeline and activity are served by REST (`boards/:id/versions`, `boards/:id/activity`).
- **Consequences**: Near-zero save latency perception; requires version/conflict detection in Phase 13. IndexedDB offline queue falls back to an in-memory queue when the API is unavailable (e.g. SSR or restricted browsers).

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

### ADR-0011: OAuth handoff-code pattern

- **Status**: Accepted
- **Context**: The Google callback redirect cannot hand tokens back through the URL (they would leak into logs/history), and a stateful server session cookie is awkward for an SPA with CORS and a separate frontend origin.
- **Decision**: The callback authenticates server-side, creates a real session, and returns a short-lived (5 min) JWT "handoff code" carrying `sid` + the refresh-token hash. The frontend exchanges it for tokens at `POST /auth/google/exchange`, which validates the code against the live session and rotates it. CSRF is mitigated by a random nonce stored in the httpOnly `whiteboard_oauth_state` cookie (10 min, sameSite lax) and compared to the `state` query param; with passport's `NullStore` the state is checked manually in the controller.
- **Consequences**: Tokens never appear in URLs or logs; the exchange is single-use by rotation; a leaked code is useless after the session expires.

### ADR-0012: Email verification + hashed single-use reset tokens

- **Status**: Accepted
- **Context**: Accounts need a verified-email gate, and reset tokens stored in plaintext are a DB-leak risk.
- **Decision**: `User.emailVerifiedAt` gates login; Google accounts are treated as verified. Verification and reset links are short-lived JWTs with an embedded jti. Reset tokens are stored as sha256 hashes (`PasswordResetToken.tokenHash`, unique) with an expiry and a `usedAt` mark, domain-separated from refresh-token hashing. `forgot-password`/`resend-verification` always return generic messages; email delivery failures are logged by `AuthService.safelySend`, never surfaced.
- **Consequences**: A DB dump cannot be replayed to reset passwords; account enumeration is mitigated; email outages do not break the auth response contract.

### ADR-0013: Per-route auth rate limiting

- **Status**: Accepted
- **Context**: The global throttler is too coarse for credential-stuffing and email-spam vectors on auth endpoints.
- **Decision**: `@Throttle` decorators with env-overridable constants: login/register `AUTH_RATE_LIMIT` per minute, `forgot-password` `AUTH_FORGOT_RATE_LIMIT` per hour, `resend-verification` `AUTH_RESEND_RATE_LIMIT` per minute; `verificationSentAt` enforces a 60s resend cooldown per account.
- **Consequences**: Brute force and inbox flooding are bounded; tests raise the limits via env so e2e suites stay fast.

### ADR-0014: Board role hierarchy + cursor pagination

- **Status**: Accepted
- **Context**: Board permissions are graded (VIEWER → COMMENTER → EDITOR → OWNER) and dashboards need stable, scalable list pagination.
- **Decision**: Board access is enforced by a dedicated `BoardAccessGuard` using a `BoardAccess({ minRole, ownerOnly })` decorator; it resolves the `:id`/`:boardId` param, looks up the caller's `BoardMember` row, and compares ranks (`BOARD_ROLE_RANK`). Guards only gate membership — services independently verify the board is not soft-deleted. Listing uses keyset (cursor) pagination over a base64url `[value, id]` cursor with the id as a tiebreaker, so pages stay stable under concurrent inserts/updates; date fields are serialized to ISO strings and `memberCount` stays numeric. `memberCount` is denormalized on `Board` (increment/decrement on membership changes) and the title search uses a `pg_trgm` GIN index.
- **Consequences**: Deleting the soft-delete owner transfer updates `Board.createdBy`; changing a role to OWNER demotes the prior owner to EDITOR. Pagination is O(1) per page and duplicate-safe; offset page numbers are not offered.

### ADR-0015: Socket handshake auth + Redis presence registry

- **Status**: Accepted
- **Context**: The `/boards` Socket.IO namespace must only accept authenticated users, and presence/cursor/draw features need a shareable member registry across instances.
- **Decision**: Authentication runs as socket.io middleware (`server.use`) — the token is read from `auth.token` or the `Authorization: Bearer` header, verified via `TokenService.verifyAccessToken`, and stored on `socket.data.user`. Middleware (not `handleConnection`) buffers client packets until the async check finishes, and a rejection emits `connect_error` carrying the standard `{ ok: false, error: { code, message } }` envelope before the client disconnects. Presence is stored two ways in Redis — `presence:board:<boardId>` (socketId → record, the roster source) and `presence:user:<userId>` (used to locate sockets for kicks) — with TTLs refreshed on every write so stale entries expire. All client events are validated against the shared Zod schemas and answered with `{ ok: true, data }` / `{ ok: false, error }`.
- **Consequences**: Unauthenticated sockets never join rooms or send events; the roster is queryable by any API instance; the ack envelope mirrors the REST contract for uniform client handling. Cursor traffic is throttled per socket (`cursorMinIntervalMs`) with latest-position coalescing. Board lifecycle hooks (`RealtimeService.closeBoard`/`kick`) fire from `BoardsService` on delete, member removal, and leave.

### ADR-0016: BullMQ email queue with worker isolation

- **Status**: Accepted
- **Context**: Mention notifications need asynchronous email delivery that must not block the request path and should survive short-lived infrastructure hiccups.
- **Decision**: BullMQ (`@nestjs/bullmq`, queue name from `EMAIL_QUEUE_NAME`, default `email`) is wired once in `AppModule` via `BullModule.forRootAsync` reusing the existing Redis URL. The email queue is owned by `NotificationsModule`; jobs carry `EmailJobData` (`MentionEmailJobData` for mention emails) and are processed by a `@Processor` `WorkerHost` (`EmailQueueProcessor`) that calls `EmailService.sendMentionEmail`. Mentions enqueue with per-job retries (`EMAIL_QUEUE_ATTEMPTS` = 3) and exponential backoff (`EMAIL_QUEUE_BACKOFF_MS` = 5000), plus `removeOnComplete`/`removeOnFail` to keep the queue tidy. The mention email links the user back to the board with `?thread=<threadId>` to deep-link the comment thread.
- **Consequences**: The REST request path stays fast (only a Redis `LPUSH`); a dead SMTP server cannot fail an API call. Worker failure modes are visible via BullMQ's job states. In-app notifications are delivered immediately over Socket.IO, while the email leg is eventual.

### ADR-0017: Shared typed socket events for collaboration + user rooms

- **Status**: Accepted
- **Context**: Chat messages, comment threads, mention notifications, and typing/read indicators all flow over the same `/boards` namespace and must stay in sync with REST responses; notifications must reach a user regardless of which board (or none) they are viewing.
- **Decision**: Every new collaboration payload/ack is defined once in `@whiteboard/shared` (`events.ts`, `payloads.ts`) as a Zod schema with an inferred type and validated at the gateway boundary — `ChatMessageEvent`, `CommentCreatedEvent`, `CommentResolvedEvent`, `NotificationNewEvent`, `ChatTypingEvent`, `ChatReadEvent`. Chat/comment writes are broadcast to the board room as canonical events (the same shape REST returns), keeping clients in sync. Notifications additionally join a per-user room `user:<userId>` (`userRoom(userId)`) during the JWT handshake so `NotificationsService.createInApp` can push a `NotificationNewEvent` to the exact recipient. Chat read receipts are written by the realtime layer calling back into `ChatService` (`recordReadReceipt`); a missing message yields the shared `MESSAGE_NOT_FOUND` error code on the ack.
- **Consequences**: One source of truth for wire contracts across REST + Socket.IO; the client can render chat/comment events without refetching. Typing is throttled per socket via a `WeakMap` timestamp (`chatTypingThrottleMs`, default 1000ms) to avoid flooding rooms.

### ADR-0018: Next.js web foundation (client, state, forms, API client)

- **Status**: Accepted
- **Context**: Phase 8 bootstraps the web app that will host the canvas, dashboard, and collaboration UI in later phases. It must share the `@whiteboard/shared` contracts, mirror the API's DTO policies client-side, and give later phases stable primitives for state, data-fetching, forms, and errors.
- **Decision**: The web app (`apps/web`) uses Next.js 15 App Router + React 19 on port `3001` with strict TypeScript and `@/*` path alias. Styling is Tailwind CSS v4 (CSS-first, no `tailwind.config`; semantic oklch tokens in `globals.css`) with shadcn/ui components (new-york, neutral base) and `next-themes` persisting the choice under `whiteboard-theme` in localStorage. **Zustand 5 is the only client state solution** — persisted stores for the auth session (`whiteboard-auth`) and toasts drive a Radix Toast `Toaster`; the history store is purely in-session (server snapshots stay separate per ADR-0005). **No component calls `fetch`** — all I/O goes through a centralized `HttpClient` (ADR-0007 envelope) that injects the bearer token, serializes query/body, retries transient failures with exponential backoff + jitter (only idempotent methods on 5xx, any method on 429/network errors), and performs **single-flight token refresh** on 401 so concurrent requests share one rotation; failures surface as a typed `ApiError` (`NETWORK_ERROR`/`AUTH_REQUIRED`/`INVALID_RESPONSE`/`TIMEOUT` + server codes). **Forms use react-hook-form + Zod** resolvers; Zod schemas in `lib/validators` mirror the API DTO policies (email ≤255, password 8–128 with letter+digit, board title/search ≤255, list limit ≤100). Components are presentation-only; pages/hooks wire services to stores. Unit tests use Vitest + jsdom (`src/**/*.spec.ts`) covering stores, the HTTP client (retry/refresh flows with mocked `fetch`), and validators; the whole phase gates on `lint && typecheck && build && test` from the repo root.
- **Consequences**: Later phases get drop-in primitives (toast, form, state, error-boundary, state components) and a single place to add endpoints/services. The refresh flow lives in the HTTP layer (not components), so auth state stays consistent app-wide. Tests pin the retry/refresh contract, reducing regression risk as the canvas/real-time layers land.

### ADR-0019: Konva canvas engine with store-driven world model

- **Status**: Accepted
- **Context**: Phase 10 delivers the core whiteboard surface: an infinite, zoomable/panable canvas with selection, drawing tools, a style bar, smart guides, grid+snap, a minimap, undo/redo, and keyboard shortcuts. It must reuse the shared element model (ADR-0004 LWW per element) and leave room for realtime collaboration (Phase 12) and autosave/history (Phase 13) without rewriting geometry or state.
- **Decision**: The board is a **single Konva `Stage`/`Layer`** (`react-konva` 19, `konva` 9) whose inner `Group` applies the camera transform (`scale = zoom`, `position = (-offsetX*zoom, -offsetY*zoom)`); a `ResizeObserver` feeds viewport size into a Zustand **camera store** (zoom/offset/viewport, `zoomTowards`, `panByScreen`, `fitToBounds`). The **world model lives in Zustand, not Konva** — `canvas-store` holds `elements`, `selectedIds`, `draft` (only `draw` elements and rubber-band `select` rects), `guides`, grid/snap/minimap flags, and the shared style; elements render reactively as memoized per-type nodes. Gesture logic is a single `useCanvasInteraction` hook: pointer + pinch handlers run pure geometry helpers (hit-testing, `resizeElement`, `rotateElement`, `findGuides`, `snapToGrid`) from `lib/canvas/{geometry,coords,elements}.ts`, mutating stores immutably and committing on pointer-up with a version bump (`bumpElementVersion`) plus a history snapshot. **Undo/redo is in-session only** (past/future arrays of full element snapshots, capped at 100) — server snapshots stay separate per ADR-0005. Keyboard shortcuts are declarative in `lib/canvas/shortcuts.ts` and dispatched through a command registry (`lib/canvas/commands.ts`); tool shortcuts require no modifiers, `Space` is a transient hand tool, and editable targets are ignored. Copy/paste is JSON (`{version:1, elements}`) over the text clipboard. Konva's optional `canvas` dependency is aliased to `false` in the Next webpack config so the browser build does not try to resolve node-canvas.
- **Consequences**: Geometry, hit-testing, and serialization are pure and unit-tested (90 canvas specs under Vitest), so realtime patches (Phase 12) can apply version-bumped element updates against the same model. Rendering stays declarative: new tools add a factory branch + icon, and element versions make LWW merges natural. The minimap, guides, grid, and zoom controls are thin overlays reading the same stores. Strict lint/typecheck/build/test from the repo root gate the phase.

### ADR-0020: Editing tools + layers (rich text, grouping, connectors, layers panel)

- **Status**: Accepted
- **Context**: Phase 11 adds the editing toolset the board needs beyond Phase 10's shapes/freehand: rich text, sticky notes, connectors, images/icons/emoji, grouping, alignment/distribution, z-order, lock/hide, per-element naming, and a layers panel. Five new element types (`text`, `sticky`, `connector`, `image`, `icon`) extend the shared model, so they must reuse the existing LWW/versioning and stay serializable.
- **Decision**: The model adds `name`, `groupId`, `locked`, `hidden` on the shared base schema (all defaulted, so old documents load unchanged) plus five discriminated variants. **All new logic is pure and lives in `lib/canvas/`** — `layers.ts` (z-order helpers operating on array indices: topmost-first ordering, `bringToFront/SendToBack`, `bringForward/SendBackward` as block moves), `grouping.ts` (single-level `groupId` membership, `expandSelectionToGroups` so selecting one member selects the whole group), `alignment.ts` (edge/center/middle alignment against the selection's axis-aligned world bounding box plus gap-free leading-edge distribution — deltas are computed per-element against `elementBBox`, so rotated elements align by their world box while rotation is preserved), `connectors.ts` (orthogonal elbow routes; connectors store world-space `start`/`end` anchors optionally bound to `startElementId/endElementId` + a handle, with a cached polyline relative to the box; `rerouteConnectors` re-anchors and version-bumps only connectors whose target moved and returns the same array when nothing changed so history commits are skipped), `text.ts` (pure rich-text layout to positioned Konva segments with a deterministic `TextMeasurer` — jsdom has no canvas — plus an HTML↔structured-paragraph interchange where **no HTML is stored**, only the structured model; sticky size auto-grows from wrapped lines), and `icon-assets.ts` (bundled inline SVG data-URLs for icons + emoji so insertion needs no network). Commands are registered in `commands.ts` (group/ungroup, arrange, align/distribute, lock, layer rename/hide, insert image/icon, apply text style) and all flow through the existing history store, so **every editing operation is undoable/redoable**; locked elements are skipped by delete, transform gestures, and editing. Interaction stays in `useCanvasInteraction` (drag-size placement, drag-to-draw connectors with live rerouting on move/resize/rotate end, double-click to edit, tool-gated right-click panning). Editing state lives in the canvas store (`editingId`, `layersPanelVisible`, `pendingInsertion`); overlays (`rich-text-editor`, `sticky-editor`, `layers-panel`, `icon-picker`, `image-insert-dialog`, `text-style-bar`, `canvas-context-menu`) are thin presentation layers over commands.
- **Consequences**: All 15 element types render via per-type memoized nodes in `element-node.tsx`; the layers panel reflects z-order live from the store. Text layout and connector routing are deterministic and unit-tested (layers, grouping, alignment, connectors, text, element factories — web suite grows to 241 tests). Images are inserted by URL or local file (data URL, validated type/size) and stay client-side in v1; Cloudinary upload is a Phase 13+ enhancement. New operations keep the pure-function → command → store → history pipeline, so realtime (Phase 12) can apply the same immutable patches.

## Scaling Strategy (summary)

- **Stateless API** — horizontal scaling behind a load balancer.
- **Redis-backed presence** — member→board mapping survives instance restarts.
- **Socket.IO adapter** — broadcasts fan out across instances.
- **PostgreSQL** — read replicas for board listing/search; cursor pagination everywhere.
- **CDN** — Cloudinary for images/thumbnails; Next.js ISR for public share pages.
- **Queue** — BullMQ job queue for mention emails, processed by an isolated worker (`EmailQueueProcessor`) against the same Redis.
- **User rooms** — `user:<userId>` Socket.IO rooms deliver notifications to a user across boards.

## Future Enhancements

See `docs/PRD.md` (Part 16): offline-first via CRDTs, AI diagram generation, AI assistant, voice/video, plugin system, template marketplace.
