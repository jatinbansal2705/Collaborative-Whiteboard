# Product Requirements Document — Collaborative Whiteboard

A production-grade real-time collaborative whiteboard platform (Excalidraw + Miro + FigJam). This document is the single source of truth for scope, behavior, and acceptance.

---

## Part 1 — Executive Summary

### Product Vision
A fast, beautiful, infinitely-scoped whiteboard where distributed teams think, design, and plan together in real time — with the polish of FigJam and the drawing precision of Excalidraw, wrapped in a project-management dashboard like Miro.

### Business Goals
1. Deliver the core loop — create board → invite collaborators → draw together in real time — with sub-100ms perceived latency.
2. Ship a complete auth + sharing + history lifecycle so boards are safe, durable, and auditable.
3. Provide an architecture that scales horizontally (stateless API, Redis-backed realtime) from day one.

### Target Users
Product designers, software engineers, PMs, educators, distributed teams.

### User Personas
- **Priya (Designer)**: high fidelity expectations, needs connectors/guides/layers, exports Figma-ready assets.
- **Dev (Engineer)**: speed matters, keyboard-driven, wants undo/history and JSON import/export.
- **Mei (PM)**: runs retrospectives and planning, relies on sticky notes, comments, and templates.
- **Alex (Remote teammate)**: joins via share link, needs viewer/commenter roles and realtime presence.

### User Stories
- As a user, I can sign up with email or Google and verify my account.
- As a user, I can create, favorite, archive, restore, duplicate, and delete boards.
- As a user, I can draw shapes, freehand, text, and sticky notes on an infinite canvas.
- As a user, I can invite teammates with Owner/Editor/Commenter/Viewer roles or share a link.
- As a user, I can see everyone's cursor and edits in real time.
- As a user, I can leave and resolve comment threads and mention teammates.
- As a user, I can chat with others on the board and see typing indicators.
- As a user, I can undo/redo, restore an older snapshot, and see activity history.
- As a user, I can export PNG/JPEG/SVG/PDF/JSON and import JSON/SVG/PNG.

### Objectives
- Working end-to-end platform with all modules below shipped to production.
- Accessible (WCAG AA), responsive, and fast (LCP < 2.5s, 60fps canvas).

### Non-Goals (v1)
- No native mobile app (responsive web only).
- No offline-first editing via CRDT (autosave + queue only).
- No fine-grained concurrent merge conflicts (LWW per element).
- No voice/video/plugin marketplace (roadmap).
- No public "template marketplace" beyond seeded templates.

### KPIs / Success Metrics
- P95 time-to-first-draw < 2s; canvas interaction at 60fps.
- Realtime edit propagation P95 < 200ms.
- P99 board load < 3s (snapshot + assets).
- Uptime 99.9%; zero auth-token leakage in logs.

---

## Part 2 — Functional Requirements

### Authentication
- **Signup**: email, password (min 8 chars, 1 number, 1 letter), confirm password; duplicate-email rejection; email verification required before login.
- **Login**: email + password; rate-limited (5/min); generic "invalid credentials" error.
- **Logout**: revoke refresh token server-side + client clears state.
- **Refresh**: rotating refresh tokens, hashed at rest, session metadata (device, IP, lastUsed); reuse-detection revokes the session on token theft.
- **Google OAuth**: signup-or-link by verified email; links to existing account if email matches.
- **Forgot / Reset password**: rate-limited email with expiring single-use token; on reset, revoke all sessions.
- **Email verification**: expiring signed link; resend with cooldown (60s).
- **JWT**: access token 15m; refresh 30d. **RBAC**: global roles (ADMIN) and per-board roles (OWNER/EDITOR/COMMENTER/VIEWER).
- **Session management**: list active sessions, revoke individual or all.

*Validation rules*: email RFC-ish regex; password policy above; all DTOs whitelisted; Zod/class-validator both sides.

*Edge cases*: unverified login attempt → 403 with verification hint; reused refresh token → revoke family; email case-insensitive uniqueness.

*Acceptance*: full lifecycle (signup → verify → login → refresh → logout) passes integration tests; tokens never appear in logs.

