# Phase Tracker

Build plan for the Collaborative Whiteboard platform. Each phase is an independent, mergeable commit on `main`. A phase is **Done** only when lint, typecheck, build, and tests pass and the commit is pushed to GitHub.

## Legend

- `⬜ Pending` — not started
- `🔄 In progress` — actively being implemented
- `✅ Done` — committed and pushed to `main`

| # | Phase | Scope | Commit message | Status |
| - | ----- | ----- | -------------- | ------ |
| 1 | Foundation & Monorepo | Workspaces, git, gitignore, env contract, README, LICENSE, PRD, ADR log, phase tracker | `chore: init monorepo, git, docs` | ✅ Done |
| 2 | API Scaffold + Database | NestJS, Prisma, PostgreSQL, Redis, docker-compose, env validation, global pipes/filters/interceptors, health check, Swagger | `feat(api): nestjs scaffold + prisma + docker-compose` | ✅ Done |
| 3 | Authentication Core | User/Session models, register/login/logout/refresh/me, JWT + refresh rotation, Argon2, JwtAuthGuard, RolesGuard, RBAC | `feat(api): auth core with jwt + rbac` | ✅ Done |
| 4 | Authentication Flows | Google OAuth, email verification, forgot/reset password, email service, rate limiting | `feat(api): google oauth + password flows` | ✅ Done |
| 5 | Board & Dashboard Domain | Board/BoardMember/Favourite/Template/ShareLink models, CRUD, archive/restore/duplicate, search/filter/sort, board authorization | `feat(api): board management apis` | ✅ Done |
| 6 | Realtime Layer | Socket.IO gateway, JWT handshake, board rooms, presence, cursors, draw events, Redis adapter | `feat(api): socket gateway + presence` | ✅ Done |
| 7 | Collaboration APIs | Comment threads, mentions, chat + typing, read receipts, notifications + email | `feat(api): collaboration + notifications` | ⬜ Pending |
| 8 | Frontend Foundation | Next.js 15, Tailwind, shadcn/ui, Zustand, RHF + Zod, API client with retry/refresh, error handling, theming | `feat(web): nextjs + tailwind + shadcn + zustand` | ⬜ Pending |
| 9 | Auth UI + Dashboard | Login/signup/reset/verify pages, Google button, dashboard tabs, search/filter/sort, board CRUD, templates, states | `feat(web): auth pages + dashboard` | ⬜ Pending |
| 10 | Canvas Engine | Konva infinite canvas, camera, grid/snap, minimap, guides, selection, tools, style bar, undo/redo, shortcuts | `feat(web): infinite canvas + tools` | ⬜ Pending |
| 11 | Editing & Organization | Rich text, sticky notes, layers panel, grouping, alignment, z-order, lock/rotate/resize, connectors, images/icons/emoji | `feat(web): editing tools + layers` | ⬜ Pending |
| 12 | Collaboration UI | Realtime cursors, presence, live drawing, comments panel, chat panel, share/invite dialog, link + expiry, conflicts | `feat(web): realtime cursors + chat + share` | ⬜ Pending |
| 13 | History + Autosave + I/O | Snapshots, restore, timeline, debounced autosave, offline queue, conflict detection, export/import all formats | `feat(web): version history + export` | ⬜ Pending |
| 14 | Polish + NFRs + Tests | WCAG AA, responsive, performance, virtualization, memoization, unit/integration/e2e/socket/load tests | `test: full test suite + a11y + perf` | ⬜ Pending |
| 15 | CI/CD + Deployment | Dockerfiles, compose, Nginx, GitHub Actions, deploy, secrets, Sentry, rollback, final docs | `chore(ci): docker + github actions + deploy` | ⬜ Pending |

## Working Rules

1. **One phase per session.** Never implement two phases in a single session.
2. **Start every session** by reading this file first, then `docs/ARCHITECTURE.md`.
3. **Finish every session** with a pushed commit and this file updated.
4. **Nothing ships broken.** `npm run lint && npm run typecheck && npm run build && npm run test` must all pass before committing.
5. **Record decisions** in `docs/ARCHITECTURE.md` (ADR log) whenever a non-obvious choice is made.
