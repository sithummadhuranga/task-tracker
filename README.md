# Task Tracker

A full-stack Task Tracker with role-based access control and real-time task updates. This file
covers how to actually run, test, and deploy the project.

## Live Demo

| Environment | Frontend | Backend |
| ----------- | -------- | ------- |
| Production  | https://task-tracker.sithum.dev/     | https://api-task-tracker.sithum.dev/ |
| Staging     | https://task-tracker-dev.sithum.dev/ | https://api-task-tracker-dev.sithum.dev/ |

Both track their respective branch automatically (`main` → production, `develop` → staging) via
the CI/CD pipeline described below. Free-tier hosting on all four services (DigitalOcean, Vercel,
Neon, Upstash), so the very first request after a period of inactivity may take a few seconds to
cold-start. No demo login is published here — register a new account through the frontend to try
it, or ask for a reviewer login separately.

## Documentation

- [`docs/FEATURES_AND_API.md`](docs/FEATURES_AND_API.md) — the complete API contract: every
  entity, endpoint, permission requirement, and locked behavioral decision.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack rationale, repository layout, and the
  routes → controller → service → repository → Prisma layering rule.
- [`postman/`](postman/) — the Postman collection and environment referenced below.

## Stack

| Layer            | Choice                                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| Backend          | Express + TypeScript                                                    |
| ORM / DB         | Prisma + PostgreSQL                                                     |
| Cache / sessions | Redis                                                                   |
| Real-time        | Socket.io                                                               |
| Frontend         | React + TypeScript + Vite, Tailwind CSS, TanStack Query                 |
| Validation       | Zod, shared between apps via `packages/shared-types`                    |
| Testing          | Jest + Supertest (backend), Vitest + React Testing Library (frontend)   |
| Monorepo         | pnpm workspaces + Turborepo                                             |
| CI/CD            | GitHub Actions → DigitalOcean App Platform (backend), Vercel (frontend) |

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 10+ (`corepack enable` will pick up the pinned version automatically)
- Docker + Docker Compose, if you want the fully containerized local setup

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment configuration

Copy the example env files and fill in real values:

```bash
cp .env.example .env                       # docker-compose (Postgres/Redis/ports)
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
```

| Variable              | Used by  | Notes                                                     |
| --------------------- | -------- | ---------------------------------------------------------- |
| `DATABASE_URL`        | backend  | PostgreSQL connection string                                |
| `REDIS_URL`           | backend  | Redis connection string                                     |
| `CORS_ORIGIN`         | backend  | Frontend origin allowed to call the API                      |
| `NODE_ENV`            | backend  | `development` \| `test` \| `production`                      |
| `PORT`                | backend  | Defaults to `4000`                                           |
| `JWT_ACCESS_SECRET`   | backend  | Signs access tokens, min 32 chars — generate with `openssl rand -base64 48` |
| `ADMIN_SEED_EMAIL`    | backend  | Email for the one seeded admin account, only read the first time that account is created |
| `ADMIN_SEED_PASSWORD` | backend  | Password for the same seeded admin account, only read the first time that account is created |
| `VITE_API_URL`        | frontend | Backend base URL. For local `vite dev`, read at dev-server start; for Docker, baked into the static bundle at `docker compose build` time via a build arg (see root `.env.example`) — Vite has no server process at runtime to read it later |
| `GEMINI_API_KEY`      | backend  | **Optional.** Enables the bonus "Magic Polish" AI endpoint (`POST /tasks/magic-polish`). Get a free-tier key at https://aistudio.google.com/apikey. Leave blank to skip — the app still boots and every other feature works; that one endpoint responds `503` instead |

The backend fails fast at boot with a clear error if any of these (aside from
`ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD`, which only the seed step reads, not the running
server, and `GEMINI_API_KEY`, which is optional) are missing or malformed
(`src/common/config/env.ts`) — it will not silently start in a broken state.

### 3. Database setup

Bring up Postgres and Redis (via Docker, or point at your own local instances):

```bash
docker compose up -d postgres redis
```

Then apply the schema and seed the RBAC catalog:

```bash
pnpm --filter @task-tracker/backend run prisma:migrate
pnpm --filter @task-tracker/backend run prisma:seed
```

The seed is safe to re-run: the `USER`/`ADMIN` roles, the fixed 10-key permission catalog, and
the seeded admin account are only ever created once — a re-run never overwrites an existing
role's permission assignments or an existing account's password, so it can't silently undo
something an admin later customized in production.