### Dashboard
- **Tabs**: Recent, Shared with me, Favorites.
- **Search**: by title, fuzzy substring. **Filters**: archived/active/template/owned-by. **Sort**: last edited, created, title, member count.
- **Actions**: create (title, from template), rename, delete (soft), duplicate (deep copy), archive, restore, favorite/unfavorite.
- **Templates**: seeded gallery; create-from-template.
- **States**: skeleton loading, empty state per tab, error + retry.
- *Acceptance*: cursor-paginated, search/sort/filter combos return correct sets; destructive actions confirm and support restore.

### Board (Canvas)
- Infinite canvas; zoom 10%–400% (wheel/pinch/buttons, fit, 100%); pan (space, middle-drag, hand tool); minimap; grid with snap (toggle); smart guides (alignment with neighbors).
- Selection: click, rubber-band multi-select, shift toggle; bounding box; copy/paste (clipboard + internal), duplicate, delete.
- Grouping/ungroup; z-order (front/back/forward/backward); lock/unlock; rotate (step 15° on shift); resize (handles, aspect lock); align/distribute.
- Full keyboard shortcut map (V space P R O E T S L K etc.) with help modal.

### Drawing Engine
- Tools: pen (pressure, smooth), pencil, highlighter (translucent, additive), rectangle, circle/ellipse, triangle, diamond, arrow (auto elbow/straight), straight line, curved line, bezier, connector (reroutes on endpoint move), image, icon, emoji, eraser (stroke erase).
- Styling: color picker (+ eyedropper), stroke width, fill (none/solid/pattern), opacity, dash pattern, gradient (linear/radial), shadow (blur/offset/color), stroke caps/joins.
- *Acceptance*: every tool produces an element that serializes to JSON, renders on all export formats, and matches selected style.

### Text
- Rich text: font family/size, bold/italic/underline, left/center/right/justify, bullet + numbered lists, hyperlinks, line height, auto-width or wrap mode, color.

### Layers
- Panel listing elements in z-order; create/rename/delete/hide/lock; reorder by drag or up/down; visibility + lock toggles; bulk select on click.

### Sticky Notes
- Create, edit (auto-grow text), color palette, resize, move, delete; distinct element type.

### Comments
- Threads anchored at canvas coordinates; reply; resolve/unresolve; mention `@User` (autocomplete from board members); notifications to mentioned users + thread subscribers.

### Chat
- Board-scoped realtime chat; typing indicator; read receipts; emoji (picker + shortcodes); attachment upload (Cloudinary) as image/file card.

### Collaboration
- Realtime cursors (throttled 30–50Hz on move, colored, name label); presence roster (in/away, tool in use); live drawing + selection mirroring; per-user color assignment (stable hash).
- **Conflict resolution**: LWW per element with monotonic version + server timestamp; client rejects stale writes with a retryable conflict error. **Autosync**: server rebroadcasts authoritative state on reconnect.

### Sharing
- Invite by email (role picker) with notification; public link (view/comment) + private link (requires login, role via link); link expiry (24h/7d/30d/never); revoke/rotate links; permission-based UI (viewer sees read-only).
- *Edge cases*: invite to non-existent email → pending invite table + email; removing a member mid-session → socket kick; link expiry mid-view → re-auth prompt.

### Roles
| Role | Capabilities |
| ---- | ------------ |
| OWNER | everything incl. delete, transfer, member management |
| EDITOR | edit canvas, comments, chat, export |
| COMMENTER | view + comment + chat |
| VIEWER | read-only view |

### Export / Import
- Export: PNG, JPEG (scale + background options), SVG (vector), PDF (multi-page or single), JSON (full board schema + version).
- Import: JSON (validate schema + version), SVG (convert shapes/text), PNG (embed as image asset).

### Version History
- Undo/redo (session history, capped); snapshots: debounced (1.5s) + manual "Save version"; restore creates a new version (never destructive); activity timeline (who/which element/type/timestamp); list/compare/restore UI; retention (keep 100 auto snapshots, manual forever).

### Autosave
- Debounced 1.5s autosave to server; offline mutation queue in IndexedDB, flushed on reconnect; conflict detection via board/element version; explicit save-status indicator (saved/saving/offline/error).

### Notifications
- Types: invite, comment, mention, board shared, @mention in chat. In-app bell with unread count + mark-read; email for invites/mentions (digest).

---

## Part 3 — UI Specification

