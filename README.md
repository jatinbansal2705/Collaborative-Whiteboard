# Collaborative Whiteboard

A production-grade collaborative whiteboard platform combining the best of **Excalidraw**, **Miro**, and **FigJam** — real-time multi-user drawing, sticky notes, comments, chat, rich editing, version history, and project management.

## Highlights

- **Real-time collaboration**: cursors, live drawing, presence, chat, comments, notifications.
- **Infinite canvas**: zoom, pan, minimap, grid + snap, smart guides, grouping, layers, alignment.
- **Rich toolset**: pen, pencil, highlighter, shapes, arrows, connectors, bezier, text, sticky notes, images, icons, emoji, eraser.
- **Full lifecycle**: autosave, undo/redo, version snapshots, activity timeline, import/export (PNG/JPEG/SVG/PDF/JSON).
- **Sharing & roles**: invite by email or link, public/private links with expiry, Owner/Editor/Commenter/Viewer roles.
- **Auth**: JWT + refresh tokens, Google OAuth, email verification, password recovery, RBAC.

## Tech Stack

| Layer      | Technology                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Frontend   | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, Zustand, React Hook Form, Zod, Konva.js |
| Backend    | NestJS, TypeScript, Prisma ORM, Socket.IO                                                      |
| Database   | PostgreSQL, Redis                                                                              |
| Storage    | Cloudinary                                                                                     |
| Infra      | Docker, GitHub Actions, Vercel (web), Render/Railway/ECS (api), Nginx, Sentry                  |

## Repository Layout

```
collaborative-whiteboard/
├── apps/
│   ├── web/        # Next.js frontend (@whiteboard/web)
│   └── api/        # NestJS backend (@whiteboard/api)
├── packages/
│   └── shared/     # Shared types, DTOs, validation schemas (@whiteboard/shared)
├── docs/           # PRD, architecture, ADRs, phase tracker
└── .env.example    # Documented environment variable contract
```

This is an **npm workspaces monorepo**. Every workspace is a first-class npm package.

## Getting Started

```bash
# 1. Install all workspace dependencies from the repo root
npm install

# 2. Configure environment variables
#    web  -> copy .env.example to apps/web/.env.local and fill values
#    api  -> copy .env.example to apps/api/.env and fill values

# 3. Start infrastructure (PostgreSQL + Redis) with Docker
docker compose -f apps/api/docker-compose.yml up -d   # added in Phase 2

# 4. Run database migrations
npm run db:migrate --workspace @whiteboard/api          # added in Phase 2

# 5. Start both apps in development
npm run dev                                             # runs web + api
```

## Development Scripts (root)

| Command               | Description                                  |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Run all workspaces in dev mode               |
| `npm run dev:web`     | Run the Next.js app                          |
| `npm run dev:api`     | Run the NestJS API                           |
| `npm run build`       | Build all workspaces                         |
| `npm run typecheck`   | Type-check all workspaces                    |
| `npm run lint`        | Lint all workspaces                          |
| `npm run test`        | Test all workspaces                          |

## Documentation

- [Product Requirements Document](docs/PRD.md)
- [Architecture & ADRs](docs/ARCHITECTURE.md)
- [Phase Tracker](docs/PHASES.md)

## Roadmap

Built in 15 tracked phases — see [docs/PHASES.md](docs/PHASES.md) for the current status. Each phase lands on `main` as an independently shippable commit.

## License

[MIT](LICENSE)