### 4. Run the apps

Either run everything through Docker Compose:

```bash
docker compose up --build
```

This brings up Postgres and Redis, runs migrations + seeding via a one-shot `migrate` service,
then starts the backend (`http://localhost:4000`) and frontend (`http://localhost:5173`), each
with healthchecks — the backend won't start until `migrate` has completed successfully. Once
it's up, you can sign in immediately with the seeded admin account: whatever you set
`ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` to.

Or run backend and frontend directly against the Dockerized Postgres/Redis:

```bash
pnpm --filter @task-tracker/backend dev     # http://localhost:4000
pnpm --filter @task-tracker/frontend dev    # http://localhost:5173
```

## Testing

```bash
pnpm turbo run test    # unit + e2e (backend), component tests (frontend), across every package
pnpm turbo run lint
pnpm turbo run build
```

CI (`.github/workflows/ci.yml`) runs all three on every push to `main`/`develop` and on every
pull request (any source branch), against real Postgres and Redis service containers — nothing
merges without passing.

## API Reference (Postman)

`postman/task-tracker.postman_collection.json` covers every implemented endpoint, organized into
Health, Auth, Admin, RBAC Administration, Users, and Tasks folders.

**Setup (once per Postman installation):**

1. Import `postman/task-tracker.postman_collection.json` (File → Import).
2. Import `postman/task-tracker.postman_environment.json` the same way.
3. In the environment selector dropdown, top-right of the Postman window, select
   **"Task Tracker - Local"**. This is the step it's easiest to forget — every request reads
   `{{baseUrl}}` from this environment, and without it selected every request 404s against
   nothing.
4. Open that environment (the eye icon next to the dropdown, or Environments in the sidebar) and
   fill in `adminEmail` / `adminPassword` with whatever you set `ADMIN_SEED_EMAIL` /
   `ADMIN_SEED_PASSWORD` to during setup (see Environment configuration above). `baseUrl`
   (`http://localhost:4000`) and `testPassword` already have working defaults — only the two
   admin fields need to be filled in.

**Run order:** Auth > Register, then Auth > Login, then Admin > Login as Admin — in that order,
every time you start a fresh run. After that, every other folder can be run in any order. Access
tokens and the ids needed to chain later requests (`userId`, `roleId`, `taskId`,
`permissionOverrideId`) are captured automatically via each request's test script; the refresh
token is a cookie, handled by Postman's own cookie jar. Each request's description explains its
permission requirement and any locked, non-obvious behavior (ownership masking, no-op renames,
etc.). Tasks > Magic Polish is the one request expected to return `503` instead of `200` unless
you've also set the optional `GEMINI_API_KEY` — that's correct behavior, not a failure.

## Deployment

The backend deploys to **DigitalOcean App Platform**, the frontend to **Vercel**, across two
permanent environments: `staging` (tracks the `develop` branch) and `production` (tracks
`main`). Database is **Neon** (one project, two branches), Redis is **Upstash** (two separate
free-tier databases, one per environment).

The backend image is built and pushed to **GitHub Container Registry** by CI itself
(`docker/build-push-action`) — DigitalOcean never reads this repository directly, it only ever
pulls a pre-built image. No secret value is ever committed, encrypted or otherwise; everything
sensitive lives in GitHub Environment secrets and is substituted into the DigitalOcean app spec
(`.do/app.staging.yaml` / `.do/app.production.yaml`) at deploy time.

### One-time account setup (not automatable — requires dashboard access)

1. **Neon**: create a project, then a child branch named `staging` off `main`. Grab the direct
   (non-pooled) connection string for each branch.
2. **Upstash**: create two Redis databases (`*-staging`, `*-production`), grab the `rediss://`
   connection string for each.
3. **DigitalOcean**: Account → API → generate a personal access token (read+write).
4. **GitHub Container Registry**: Settings → Developer settings → Personal access tokens
   (classic) → generate one scoped to `read:packages` — DigitalOcean needs this to pull the
   (public) image.
