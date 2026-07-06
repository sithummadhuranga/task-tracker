# Architecture

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Express + TypeScript | No stated framework requirement from the job post; explicit choice by the repo owner (.NET background, hand-rolled Express layering demonstrates architecture skill directly rather than via framework scaffolding) |
| ORM / DB access | Prisma | Type-safe queries, migrations, no raw SQL string building |
| Database | PostgreSQL | Relational data: users, roles, permissions, tasks with real FK relationships |
| Cache / session store | Redis | Refresh-token sessions (rotation, revocation) and resolved-permission cache |
| Real-time | Socket.io | Reconnection handling + room-based broadcast with minimal boilerplate |
| Frontend | React + TypeScript + Vite | Standard, fast, matches "good to have" from job post |
| Frontend server state | TanStack Query | Cache invalidation on WebSocket events without manual state patching |
| Validation | Zod (shared between apps via `packages/shared-types`) | Single schema definition used by both backend request validation and frontend forms — prevents drift |
| Testing (backend) | Jest + Supertest | Unit (service layer, mocked repositories) + e2e (real HTTP against test DB) |
| Testing (frontend) | Vitest + React Testing Library | Component + permission-gating logic tests |
| HTTP security headers | Helmet | Sets `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` etc. with sane defaults instead of hand-rolling them |
| Auth rate limiting | express-rate-limit + rate-limit-redis | Throttles `/auth/login` and `/auth/register` per IP; backed by the existing Redis instance so limits hold across multiple backend instances |
| Logging | Pino + pino-http | Structured JSON logs (async, won't block the event loop like `console.log`), per-request `reqId`/timing via middleware, `userId` bound in once `authenticate` resolves it — all for cross-request correlation, not a persisted audit trail (see note below) |
| Monorepo tooling | pnpm workspaces + Turborepo | 2026 default for small/mid TS monorepos (2 apps, 1 shared package) — Nx's extra concepts (generators, tagged boundaries, affected-graph CI) solve problems this repo doesn't have |
| CI | GitHub Actions | lint → test → build, on push + PR |
| Containerization | Docker + docker-compose | app, Postgres, Redis — local parity with any real deployment target |
| AI text formatting (bonus, optional) | Google Gemini API (`gemini-2.5-flash` by default, configurable), plain `fetch` — no SDK | Powers the optional "Magic Polish" endpoint (`docs/FEATURES_AND_API.md` §5a). A single-shot `generateContent` REST call is a handful of lines of HTTP; pulling in a client library for that would be dead weight — flagged here rather than added silently. Free tier is enough for this use case. |

## 2. Repository layout

```
task-tracker/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── auth.routes.ts
│   │   │   │   │   ├── session.repository.ts      (Redis session logic)
│   │   │   │   │   └── auth.dto.ts                (Zod schemas, imported from shared-types where applicable)
│   │   │   │   ├── rbac/
│   │   │   │   │   ├── roles.controller.ts
│   │   │   │   │   ├── roles.service.ts
│   │   │   │   │   ├── roles.repository.ts
│   │   │   │   │   ├── permissions.controller.ts   (GET /permissions catalog read)
│   │   │   │   │   ├── permissions.service.ts      (effective-permission resolution + Redis cache)
│   │   │   │   │   ├── permissions.repository.ts
│   │   │   │   │   ├── rbac.dto.ts
│   │   │   │   │   └── rbac.routes.ts              (roles + permissions + POST /users/:id/roles)
│   │   │   │   ├── users/
│   │   │   │   │   ├── users.controller.ts
│   │   │   │   │   ├── users.service.ts
│   │   │   │   │   ├── users.repository.ts
│   │   │   │   │   ├── users.dto.ts
│   │   │   │   │   └── users.routes.ts
│   │   │   │   └── tasks/
│   │   │   │       ├── tasks.controller.ts
│   │   │   │       ├── tasks.service.ts
│   │   │   │       ├── tasks.repository.ts
│   │   │   │       ├── tasks.dto.ts
│   │   │   │       ├── tasks.routes.ts
│   │   │   │       ├── magic-polish.controller.ts   (bonus: POST /tasks/magic-polish)
│   │   │   │       ├── magic-polish.service.ts       (no repository — stateless, no Task I/O)
│   │   │   │       ├── magic-polish.client.ts        (AiTextClient interface + GeminiTextClient)
│   │   │   │       ├── magic-polish.dto.ts
│   │   │   │       └── magic-polish-rate-limit.ts    (per-user, not per-IP)
│   │   │   ├── common/
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── authenticate.ts             (verifies access token, attaches req.user)
│   │   │   │   │   ├── requirePermission.ts         (reads Redis-cached permission set)
│   │   │   │   │   ├── validate.ts                  (Zod-based body/query validation)
│   │   │   │   │   ├── rate-limit.ts                 (generic Redis-backed limiter factory)
│   │   │   │   │   ├── auth-rate-limit.ts            (login/register/refresh presets, IP-keyed)
│   │   │   │   │   └── errorHandler.ts               (global error → standard error shape)
│   │   │   │   ├── errors/                          (AppError hierarchy)
│   │   │   │   └── config/                           (typed env loading + validation at boot)
│   │   │   ├── websocket/
│   │   │   │   ├── gateway.ts                        (handshake auth, room join)
│   │   │   │   └── events.ts                          (emit helpers used by services)
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma
│   │   │   │   └── seed.ts                            (seed USER/ADMIN roles + permission catalog)
│   │   │   └── main.ts
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   └── e2e/
│   │   └── Dockerfile
│   └── frontend/
│       ├── src/
│       │   ├── features/
│       │   │   ├── auth/                              (login, register, session context)
│       │   │   ├── tasks/                              (list, detail, forms, filters)
│       │   │   └── admin/                              (roles screen, users screen, permission grid)
│       │   ├── lib/
│       │   │   ├── apiClient.ts
│       │   │   ├── socketClient.ts
│       │   │   └── permissions.ts                       (hasPermission helper, driven by /auth/me)
│       │   ├── components/ui/
│       │   └── App.tsx
│       └── Dockerfile
├── packages/
│   └── shared-types/
│       └── src/
│           ├── enums.ts                                 (TaskStatus, PermissionKey — literal union types)
│           └── schemas.ts                                (Zod schemas shared by both apps)
├── docs/
│   ├── FEATURES_AND_API.md
│   ├── ARCHITECTURE.md
│   └── CODING_STANDARDS.md   (folded into CLAUDE.md — see root)
├── postman/
├── .github/workflows/ci.yml
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── CLAUDE.md
```

## 3. Layering rule (applies to every backend module)

`routes → controller → service → repository → Prisma`

- **routes**: wiring only — path, middleware chain (`authenticate`, `requirePermission`,
  `validate`), controller method. No logic.
- **controller**: parses `req`, calls the service, shapes the HTTP response. No business
  rules, no direct Prisma access.
- **service**: all business logic (ownership checks, permission resolution calls, RBAC rules).
  Depends on a repository **interface**, not a concrete Prisma client — this is what makes
  services unit-testable with a mocked repository instead of a real database.
- **repository**: the only layer that talks to Prisma directly.

This is a Dependency Inversion boundary, not decoration — unit tests for services must mock
the repository interface, never spin up a real database connection. Only e2e tests touch a
real (test) database.

## 4. What is explicitly out of scope for v1

- No microservices split — single backend service, modularized internally.
- No Kubernetes manifests — docker-compose is the correct scope here.
- No Redux or other global state library on the frontend — TanStack Query + React Context
  is sufficient and choosing not to add more is itself a signal of judgment.
- No audit-log table for tasks (documented as a Future Improvement instead). Tasks do use
  soft-delete (`Task.deletedAt`) — `DELETE /tasks/:id` sets it rather than removing the row;
  every repository query filters `deletedAt: null`, and the column is never present in any API
  response (docs/FEATURES_AND_API.md's `DELETE /tasks/:id` entry).
- No persisted audit trail or admin UI for permission/role changes — Pino request logging
  (above) is operational/ops logging only (ships to stdout, not the database) and is not a
  substitute for one; a real audit trail is a data feature with its own schema, retention
  policy, and UI, out of scope for v1 for the same reason the task audit-log table is.