### Pages
1. `/` Dashboard: tabs, search bar, sort/filter dropdown, board grid + skeleton states, "New board" button, template gallery modal.
2. `/login`, `/signup`, `/forgot-password`, `/reset-password?token=`, `/verify-email?token=` — centered card, RHF+Zod, inline errors, loading buttons, Google button, link to auth alternative, success/error pages.
3. `/board/[id]` full-bleed editor: toolbar (tools+styles), left panel (layers), right panel (comments/chat/tabs), top bar (board name, presence avatars, share, export, history, help), bottom bar (zoom/minimap), context menus on right-click.
4. `/board/[id]/public` read-only public share page (no auth required).

### Modals
Create board, rename, share/invite (roles + links + expiry), export (format + options), import, version history, session management, delete confirm, template gallery, keyboard shortcuts help.

### Toolbar / Sidebars / Context menus / Dropdowns
- Top bar: logo/back, editable board title, presence cluster, action menu (favorite/duplicate/archive/export/import/history), Share (primary CTA), help.
- Left tool rail: select, hand, pen, pencil, highlighter, shapes flyout, text, sticky, image, icon/emoji, connector, eraser; second rail: stroke/fill/width/opacity/dash/gradient/shadow.
- Right panel: tabs Layers / Comments / Chat; per-tab sub-actions (reorder, resolve, typing…).
- Context menu (element): cut/copy/duplicate/delete, bring/send, group, lock, align, rotate, flip.
- Presence: avatar stack with overflow count; cursor labels; away states.

### Theme & States
- **Dark/Light**: semantic tokens via CSS variables (shadcn); system default + manual override persisted; canvas adapts grid/guides.
- **Empty states**: per-tab empty illustration + primary CTA. **Loading**: skeletons; canvas shows shimmer + progress. **Error**: retry + details (non-sensitive); offline banner with queue count. **Accessibility**: WCAG AA contrast in both themes, full keyboard operability, focus-visible rings, ARIA labels on all icon buttons, reduced-motion support.

### Responsive
- ≥1024px: full studio layout. 768–1024px: collapsible side panels (overlay). <768px: touch-friendly tool sizes, panels become bottom sheets; read-only on very small screens still fully supported.

---

## Part 4 — System Architecture

- **High level**: stateless NestJS API behind a load balancer; Socket.IO gateway with Redis adapter; PostgreSQL as source of truth; Redis for presence/rate-limit/denylist/pubsub; Cloudinary for assets; Next.js frontend on Vercel/self-hosted; Nginx as edge reverse proxy + TLS.
- **Frontend**: App Router; server components for marketing/dashboard shell; client components for interactive editor; Zustand stores (auth, ui, board, canvas history, realtime); API layer with refresh-on-401 single-flight retry; Konva canvas isolated in a single component tree with imperative updates.
- **Backend**: modular NestJS (Auth, Users, Boards, Realtime, Collaboration, Notifications, Storage); controller → service → repository layering; guards/interceptors/filters centralized; BullMQ for async email/notifications.
- **WebSockets**: `/boards` namespace, per-board rooms; events named `domain:action`; acks with `{ok,data}` / `{ok:false,error:{code,message}}`.
- **Deployment**: Docker (multi-stage) for both apps; GitHub Actions lint→test→build→deploy; web on Vercel, api on Render/Railway/ECS; Sentry + structured logging; blue/green via versioned tags.

## Part 5 — Database Design (summary; Prisma schema lands in Phase 2)

| Table | Purpose | Key fields | Indexes |
| ----- | ------- | ---------- | ------- |
| User | accounts | email(unique), passwordHash, provider, emailVerifiedAt, role, avatarUrl | email, role |
| Session | refresh tokens | userId, tokenHash, device, ip, expiresAt, revokedAt, familyId | userId, tokenHash |
| Board | whiteboards | title, data(jsonb), thumbnailUrl, isTemplate, isArchived, status, createdBy | createdBy, archived, title(trgm) |
| BoardMember | membership+role | boardId, userId, role, addedBy | (boardId,userId) unique |
| BoardFavourite | star | boardId, userId | (boardId,userId) unique |
| ShareLink | links | boardId, token(unique), role, mode(public/private), expiresAt | token, boardId |
| BoardVersion | snapshots | boardId, data, createdBy, note, versionNo | (boardId,versionNo) |
| CommentThread | threads | boardId, x, y, resolvedAt, resolvedBy | boardId |
| Comment | messages | threadId, authorId, body, mentions(jsonb) | threadId |
| ChatMessage | chat | boardId, authorId, body, attachmentUrl | boardId, createdAt |
| Notification | inbox | userId, type, payload, readAt | userId, readAt |
| PendingInvite | invites | boardId, email, role, invitedBy, token | boardId, email |