5. **This repo** → Settings → Environments → create `staging` and `production`, each with:
   - Secrets: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` (generate a distinct value per
     environment, e.g. `openssl rand -base64 48` — never reuse the placeholder in `.env.example`),
     `ADMIN_SEED_PASSWORD` (also distinct per environment — this becomes the seeded admin
     account's login the first time each environment's database is seeded)
   - Variables: `CORS_ORIGIN` (the environment's Vercel URL), `ADMIN_SEED_EMAIL` (the seeded
     admin account's email for that environment — not a secret, but still distinct per
     environment so staging and production don't share an admin identity)
   - Repo-level secrets (not environment-scoped): `DIGITALOCEAN_ACCESS_TOKEN`, `GHCR_PAT`
6. **Vercel**: import the repo once, Root Directory `apps/frontend`, framework Vite. Add
   `VITE_API_URL` scoped to Production (→ prod backend URL) and to Preview scoped specifically
   to the `develop` branch (→ staging backend URL). `main` auto-deploys to production; pushes
   to `develop` redeploy that branch's stable preview URL.

Once secrets are in place, every push to `develop`/`main` runs CI, and only on success builds,
pushes, and deploys the corresponding environment — no manual redeploy steps after that.

## Design Decisions

### Architecture overview

Monorepo (pnpm workspaces + Turborepo): `apps/backend` (Express + TypeScript), `apps/frontend`
(React + Vite), and `packages/shared-types` (Zod schemas + enums used by both, so a validation
rule only exists in one place). The backend enforces a strict one-way layering on every module:

```
routes → controller → service → repository → Prisma
```

- **routes** wire path + middleware chain (`authenticate`, `requirePermission`, `validate`) to a
  controller method — no logic of their own.
- **controllers** parse the request and shape the HTTP response — no business rules, no direct
  Prisma access.
- **services** hold all business logic (ownership checks, permission resolution, RBAC rules) and
  depend on a repository **interface**, never a concrete Prisma client — this is what makes
  services unit-testable against a mocked repository instead of a real database.
- **repositories** are the only layer that talks to Prisma.

Full stack rationale, repository layout, and what's deliberately out of scope for v1 (no
microservices, no Kubernetes, no persisted audit trail) are in `docs/ARCHITECTURE.md`. The
complete API contract — every endpoint, permission requirement, and locked behavioral decision —
is in `docs/FEATURES_AND_API.md`.

### Key implementation decisions

- **RBAC model**: a user's effective permissions are (permissions from every assigned role) plus
  direct per-user `GRANT` overrides, minus direct per-user `DENY` overrides — DENY always wins,
  even over a role-derived grant. Permissions are resolved server-side from a Redis cache on
  every request, never embedded in the JWT, so revoking a permission takes effect immediately
  rather than waiting up to the access token's 15-minute lifetime.
- **Auth sessions**: short-lived JWT access tokens (15 min) plus an opaque, Redis-backed refresh
  token in an httpOnly/Secure/SameSite=Strict cookie, rotated on every use. Reuse of an
  already-rotated refresh token is treated as theft and revokes every session for that user.
- **Ownership vs. permission are two independent checks** on every task operation: does the
  caller hold the permission at all (`:own` or `:any`), and if only `:own`, is the caller the
  owner? A caller who can't see a task gets `404`, not `403` — this hides whether the resource
  exists at all from someone with no visibility into it.
- **Optimistic concurrency on tasks**: every Task carries an integer `version`. An update must
  echo back the version it last read; a stale value is rejected with `409` rather than silently
  overwriting a concurrent edit.
- **Real-time updates**: Socket.io, with sockets joined to permission-scoped rooms
  (`user:{id}`, and `permission:task:read:any` for admin-scope viewers) at handshake time, so a
  task event reaches exactly the sessions that should see it and no others.
- **Soft delete**: tasks are never hard-deleted (`deletedAt`); every query filters it out, and no
  API response ever exposes the column, so a soft-deleted task is indistinguishable from a
  hard-deleted one to any caller.
- **Bonus AI/LLM integration** (`POST /tasks/magic-polish`): a small, isolated, optional feature
  — stateless (no Task row read or written), calling Google Gemini directly over `fetch` (no SDK
  dependency), rate-limited per user rather than per IP since the resource being protected is API
  spend, and safely disabled (`503`, not a crash) if no API key is configured.

## Assumptions

- Ownership-check failures return `404`, not `403` (masks whether a resource exists from a
  caller with no visibility into it).
- Permissions are resolved server-side on every request via Redis; the JWT access token never
  carries permission data, so a revoked permission takes effect immediately rather than waiting
  for token expiry.
- Past due dates are allowed on task creation — a task can be created already overdue.
- Tasks are soft-deleted (`deletedAt`, never exposed in API responses); no audit trail of who
  deleted what or when.
- Registration always assigns the `USER` role — role is never client-controlled, even if sent
  in the request body.
- `/auth/login` and `/auth/register` are rate-limited to 10 requests per IP per 15-minute
  window (Redis-backed, so the limit holds across instances). Chosen as a reasonable default
  to block brute-force/credential-stuffing without a documented threshold requirement.
- Refresh token rotation's read-then-tombstone step runs as a single Redis `EVAL` (Lua), not a
  plain `GET` followed by a separate `SET` — otherwise two concurrent presenters of the same
  stolen token could both read "active" before either wrote the "rotated" marker, letting a
  replay slip past reuse detection.
- Logging out of all sessions (`/auth/logout-all`, and the admin
  `/users/:id/logout-all`) also force-disconnects that user's live WebSocket connections, not
  just their Redis-backed refresh sessions — a handshake's access token is otherwise checked
  once, at connect time, so an open socket would otherwise keep receiving task events for up to
  its remaining 15-minute lifetime after a revoke.
- `PATCH /tasks/:id` requires a `version` field (optimistic concurrency) — every Task carries an
  integer `version`, incremented on each successful update. The caller must echo back the
  version it last read; a stale value returns `409 Conflict` instead of silently overwriting a
  concurrent edit. Multi-statement Postgres writes elsewhere (user registration's role
  assignment, role-permission replacement, user-role replacement) already run inside
  `prisma.$transaction` for atomicity; Redis-side bookkeeping (permission cache, session/role
  indexes) is necessarily outside that transaction — a distributed transaction across Postgres
  and Redis isn't worth the complexity at this scale, and any divergence self-heals within the
  permission cache's 60-second TTL without ever granting access beyond what Postgres allows.
- `POST /tasks/magic-polish` (bonus AI/LLM integration) is a stateless helper only — it never
  touches a Task row itself, isn't tied to a specific permission key beyond the existing
  task-write ones, and is rate-limited per authenticated user (not per IP, since the resource
  being protected is API spend). `GEMINI_API_KEY` is optional; without it the endpoint returns
  `503` and every other feature is unaffected. See `docs/FEATURES_AND_API.md` §5a.

## Future Improvements

- Audit log for tasks — who deleted/changed what, and when (soft-delete itself is implemented;
  a queryable history of deletions is not).
- Persisted audit trail + admin UI for RBAC changes. Pino request logging (added for Issue 4 of
  the security review) is operational logging only — JSON to stdout, not the database, and not
  a substitute for this. A real implementation would need: an `AuditLog` table (`actorUserId`,
  `action` — a closed enum like `ROLE_ASSIGNED`, `PERMISSION_OVERRIDE_SET`,
  `PERMISSION_OVERRIDE_REMOVED`, `USER_LOGOUT_ALL` — `targetUserId`, a `metadata` JSON column for
  before/after values, `createdAt`), written from a dedicated `AuditLogService` called at the end
  of the relevant `UsersService`/`RolesService` methods (never from controllers, per the
  routes→controller→service→repository layering); a new `audit:read` permission key gating a
  paginated `GET /admin/audit-log` endpoint (filterable by actor/action/date range); rows are
  never updated or hard-deleted once written, since a mutable audit record is worthless; and a
  read-only admin page reusing the existing paginated-table pattern from the Users screen. Not
  in `docs/FEATURES_AND_API.md`'s locked contract and not required by the assignment brief, so
  left undone rather than adding an undocumented endpoint/table.
- Socket.io Redis adapter, if the backend ever needs more than one instance — not needed at the
  current `instance_count: 1` scale, but the Redis dependency for it is already in place.
- Smaller backend Docker image — `@prisma/client`'s current production install pulls in
  several MB of tooling (Prisma Studio, an embedded WASM Postgres, the `prisma` CLI itself)
  that the running server never uses.
- Automated GHCR image cleanup — old image digests accumulate in the package's version history
  with no retention policy configured yet.
- Kanban board drag-and-drop uses the native HTML5 Drag and Drop API rather than a library —
  deliberate, to avoid an undeclared dependency for a simple 3-column cross-drop interaction, but
  it does not work on touch/mobile browsers at all. Degrades gracefully today (the task detail
  view's status control is a fully working fallback), but a real mobile-friendly board would need
  a pointer-event-based library (e.g. dnd-kit) instead.
- The List/Board view toggle on the tasks page is local component state, not persisted — a page
  refresh always lands back on List. Persisting the last-used view (URL query param or
  localStorage) would be a small, low-risk addition.
