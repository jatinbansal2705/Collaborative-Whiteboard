# Performance

Performance budgets, measurement workflow, and the Phase 14 hardening work. The Lighthouse CI config in `apps/web/lighthouserc.js` asserts the budgets below; the load-test harness in `apps/api/scripts/load-test.js` verifies the backend latency targets.

## Budgets

| Metric | Budget | Tool |
| ------ | ------ | ---- |
| Largest Contentful Paint (LCP) | `< 2.5s` | Lighthouse (desktop, simulated throttling) |
| Cumulative Layout Shift (CLS) | `< 0.1` | Lighthouse |
| Total Blocking Time (TBT) | `< 200ms` | Lighthouse |
| First Contentful Paint (FCP) | `< 1.8s` | Lighthouse (warning) |
| Performance score | `>= 0.8` | Lighthouse |
| Accessibility score | `>= 0.95` | Lighthouse (WCAG AA) |
| Canvas frame rate | `60fps` during draw/pinch/pan | DevTools FPS meter / `frame()` loop instrumentation |
| Draw patch round-trip (p95) | `< 100ms` | k6 + socket latency checks |
| REST API read latency (p95) | `< 150ms` | k6 `http_req_duration` |
| Time to interactive on cold load | `< 3.5s` | Lighthouse |

## How to Measure

### Lighthouse

```bash
cd apps/web
npx lhci autorun --config=./lighthouserc.js
```

Requires the web app running on `localhost:3001` against a healthy API. Assertions fail the run when a budget is exceeded.

### Web vitals in the browser

- Open DevTools > Performance and record a load + an interaction (draw, zoom, resize).
- Confirm no dropped frames during the canvas interaction; the minimap/layers/chat panels use `react-window` so panel rendering is O(visible rows), not O(elements).
- Use the Network tab to confirm `pdf-lib` is only downloaded when an export dialog opens (dynamic `import()`), and Konva is split into a lazy chunk.

### Backend latency (k6)

```bash
cd apps/api
k6 run scripts/load-test.js
```

Prints request/iteration latency percentiles and a P95 summary for the read and write mixes. See [Load testing](#load-testing).

## Phase 14 Work

### Virtualization

- **Layers panel, comments, chat history, notification bell**: rendered with `react-window` `FixedSizeList` so only visible rows mount. Panel scroll position is preserved across open/close.
- Benefits: large boards (hundreds of elements/comments/messages) keep the React tree small; scrolling stays at compositor speed.

### Memoization & rendering

- Element nodes are `memo`ized per type (`element-node.tsx`); camera/selection/theme changes do not re-render unchanged elements.
- Canvas state is read through `useSyncExternalStore` subscriptions so pointer events do not re-render the whole stage.
- Overlays (minimap, guides, grids, zoom controls) subscribe to only the store slices they render.

### Code-splitting & lazy loading

- Konva + `react-konva` are loaded in a dynamic chunk (`next/dynamic`) only on board pages.
- `pdf-lib` is `import()`ed lazily on the first export so the PDF writer (largest client dependency) never blocks initial render.
- Dashboard, auth pages, and board routes are separate Route Groups; shared vendors are split by Next.js.
- Icons/emoji are bundled inline SVG data URLs (no network request at insertion time).

### Network & payload

- Cursor and presence updates are throttled on the client and coalesced on the server (`cursorMinIntervalMs`).
- Draw patches carry only the changed fields with a per-element version (ADR-0004), never full documents.
- Socket payloads go over the binary `websocket` transport; REST responses are gzip/br compressed behind Nginx in production.
- Autosave is debounced 1.5s; presence heartbeat 30s; typing 500ms; panel resize 100ms.

## Load Testing

### Scenario

`apps/api/scripts/load-test.js` (k6) simulates:

- **Auth + board listing** — a read mix hitting `/api/v1/boards`.
- **Board content** — read one board and its members.
- **Chat** — a write mix posting chat messages and reading read-receipts.
- **Socket presence** — a small number of virtual users connecting and joining a board room (requires a running API + Redis).

### Targets

- `http_req_duration` p95 `< 150ms` for reads, `< 300ms` for writes.
- Error rate `< 1%`.
- Socket join + first ack `< 100ms` median.

### Prerequisites

1. Infrastructure up: `docker compose -f apps/api/docker-compose.yml up -d`.
2. API running: `npm run start:dev --workspace @whiteboard/api`.
3. A `.env` with valid `JWT_ACCESS_SECRET` so the script can mint test tokens, or seed users.
4. k6 installed (`winget install k6.k6` or `choco install k6`).