Constraints: FKs with onDelete cascade/setnull as appropriate; unique constraints above; check constraints on roles/enums.

## Part 6 — REST APIs (contract)
- Base `/api/v1`, JSON, `Authorization: Bearer <access>`, `X-Request-Id` on every response.
- **Auth**: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET/POST /auth/sessions`, `DELETE /auth/sessions/:id`, `GET /auth/google`, `GET /auth/google/callback`.
- **Boards**: `GET /boards` (query: tab, search, sort, filter, cursor), `POST /boards`, `GET /boards/:id`, `PATCH /boards/:id`, `DELETE /boards/:id` (soft), `POST /boards/:id/duplicate`, `POST /boards/:id/archive`, `POST /boards/:id/restore`, `POST /boards/:id/favorite`, `GET /boards/:id/versions`, `POST /boards/:id/versions`, `POST /boards/:id/versions/:versionNo/restore`, `GET /boards/:id/data` (snapshot), `PATCH /boards/:id/data` (autosave, versioned).
- **Members**: `GET /boards/:id/members`, `POST /boards/:id/members`, `PATCH /boards/:id/members/:userId`, `DELETE /boards/:id/members/:userId`.
- **ShareLinks**: `POST /boards/:id/share-links`, `GET /boards/:id/share-links`, `DELETE /share-links/:id`.
- **Comments**: `GET /boards/:id/comments`, `POST /boards/:id/comments`, `POST /comments/:id/replies`, `POST /comments/:id/resolve`.
- **Chat**: `GET /boards/:id/messages`, `POST /boards/:id/messages`.
- **Notifications**: `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`.
- **Uploads**: `POST /uploads` (Cloudinary signed).
- **Templates**: `GET /templates`, `POST /templates` (admin).
- Standard error envelope: `{ success:false, error:{ code, message, details? } }`.

## Part 7 — Socket Events
- Namespace `/boards`, room `board:<id>`. Auth on handshake (JWT).
- `board:join` / `board:leave` → presence roster broadcast.
- `presence:update` (tool, activity) → roster.
- `cursor:move` (x,y) throttled → board room.
- `draw:patch` (element deltas: {id, patch, version, lastModifiedBy, timestamp}) → board room, ack ok/stale.
- `selection:update` (selectedIds) → board room.
- `element:create` / `element:delete` → board room.
- `comment:created` / `comment:resolved` → board room + targeted user.
- `chat:message` / `chat:typing` (throttled) / `chat:read` → board room.
- `notification:new` → targeted user.
- `kick` → member removed; `board:deleted` → close.
- Failure handling: acks with error codes; client exponential-backoff reconnect; server replays missing state on `board:join`.

## Part 8 — Frontend Architecture
```
apps/web/src/
├── app/                # App Router routes + layouts
│   ├── (auth)/login|signup|forgot-password|reset-password|verify-email
│   ├── (dashboard)/    # layout + board grid
│   └── board/[id]/     # editor
├── components/ui/      # shadcn primitives
├── components/board/   # canvas, toolbar, panels, modals, cursors
├── components/dashboard/
├── components/auth/
├── hooks/              # useBoard, useRealtime, useHistory, useZoom, useDebounce…
├── lib/                # api client, auth, utils, validators (zod), constants
├── stores/             # zustand: auth, ui, board, history, realtime
├── types/              # re-export from @whiteboard/shared
└── styles/
```

## Part 9 — Backend Architecture
```
apps/api/src/
├── common/             # decorators, guards, filters, interceptors, pipes, logger
├── modules/
│   ├── auth/           # controller, service, strategies, dto
│   ├── users/
│   ├── boards/         # controller, service, repository, dto
│   ├── members/
│   ├── share-links/
│   ├── versions/
│   ├── comments/
│   ├── chat/
│   ├── notifications/
│   ├── storage/        # cloudinary
│   ├── realtime/       # gateway, presence, rooms, auth-handshake
│   └── email/          # mailer interface + nodemailer impl
├── prisma/             # schema, migrations, seed
└── config/             # env validation, typed config
```
Repository pattern for DB access; service layer for business logic; DTOs validated globally; guards for auth + board RBAC.

## Part 10 — Implementation Roadmap
15 phases — see `docs/PHASES.md` for scope, commit messages, and status.

## Part 11 — Testing Strategy
- **Unit** (Vitest/Jest): services, stores, canvas geometry (hit-testing, guides, connectors), validators, utils. Target >85% on logic modules.
- **Integration**: Nest e2e against real Postgres+Redis (test containers) — full auth lifecycle, board CRUD, RBAC matrix.
- **Socket tests**: socket.io-client harness — join/rooms/acks/conflict/reconnect.
- **E2E** (Playwright): auth, dashboard, draw/select/edit, sticky/text, export, share link, offline banner.
- **Load** (k6): socket connect churn, broadcast latency under 500 concurrent users, REST burst.
- **Performance budgets**: Lighthouse CI — LCP<2.5s, CLS<0.1, TBT<200ms; canvas 60fps via DevTools trace in CI.

## Part 12 — Performance Optimization
- Canvas: element-level dirty flags, render only visible viewport (culling), layer batching, `Konva.Layer` throttling, rounded-rect caching, spatial index (R-tree/quadtree) for hit-testing on large boards, dirty-rectangle recomposition.
- React: memoized leaf components, `useSyncExternalStore` for canvas state, virtualization for panels/history/comments, lazy-load heavy deps (Konva, pdf-lib).
- Network: binary + deflate on socket payloads, cursor throttling, delta patches not full documents, snapshot + patches on join, response gzip/br, HTTP caching for immutable assets.
- Debounce: autosave 1.5s, presence heartbeat 30s, typing 500ms, resize 100ms.

## Part 13 — Security
- JWT: HS256 (env secret ≥32 bytes) or RS256; short-lived; claims minimal; audience/issuer checked.
- OAuth: state param + PKCE, validate `hd`/email, no token in URLs (codes only).
- Helmet headers (CSP, HSTS, X-Frame-Options); CORS allowlist; CSRF: same-site cookies (refresh token) + custom header requirement for state-changing requests.
- Rate limiting: global + per-route (auth 5/min, invite 10/hour, autosave 60/min).
- Input validation everywhere (whitelist, max lengths); XSS: React escaping, sanitize imported SVG/HTML (`DOMPurify`), Content-Security-Policy.
- SQL injection: Prisma parameterized only; no raw concatenation.
- Secrets: env-only, no logging of secrets, `.env*` ignored, secret scanning in CI.
- Redis: auth + TLS in prod, minimal command surface, `rename-command` for dangerous ops.
- Storage: private buckets + signed uploads; server-side validate image type/size; no user-controlled keys.

## Part 14 — Deployment
- Docker multi-stage images (web, api); `docker-compose` for local dev + a prod compose (api, web, nginx, postgres, redis).
- Nginx: TLS termination, gzip/brotli, security headers, SPA + API routing, websocket upgrade headers, rate limiting at edge.
- GitHub Actions: `ci.yml` (lint, typecheck, build, test on PR), `deploy.yml` (build+push images → ECS/Render/Railway; web → Vercel; secret injection; Sentry release; health-check gate; rollback = redeploy previous tag).
- Monitoring: Sentry (errors, releases), Prometheus/Grafana or managed (metrics), pino structured logs + request IDs, uptime checks, synthetic user flows.

## Part 15 — Interview Prep
See `docs/ARCHITECTURE.md` + README roadmap. Key talking points: monorepo contract, refresh-token rotation, Redis pub/sub socket scaling, LWW conflict model, debounced autosave + offline queue, dirty-rectangle/culling rendering, RBAC matrix, zero-trust env/secret handling.

## Part 16 — Future Enhancements
- Offline-first via CRDT (Yjs/Automerge) replacing LWW.
- AI diagram generation ("make a flowchart for signup flow") and AI assistant (summarize, tidy layout).
- Voice notes, video calls, screen sharing (WebRTC + SFU).
- Plugin system (iframe sandbox + API surface) and public template marketplace.
- Mobile native apps, whiteboard exports to Office/GitHub/Notion.
